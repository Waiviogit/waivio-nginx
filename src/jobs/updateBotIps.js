const { CronJob } = require('cron');
const redis = require('redis');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const ipaddr = require('ipaddr.js');

const execPromise = util.promisify(exec);

const BOT_IPS_MAP_PATH = process.env.BOT_IPS_MAP_PATH || '/etc/nginx/maps/bot_ips.map';
const BOT_IPS_TEMP_PATH = process.env.BOT_IPS_TEMP_PATH || '/tmp/bot_ips.map.tmp';
const BOT_IPS_OVERFLOW_MAP_PATH = process.env.BOT_IPS_OVERFLOW_MAP_PATH || '/etc/nginx/maps/bot_ips_overflow.map';
const BOT_IPS_OVERFLOW_TEMP_PATH = process.env.BOT_IPS_OVERFLOW_TEMP_PATH || '/tmp/bot_ips_overflow.map.tmp';
const BOT_IPS_MAP_MAX_LINES = parseInt(process.env.BOT_IPS_MAP_MAX_LINES, 10) || 200000;
const REDIS_KEY = process.env.REDIS_BOT_IPS_KEY || 'api_bot_detection';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_DB = process.env.REDIS_DB || 11;
const { REDIS_PASSWORD } = process.env;
const UPDATE_INTERVAL = process.env.BOT_IPS_UPDATE_INTERVAL || '*/10 * * * *';

// Whitelisted IPs that should never be blocked
const WHITELISTED_IPS = [
  '206.189.200.117',
  '142.93.98.71',
];

// Aggregation / promotion settings
// First level: single IPs -> /24 (IPv4) or /64 (IPv6)
// Second level: many /24 -> /16 (IPv4), many /64 -> /48 (IPv6)
const SOFT_V4_MAX_PREFIX = 24; // we always aggregate single IPv4 IPs up to /24
const SOFT_V6_MAX_PREFIX = 64; // we always aggregate single IPv6 IPs up to /64

// Second-level aggregation thresholds (how many /24 or /64 are needed to promote)
const V4_SUPER_PROMO_THRESHOLD = parseInt(process.env.BOT_V4_SUPER_PROMO_THRESHOLD, 10) || 10;
const V6_SUPER_PROMO_THRESHOLD = parseInt(process.env.BOT_V6_SUPER_PROMO_THRESHOLD, 10) || 30;

const getCurrentDateString = () => {
  const date = new Date();

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

const isWhitelisted = (ipEntry) => {
  try {
    let entryAddr;
    let entryPrefix;

    if (ipEntry.includes('/')) {
      [entryAddr, entryPrefix] = ipaddr.parseCIDR(ipEntry);
    } else {
      entryAddr = ipaddr.parse(ipEntry);
      entryPrefix = entryAddr.kind() === 'ipv4' ? 32 : 128;
    }

    for (const whitelistIp of WHITELISTED_IPS) {
      try {
        let whitelistAddr;
        let whitelistPrefix;

        if (whitelistIp.includes('/')) {
          [whitelistAddr, whitelistPrefix] = ipaddr.parseCIDR(whitelistIp);
        } else {
          whitelistAddr = ipaddr.parse(whitelistIp);
          whitelistPrefix = whitelistAddr.kind() === 'ipv4' ? 32 : 128;
        }

        // Check if entry matches whitelist IP exactly
        if (
          entryAddr.kind() === whitelistAddr.kind()
          && entryAddr.toString() === whitelistAddr.toString()
          && entryPrefix === whitelistPrefix
        ) {
          return true;
        }

        // Check if entry is within whitelisted range
        if (
          entryAddr.kind() === whitelistAddr.kind()
          && entryPrefix >= whitelistPrefix
          && entryAddr.match([whitelistAddr, whitelistPrefix])
        ) {
          return true;
        }

        // Check if whitelist IP is within entry range (entry covers whitelist)
        if (
          entryAddr.kind() === whitelistAddr.kind()
          && whitelistPrefix >= entryPrefix
          && whitelistAddr.match([entryAddr, entryPrefix])
        ) {
          return true;
        }
      } catch (e) {
        // Invalid whitelist entry, skip
        continue;
      }
    }

    return false;
  } catch (e) {
    // Invalid entry, don't whitelist
    return false;
  }
};

let redisClient = null;

const initRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // Close orphaned client before creating new one to avoid leaking sockets/listeners
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (e) {
      redisClient.disconnect?.();
    }
    redisClient = null;
  }

  const config = {
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    database: REDIS_DB,
  };

  if (REDIS_PASSWORD) {
    config.password = REDIS_PASSWORD;
  }

  redisClient = redis.createClient(config);

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
    redisClient = null;
    throw error;
  }

  return redisClient;
};

