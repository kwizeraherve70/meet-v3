import { getUpstashRedis, isUpstashAvailable } from '../config/upstash.config.js';

/**
 * Cache service for managing Upstash Redis operations
 * 
 * CORRECTED VERSION: Upstash DOES auto-serialize (no manual JSON.stringify/parse needed)
 * Your logs confirmed: Upstash returns objects directly, not strings
 */
export class CacheService {
  private static instance: CacheService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Set value in cache with optional TTL (in seconds)
   * Upstash handles serialization automatically
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!isUpstashAvailable()) {
      console.warn('[CACHE] Upstash not available, skipping SET');
      return;
    }

    try {
      const client = getUpstashRedis();

      // NO JSON.stringify - Upstash handles it automatically
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, value);
      } else {
        await client.set(key, value);
      }

      console.log(`[CACHE] SET: ${key}${ttlSeconds ? ` (TTL: ${ttlSeconds}s)` : ''}`);
    } catch (error) {
      console.error(`[CACHE] Error setting key ${key}:`, error);
    }
  }

  /**
   * Get value from cache
   * Upstash returns deserialized objects automatically
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isUpstashAvailable()) {
      return null;
    }

    try {
      const client = getUpstashRedis();
      const value = await client.get<T>(key);

      if (value !== null) {
        console.log(`[CACHE] HIT: ${key}`);
        // Upstash already deserialized - return as-is
        return value;
      }

      console.log(`[CACHE] MISS: ${key}`);
      return null;
    } catch (error) {
      console.error(`[CACHE] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    if (!isUpstashAvailable()) {
      return;
    }

    try {
      const client = getUpstashRedis();
      await client.del(key);
      console.log(`[CACHE] DELETE: ${key}`);
    } catch (error) {
      console.error(`[CACHE] Error deleting key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys from cache
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (!isUpstashAvailable() || keys.length === 0) {
      return;
    }

    try {
      const client = getUpstashRedis();
      if (keys.length === 1) {
        await client.del(keys[0]);
      } else {
        await client.del(...keys);
      }
      console.log(`[CACHE] DELETE MANY: ${keys.join(', ')}`);
    } catch (error) {
      console.error(`[CACHE] Error deleting keys:`, error);
    }
  }

  /**
   * Clear all cache entries (use with caution!)
   */
  async flushAll(): Promise<void> {
    if (!isUpstashAvailable()) {
      return;
    }

    try {
      const client = getUpstashRedis();
      await client.flushdb();
      console.log('[CACHE] FLUSH ALL');
    } catch (error) {
      console.error('[CACHE] Error flushing cache:', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!isUpstashAvailable()) {
      return false;
    }

    try {
      const client = getUpstashRedis();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[CACHE] Error checking key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set (get if exists, else set and return)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFn();

    // Store in cache
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Increment counter (useful for rate limiting, stats)
   */
  async increment(key: string, increment: number = 1): Promise<number> {
    if (!isUpstashAvailable()) {
      return 0;
    }

    try {
      const client = getUpstashRedis();
      const result = await client.incrby(key, increment);
      return result;
    } catch (error) {
      console.error(`[CACHE] Error incrementing key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Set value with expiration only if key doesn't exist
   */
  async setIfNotExists<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!isUpstashAvailable()) {
      return false;
    }

    try {
      const client = getUpstashRedis();

      // Upstash handles serialization
      if (ttlSeconds) {
        const result = await client.set(key, value, {
          nx: true,
          ex: ttlSeconds,
        } as any);
        return result !== null;
      } else {
        const result = await client.set(key, value, {
          nx: true,
        } as any);
        return result !== null;
      }
    } catch (error) {
      console.error(`[CACHE] Error setting key if not exists ${key}:`, error);
      return false;
    }
  }

  /**
   * Scan for keys matching a pattern and delete them
   * Useful for cleanup operations
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!isUpstashAvailable()) {
      return 0;
    }

    try {
      const client = getUpstashRedis();
      
      // Get all keys matching pattern
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        console.log(`[CACHE] No keys found matching pattern: ${pattern}`);
        return 0;
      }

      // Delete all matching keys
      await this.deleteMany(keys);
      console.log(`[CACHE] Deleted ${keys.length} keys matching pattern: ${pattern}`);
      
      return keys.length;
    } catch (error) {
      console.error(`[CACHE] Error deleting pattern ${pattern}:`, error);
      return 0;
    }
  }
}

/**
 * Get cache service instance (singleton)
 */
export const cache = CacheService.getInstance();