import { eq, and, gt, lt } from 'drizzle-orm';
import { db } from '../db';
import { apiCache, type ApiCache } from '../db/schema';
import { logger } from '../utils/logger';

export class CacheRepository {
  /**
   * Get cache entry by key (only if not expired)
   */
  async get(cacheKey: string): Promise<ApiCache | null> {
    const now = new Date();
    const results = await db
      .select()
      .from(apiCache)
      .where(and(
        eq(apiCache.cacheKey, cacheKey),
        gt(apiCache.expiresAt, now)
      ))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get cache entry by key (regardless of expiry, for fallback on errors)
   */
  async getStale(cacheKey: string): Promise<ApiCache | null> {
    const results = await db
      .select()
      .from(apiCache)
      .where(eq(apiCache.cacheKey, cacheKey))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Set cache entry (upsert)
   */
  async set(entry: {
    cacheKey: string;
    cacheType: 'trending_games' | 'top_torrents' | 'popularity_types';
    data: unknown;
    ttlMinutes: number;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + entry.ttlMinutes * 60 * 1000);
    const dataJson = JSON.stringify(entry.data);

    await db
      .insert(apiCache)
      .values({
        cacheKey: entry.cacheKey,
        cacheType: entry.cacheType,
        data: dataJson,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: apiCache.cacheKey,
        set: {
          data: dataJson,
          expiresAt,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Delete expired cache entries
   */
  async deleteExpired(): Promise<void> {
    const now = new Date();
    await db
      .delete(apiCache)
      .where(lt(apiCache.expiresAt, now));
  }

  /**
   * Delete all cache entries
   */
  async deleteAll(): Promise<void> {
    await db.delete(apiCache);
  }
}

// Singleton instance
export const cacheRepository = new CacheRepository();