const parseIpEntries = (entries) => {
  const softV4 = [];
  const softV6 = [];

  entries.forEach((raw) => {
    const value = raw && raw.trim();
    if (!value) return;

    try {
      let addr;
      let prefix;

      if (value.includes('/')) {
        [addr, prefix] = ipaddr.parseCIDR(value);
      } else {
        addr = ipaddr.parse(value);
        prefix = addr.kind() === 'ipv4' ? 32 : 128;
      }

      if (addr.kind() === 'ipv4') {
        if (prefix < 0 || prefix > 32) {
          console.error(`Invalid IPv4 prefix for entry "${value}"`);
          return;
        }
        softV4.push({ addr, prefix });
      } else if (addr.kind() === 'ipv6') {
        if (prefix < 0 || prefix > 128) {
          console.error(`Invalid IPv6 prefix for entry "${value}"`);
          return;
        }
        softV6.push({ addr, prefix });
      } else {
        console.error(`Unknown IP kind for entry "${value}"`);
      }
    } catch (e) {
      console.error(`Invalid IP/CIDR entry "${value}": ${e.message}`);
    }
  });

  return { softV4, softV6 };
};

const promoteSoftV4 = (softV4) => {
  if (!softV4.length) return [];

  // Always aggregate IPv4 /32 entries to their /24 parent,
  // keep existing broader ranges (/24, /16, /12, etc.) as is.
  const result = [];
  const parentMap = new Map();

  softV4.forEach((entry) => {
    if (entry.addr.kind() !== 'ipv4') return;

    if (entry.prefix === 32) {
      const octets = entry.addr.toString().split('.').map((o) => Number(o));
      if (octets.length !== 4 || octets.some((o) => Number.isNaN(o))) return;

      const parentPrefix = SOFT_V4_MAX_PREFIX; // /24
      const parentIpStr = `${octets[0]}.${octets[1]}.${octets[2]}.0`;
      const parentAddr = ipaddr.parse(parentIpStr);
      const key = `${parentAddr.toString()}/${parentPrefix}`;

      if (!parentMap.has(key)) {
        parentMap.set(key, { addr: parentAddr, prefix: parentPrefix });
      }
    } else {
      result.push(entry);
    }
  });

  parentMap.forEach((entry) => {
    result.push(entry);
  });

  return result;
};

const promoteSoftV6 = (softV6) => {
  if (!softV6.length) return [];

  // Always aggregate IPv6 /128 entries to their /64 parent,
  // keep existing broader ranges (/64, /48, /32, etc.) as is.
  const result = [];
  const parentMap = new Map();

  softV6.forEach((entry) => {
    if (entry.addr.kind() !== 'ipv6') return;

    if (entry.prefix === 128) {
      const parentPrefix = SOFT_V6_MAX_PREFIX; // /64
      // Calculate base network address for /64
      const bytes = entry.addr.toByteArray();
      for (let i = 8; i < 16; i += 1) {
        bytes[i] = 0;
      }
      const parentAddr = ipaddr.fromByteArray(bytes);
      const key = `${parentAddr.toString()}/${parentPrefix}`;

      if (!parentMap.has(key)) {
        parentMap.set(key, { addr: parentAddr, prefix: parentPrefix });
      }
    } else {
      result.push(entry);
    }
  });

  parentMap.forEach((entry) => {
    result.push(entry);
  });

  return result;
};

const promoteV4To16 = (entries) => {
  if (!entries.length) return [];

  const v4 = [];
  const others = [];

  entries.forEach((entry) => {
    if (entry.addr.kind() === 'ipv4') {
      v4.push(entry);
    } else {
      others.push(entry);
    }
  });

  const parentMap = new Map();

  v4.forEach((entry, index) => {
    if (entry.prefix !== 24) return;

    // Calculate base network address for /16 (first 2 octets, zero the rest)
    const bytes = entry.addr.toByteArray();
    bytes[2] = 0;
    bytes[3] = 0;
    const parentAddr = ipaddr.fromByteArray(bytes);
    const key = `${parentAddr.toString()}/16`;

    const group = parentMap.get(key) || { addr: parentAddr, prefix: 16, indexes: [] };
    group.indexes.push(index);
    parentMap.set(key, group);
  });

  const promotedParents = new Map();

  parentMap.forEach((group, key) => {
    if (group.indexes.length >= V4_SUPER_PROMO_THRESHOLD) {
      promotedParents.set(key, { addr: group.addr, prefix: group.prefix });
    }
  });

  const resultV4 = [];

  v4.forEach((entry) => {
    if (entry.prefix === 24) {
      // Calculate base network address for /16
      const bytes = entry.addr.toByteArray();
      bytes[2] = 0;
      bytes[3] = 0;
      const parentAddr = ipaddr.fromByteArray(bytes);
      const parentKey = `${parentAddr.toString()}/16`;
      if (promotedParents.has(parentKey)) {
        // covered by promoted /16
        return;
      }
    }

    resultV4.push(entry);
  });

  promotedParents.forEach((entry) => {
    resultV4.push(entry);
  });

  return [...resultV4, ...others];
};

