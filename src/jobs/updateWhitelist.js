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

    // Get all IPs from Redis SET
    const allIps = await client.sMembers(REDIS_WHITELIST_KEY);

    if (!allIps || allIps.length === 0) {
      console.log('No IPs in whitelist, skipping map update');
      return;
    }

    // Filter and sort IPs
    const validIps = allIps
      .filter((ip) => ip && ip.trim())
      .sort();

    // Limit to max lines
    const ips = validIps.slice(0, WHITELIST_MAP_MAX_LINES);
    const totalIps = validIps.length;
    const writtenIps = ips.length;

    if (totalIps > WHITELIST_MAP_MAX_LINES) {
      console.warn(
        `Whitelist has ${totalIps} IPs, limiting to ${WHITELIST_MAP_MAX_LINES} entries`,
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
      `Whitelist map updated: ${writtenIps} IPs written to ${WHITELIST_MAP_PATH}${totalIps > writtenIps ? ` (${totalIps - writtenIps} IPs truncated due to limit)` : ''}`,
    );

    // Remove written IPs from Redis after successful update
    try {
      if (ips.length > 0) {
        await client.sRem(REDIS_WHITELIST_KEY, ips);
        console.log(`Removed ${ips.length} IPs from Redis whitelist key: ${REDIS_WHITELIST_KEY}`);

        // Check if key is now empty and delete it
        const remainingCount = await client.sCard(REDIS_WHITELIST_KEY);
        if (remainingCount === 0) {
          await client.del(REDIS_WHITELIST_KEY);
          console.log(`Cleared empty Redis whitelist key: ${REDIS_WHITELIST_KEY}`);
        } else if (totalIps > writtenIps) {
          console.log(`${remainingCount} IPs remaining in Redis for next update cycle`);
        }
      }
    } catch (delError) {
      console.error(`Failed to remove IPs from Redis key ${REDIS_WHITELIST_KEY}:`, delError.message);
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
