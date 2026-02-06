const { CronJob } = require('cron');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const { getRedisClient } = require('../common/helpers/redisClient');

const execPromise = util.promisify(exec);

const WHITELIST_MAP_PATH = process.env.WHITELIST_MAP_PATH || '/etc/nginx/maps/whitelist.map';
// Use temp file in the same directory to avoid cross-device rename issues (EXDEV)
const WHITELIST_TEMP_PATH = process.env.WHITELIST_TEMP_PATH
  || '/etc/nginx/maps/whitelist.map.tmp';
const REDIS_WHITELIST_KEY = process.env.REDIS_WHITELIST_KEY || 'captcha_whitelist';
const UPDATE_INTERVAL = process.env.WHITELIST_UPDATE_INTERVAL || '0 3 * * *';
const WHITELIST_MAP_MAX_LINES = parseInt(process.env.WHITELIST_MAP_MAX_LINES, 10) || 200000;

const updateWhitelistMap = async () => {
  try {
    const client = await getRedisClient();

    // Get new IPs from Redis SET (delta since last run)
    const redisIps = await client.sMembers(REDIS_WHITELIST_KEY);

    if (!redisIps || redisIps.length === 0) {
      console.log('No new IPs in Redis whitelist, skipping map update');
      return;
    }

    // Read existing whitelist map file (old IPs that should stay)
    let existingIps = [];
    try {
      const existingContent = await fs.readFile(WHITELIST_MAP_PATH, 'utf8');
      existingIps = existingContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split(/\s+/)[0]);
    } catch (readError) {
      if (readError.code !== 'ENOENT') {
        console.error('Failed to read existing whitelist map:', readError.message);
      }
    }

    // Merge old + new IPs, deduplicate and sort
    const mergedSet = new Set([
      ...existingIps,
      ...redisIps.filter((ip) => ip && ip.trim()),
    ]);
    const mergedIps = Array.from(mergedSet).sort();

    const totalIps = mergedIps.length;
    const ips = mergedIps.slice(0, WHITELIST_MAP_MAX_LINES);
    const writtenIps = ips.length;

    if (totalIps > WHITELIST_MAP_MAX_LINES) {
      console.warn(
        `Whitelist has ${totalIps} IPs (old + new), limiting to ${WHITELIST_MAP_MAX_LINES} entries`,
      );
    }

    // Generate nginx geo map format: IP 0;
    const mapContent = ips
      .map((ip) => `${ip.trim()} 0;\n`)
      .join('');

    if (!mapContent) {
      console.log('No valid IPs to write to whitelist map');
      return;
    }

    // Write to temp file first
    await fs.writeFile(WHITELIST_TEMP_PATH, mapContent, 'utf8');

    // Test nginx config
    try {
      await execPromise('nginx -t');
    } catch (error) {
      console.error('Nginx config test failed, skipping whitelist update:', error.message);
      await fs.unlink(WHITELIST_TEMP_PATH).catch(() => {});
      return;
    }

    // Write or rename temp file to final location
    try {
      await fs.rename(WHITELIST_TEMP_PATH, WHITELIST_MAP_PATH);
    } catch (renameError) {
      // Fallback for busy file or cross-device rename (EXDEV)
      if (renameError.code === 'EBUSY' || renameError.code === 'EXDEV') {
        await fs.writeFile(WHITELIST_MAP_PATH, mapContent, 'utf8');
        await fs.unlink(WHITELIST_TEMP_PATH).catch(() => {});
      } else {
        await fs.unlink(WHITELIST_TEMP_PATH).catch(() => {});
        throw renameError;
      }
    }

    // Reload nginx to pick up new content
    try {
      await execPromise('nginx -s reload');
    } catch (error) {
      console.error('Failed to reload nginx:', error.message);
      return;
    }

    console.log(
      `Whitelist map updated: ${writtenIps} IPs written to ${WHITELIST_MAP_PATH}${
        totalIps > writtenIps ? ` (${totalIps - writtenIps} IPs truncated due to limit)` : ''
      }`,
    );

    // Clear Redis key after merging new IPs into whitelist map file
    try {
      await client.del(REDIS_WHITELIST_KEY);
      console.log(`Cleared Redis whitelist key: ${REDIS_WHITELIST_KEY}`);
    } catch (delError) {
      console.error(
        `Failed to delete Redis whitelist key ${REDIS_WHITELIST_KEY}:`,
        delError.message,
      );
    }
  } catch (error) {
    console.error('Error updating whitelist map:', error.message);
  }
};

exports.updateWhitelistJob = new CronJob(
  UPDATE_INTERVAL,
  updateWhitelistMap,
  null,
  false,
  null,
  null,
  true,
);