const promoteV6To48 = (entries) => {
  if (!entries.length) return [];

  const v6 = [];
  const others = [];

  entries.forEach((entry) => {
    if (entry.addr.kind() === 'ipv6') {
      v6.push(entry);
    } else {
      others.push(entry);
    }
  });

  const parentMap = new Map();

  v6.forEach((entry, index) => {
    if (entry.prefix !== 64) return;

    // Calculate base network address for /48 (first 6 bytes, zero the rest)
    const bytes = entry.addr.toByteArray();
    for (let i = 6; i < 16; i += 1) {
      bytes[i] = 0;
    }
    const parentAddr = ipaddr.fromByteArray(bytes);
    const key = `${parentAddr.toString()}/48`;

    const group = parentMap.get(key) || { addr: parentAddr, prefix: 48, indexes: [] };
    group.indexes.push(index);
    parentMap.set(key, group);
  });

  const promotedParents = new Map();

  parentMap.forEach((group, key) => {
    if (group.indexes.length >= V6_SUPER_PROMO_THRESHOLD) {
      promotedParents.set(key, { addr: group.addr, prefix: group.prefix });
    }
  });

  const resultV6 = [];

  v6.forEach((entry) => {
    if (entry.prefix === 64) {
      // Calculate base network address for /48
      const bytes = entry.addr.toByteArray();
      for (let i = 6; i < 16; i += 1) {
        bytes[i] = 0;
      }
      const parentAddr = ipaddr.fromByteArray(bytes);
      const parentKey = `${parentAddr.toString()}/48`;
      if (promotedParents.has(parentKey)) {
        // covered by promoted /48
        return;
      }
    }

    resultV6.push(entry);
  });

  promotedParents.forEach((entry) => {
    resultV6.push(entry);
  });

  return [...resultV6, ...others];
};

// Level 3: promote /16 -> /12 (IPv4), /48 -> /32 (IPv6), same thresholds
const promoteV4To12 = (entries) => {
  if (!entries.length) return [];

  const v4 = [];
  const others = [];

  entries.forEach((entry) => {
    if (entry.addr.kind() === 'ipv4') {
      v4.push(entry);
    } else {
      others.push(entry);
    }
  });

  const parentMap = new Map();

  v4.forEach((entry, index) => {
    if (entry.prefix !== 16) return;

    const bytes = entry.addr.toByteArray();
    bytes[1] = Math.floor(bytes[1] / 16) * 16;
    bytes[2] = 0;
    bytes[3] = 0;
    const parentAddr = ipaddr.fromByteArray(bytes);
    const key = `${parentAddr.toString()}/12`;

    const group = parentMap.get(key) || { addr: parentAddr, prefix: 12, indexes: [] };
    group.indexes.push(index);
    parentMap.set(key, group);
  });

  const promotedParents = new Map();

  parentMap.forEach((group, key) => {
    if (group.indexes.length >= V4_SUPER_PROMO_THRESHOLD) {
      promotedParents.set(key, { addr: group.addr, prefix: group.prefix });
    }
  });

  const resultV4 = [];

  v4.forEach((entry) => {
    if (entry.prefix === 16) {
      const bytes = entry.addr.toByteArray();
      bytes[1] = Math.floor(bytes[1] / 16) * 16;
      bytes[2] = 0;
      bytes[3] = 0;
      const parentAddr = ipaddr.fromByteArray(bytes);
      const parentKey = `${parentAddr.toString()}/12`;
      if (promotedParents.has(parentKey)) {
        return;
      }
    }

    resultV4.push(entry);
  });

  promotedParents.forEach((entry) => {
    resultV4.push(entry);
  });

  return [...resultV4, ...others];
};

