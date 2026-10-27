import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// BullMQ workers require maxRetriesPerRequest: null (uses blocking commands)
export const bullmqRedis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => console.error('Redis error:', err));
bullmqRedis.on('error', (err) => console.error('BullMQ Redis error:', err));
