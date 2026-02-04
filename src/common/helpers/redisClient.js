const redis = require('redis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_DB = process.env.REDIS_DB || 11;
const { REDIS_PASSWORD } = process.env;

let redisClient = null;

const getRedisClient = async () => {
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

module.exports = {
  getRedisClient,
};