const promoteV6To32 = (entries) => {
  if (!entries.length) return [];

  const v6 = [];
  const others = [];

  entries.forEach((entry) => {
    if (entry.addr.kind() === 'ipv6') {
      v6.push(entry);
    } else {
      others.push(entry);
    }
  });

  const parentMap = new Map();

  v6.forEach((entry, index) => {
    if (entry.prefix !== 48) return;

    const bytes = entry.addr.toByteArray();
    for (let i = 4; i < 16; i += 1) {
      bytes[i] = 0;
    }
    const parentAddr = ipaddr.fromByteArray(bytes);
    const key = `${parentAddr.toString()}/32`;

    const group = parentMap.get(key) || { addr: parentAddr, prefix: 32, indexes: [] };
    group.indexes.push(index);
    parentMap.set(key, group);
  });

  const promotedParents = new Map();

  parentMap.forEach((group, key) => {
    if (group.indexes.length >= V6_SUPER_PROMO_THRESHOLD) {
      promotedParents.set(key, { addr: group.addr, prefix: group.prefix });
    }
  });

  const resultV6 = [];

  v6.forEach((entry) => {
    if (entry.prefix === 48) {
      const bytes = entry.addr.toByteArray();
      for (let i = 4; i < 16; i += 1) {
        bytes[i] = 0;
      }
      const parentAddr = ipaddr.fromByteArray(bytes);
      const parentKey = `${parentAddr.toString()}/32`;
      if (promotedParents.has(parentKey)) {
        return;
      }
    }

    resultV6.push(entry);
  });

  promotedParents.forEach((entry) => {
    resultV6.push(entry);
  });

  return [...resultV6, ...others];
};

const normalizeRanges = (entries) => {
  if (!entries.length) return [];

  const sorted = entries
    .map((e) => ({
      addr: e.addr,
      prefix: e.prefix,
    }))
    .sort((a, b) => {
      if (a.prefix !== b.prefix) return a.prefix - b.prefix;
      return a.addr.toString().localeCompare(b.addr.toString());
    });

  const result = [];

  sorted.forEach((entry) => {
    const covered = result.some(
      (existing) => entry.addr.kind() === existing.addr.kind()
        && entry.prefix >= existing.prefix
        && entry.addr.match([existing.addr, existing.prefix]),
    );

    if (!covered) {
      result.push(entry);
    }
  });

  return result;
};

const renderRange = (entry) => {
  const ipStr = entry.addr.toString();

  // For single IPs use plain form, otherwise CIDR
  if ((entry.addr.kind() === 'ipv4' && entry.prefix === 32)
    || (entry.addr.kind() === 'ipv6' && entry.prefix === 128)) {
    return ipStr;
  }

  return `${ipStr}/${entry.prefix}`;
};

const processIpEntries = (ipEntries) => {
  const { softV4, softV6 } = parseIpEntries(ipEntries);

  const promotedV4 = promoteSoftV4(softV4);
  const promotedV6 = promoteSoftV6(softV6);

  const normalizedV4 = normalizeRanges(promotedV4);
  const normalizedV6 = normalizeRanges(promotedV6);

  const level2V4 = promoteV4To16(normalizedV4);
  const level2V6 = promoteV6To48(normalizedV6);

  const normalized2V4 = normalizeRanges(level2V4);
  const normalized2V6 = normalizeRanges(level2V6);

  const level3V4 = promoteV4To12(normalized2V4);
  const level3V6 = promoteV6To32(normalized2V6);

  const finalV4 = normalizeRanges(level3V4);
  const finalV6 = normalizeRanges(level3V6);

  // Hard tier is not used yet (soft-only), so just combine soft ranges
  const finalRanges = [...finalV4, ...finalV6];

  return finalRanges;
};

