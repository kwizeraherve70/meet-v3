import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

/**
 * Initialize Upstash Redis client
 * Uses REST API for serverless compatibility
 */
export function initializeUpstashRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in environment variables'
    );
  }

  try {
    redisClient = new Redis({
      url: upstashUrl,
      token: upstashToken,
    });

    console.log('[UPSTASH] Redis client initialized');
    return redisClient;
  } catch (error) {
    console.error('[UPSTASH] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Get Upstash Redis client instance
 */
export function getUpstashRedis(): Redis {
  if (!redisClient) {
    throw new Error('Upstash Redis client not initialized. Call initializeUpstashRedis() first.');
  }
  return redisClient;
}

/**
 * Check if Upstash Redis is available
 */
export function isUpstashAvailable(): boolean {
  return redisClient !== null;
}

/**
 * Disconnect Upstash client
 * Note: Upstash REST API doesn't require explicit disconnection
 */
export async function disconnectUpstash(): Promise<void> {
  redisClient = null;
  console.log('[UPSTASH] Client reset');
}