const updateBotIpsMap = async () => {
  try {
    let client;
    try {
      client = await initRedis();
    } catch (error) {
      console.error('Redis not available, skipping bot IPs update:', error.message);
      return;
    }

    let ips = [];

    const redisKey = `${REDIS_KEY}:${getCurrentDateString()}`;

    try {
      ips = await client.sMembers(redisKey);
    } catch (e) {
      console.error('Failed to get bot IPs from Redis:', e.message);
      return;
    }

    if (!ips.length) {
      console.log('No bot IPs found in Redis, skipping update.');
      return;
    }

    // Collect raw entries for aggregation: main map, overflow map, and fresh IPs from Redis
    const allRawEntries = [];

    const parseMapContent = (content) => {
      content
        .split('\n')
        .map((l) => l.trim())
        .forEach((line) => {
          if (!line || line.startsWith('default')) return;
          const [key] = line.split(/\s+/);
          if (key) allRawEntries.push(key);
        });
    };

    try {
      const oldContent = await fs.readFile(BOT_IPS_MAP_PATH, 'utf8');
      parseMapContent(oldContent);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error('Failed to read existing bot_ips.map:', e.message);
      }
    }

    try {
      const overflowContent = await fs.readFile(BOT_IPS_OVERFLOW_MAP_PATH, 'utf8');
      parseMapContent(overflowContent);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error('Failed to read existing bot_ips_overflow.map:', e.message);
      }
    }

    // Add fresh IPs from Redis
    allRawEntries.push(...ips);

    // Filter out whitelisted IPs
    const filteredEntries = allRawEntries.filter((entry) => !isWhitelisted(entry));

    // Прогоняем всё через агрегатор (IPv4 /32->/24, IPv6 /128->/64, нормализация и т.д.)
    let finalRanges = processIpEntries(filteredEntries);

    // Filter out any final ranges that would include whitelisted IPs
    finalRanges = finalRanges.filter((range) => {
      const rangeStr = renderRange(range);
      return !isWhitelisted(rangeStr);
    });

    // Split: main file up to BOT_IPS_MAP_MAX_LINES, rest goes to overflow (re-aggregated)
    const totalRanges = finalRanges.length;
    let mainRanges = finalRanges;
    let overflowRanges = [];

    if (totalRanges > BOT_IPS_MAP_MAX_LINES) {
      mainRanges = finalRanges.slice(0, BOT_IPS_MAP_MAX_LINES);
      const overflowRaw = finalRanges
        .slice(BOT_IPS_MAP_MAX_LINES)
        .map((r) => renderRange(r));
      overflowRanges = processIpEntries(overflowRaw);
      overflowRanges = overflowRanges.filter((range) => {
        const rangeStr = renderRange(range);
        return !isWhitelisted(rangeStr);
      });
      console.log(
        `Bot IPs split: main ${mainRanges.length}, overflow ${overflowRanges.length} (from ${totalRanges} total)`,
      );
    }

    const buildMapContent = (ranges) => ranges
      .map((range) => renderRange(range))
      .sort()
      .map((key) => `${key} 1;\n`)
      .join('');

    const mainContent = buildMapContent(mainRanges);
    const overflowContent = buildMapContent(overflowRanges);

    await fs.writeFile(BOT_IPS_TEMP_PATH, mainContent, 'utf8');
    await fs.writeFile(BOT_IPS_OVERFLOW_TEMP_PATH, overflowContent, 'utf8');

    try {
      await execPromise('nginx -t');
    } catch (error) {
      console.error('Nginx config test failed, skipping update:', error.message);
      await fs.unlink(BOT_IPS_TEMP_PATH).catch(() => {});
      await fs.unlink(BOT_IPS_OVERFLOW_TEMP_PATH).catch(() => {});
      return;
    }

    const writeOrRename = async (tempPath, targetPath, content) => {
      try {
        await fs.rename(tempPath, targetPath);
      } catch (renameError) {
        if (renameError.code === 'EBUSY') {
          await fs.writeFile(targetPath, content, 'utf8');
          await fs.unlink(tempPath).catch(() => {});
        } else {
          await fs.unlink(tempPath).catch(() => {});
          throw renameError;
        }
      }
    };

    await writeOrRename(BOT_IPS_TEMP_PATH, BOT_IPS_MAP_PATH, mainContent);
    await writeOrRename(BOT_IPS_OVERFLOW_TEMP_PATH, BOT_IPS_OVERFLOW_MAP_PATH, overflowContent);

    // Single reload after file update to pick up new content
    try {
      await execPromise('nginx -s reload');
    } catch (error) {
      console.error('Failed to reload nginx:', error.message);
      return;
    }

    console.log(
      `Bot IPs map updated: main ${mainRanges.length}, overflow ${overflowRanges.length} (from ${ips.length} entries)`,
    );
    try {
      await client.del(redisKey);
      console.log(`Removed processed IPs from Redis key: ${redisKey}`);
    } catch (delError) {
      console.error(`Failed to delete Redis key ${redisKey}:`, delError.message);
    }
  } catch (error) {
    console.error('Error updating bot IPs map:', error.message);
  }
};

// Export functions for testing
exports.processIpEntries = processIpEntries;
exports.parseIpEntries = parseIpEntries;
exports.promoteSoftV4 = promoteSoftV4;
exports.promoteSoftV6 = promoteSoftV6;
exports.normalizeRanges = normalizeRanges;
exports.renderRange = renderRange;

exports.updateBotIpsJob = new CronJob(
  UPDATE_INTERVAL,
  updateBotIpsMap,
  null,
  false,
  null,
  null,
  false,
);
