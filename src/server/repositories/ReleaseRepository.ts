import { eq, desc, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { releases, type Release, type NewRelease } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const releaseFields = {
  id: releases.id,
  gameId: releases.gameId,
  title: releases.title,
  size: releases.size,
  seeders: releases.seeders,
  downloadUrl: releases.downloadUrl,
  indexer: releases.indexer,
  quality: releases.quality,
  torrentHash: releases.torrentHash,
  grabbedAt: releases.grabbedAt,
  status: releases.status,
};

export class ReleaseRepository {
  /**
   * Get all releases
   */
  async findAll(): Promise<Release[]> {
    return db.select(releaseFields).from(releases).orderBy(desc(releases.grabbedAt));
  }

  /**
   * Get release by ID
   */
  async findById(id: number): Promise<Release | undefined> {
    const results = await db.select(releaseFields).from(releases).where(eq(releases.id, id));
    return results[0];
  }

  /**
   * Get releases for a specific game
   */
  async findByGameId(gameId: number): Promise<Release[]> {
    return db
      .select(releaseFields)
      .from(releases)
      .where(eq(releases.gameId, gameId))
      .orderBy(desc(releases.grabbedAt));
  }

  /**
   * Get releases by status
   */
  async findByStatus(status: 'pending' | 'downloading' | 'completed' | 'failed'): Promise<Release[]> {
    return db
      .select(releaseFields)
      .from(releases)
      .where(eq(releases.status, status))
      .orderBy(desc(releases.grabbedAt));
  }

  /**
   * Get active downloads (pending or downloading)
   */
  async findActiveDownloads(): Promise<Release[]> {
    return db
      .select(releaseFields)
      .from(releases)
      .where(
        and(
          eq(releases.status, 'downloading')
        )
      )
      .orderBy(desc(releases.grabbedAt));
  }

  /**
   * Create a new release
   */
  async create(release: NewRelease): Promise<Release> {
    logger.info(`Creating release: ${release.title}`);

    const results = await db.insert(releases).values(release).returning();
    return results[0];
  }

  /**
   * Update a release
   */
  async update(id: number, updates: Partial<NewRelease>): Promise<Release | undefined> {
    logger.info(`Updating release ID: ${id}`);

    const results = await db
      .update(releases)
      .set(updates)
      .where(eq(releases.id, id))
      .returning();

    return results[0];
  }

  /**
   * Update release status
   */
  async updateStatus(
    id: number,
    status: 'pending' | 'downloading' | 'completed' | 'failed'
  ): Promise<Release | undefined> {
    return this.update(id, { status });
  }

  /**
   * Batch update release statuses
   * Groups updates by status and performs one query per status
   */
  async batchUpdateStatus(
    updates: Array<{ id: number; status: 'pending' | 'downloading' | 'completed' | 'failed' }>
  ): Promise<void> {
    if (updates.length === 0) return;

    // Group updates by status
    const byStatus = new Map<string, number[]>();
    for (const update of updates) {
      const ids = byStatus.get(update.status) || [];
      ids.push(update.id);
      byStatus.set(update.status, ids);
    }

    // Perform one update query per status group
    for (const [status, ids] of byStatus) {
      logger.info(`Batch updating ${ids.length} releases to status: ${status}`);
      await db
        .update(releases)
        .set({ status: status as 'pending' | 'downloading' | 'completed' | 'failed' })
        .where(inArray(releases.id, ids));
    }
  }

  /**
   * Delete a release
   */
  async delete(id: number): Promise<boolean> {
    logger.info(`Deleting release ID: ${id}`);

    const result = await db.delete(releases).where(eq(releases.id, id));
    return result.changes > 0;
  }

  /**
   * Batch delete multiple releases by their IDs
   */
  async batchDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    logger.info(`Batch deleting ${ids.length} releases`);
    const result = await db.delete(releases).where(inArray(releases.id, ids));
    return result.changes;
  }

  /**
   * Delete all releases for a game
   */
  async deleteByGameId(gameId: number): Promise<number> {
    logger.info(`Deleting all releases for game ID: ${gameId}`);

    const result = await db.delete(releases).where(eq(releases.gameId, gameId));
    return result.changes;
  }

  /**
   * Get most recent grabbed release for a game
   */
  async findLatestByGameId(gameId: number): Promise<Release | undefined> {
    const results = await db
      .select(releaseFields)
      .from(releases)
      .where(eq(releases.gameId, gameId))
      .orderBy(desc(releases.grabbedAt))
      .limit(1);

    return results[0];
  }

  /**
   * Find release by torrent hash
   */
  async findByTorrentHash(hash: string): Promise<Release | undefined> {
    const results = await db
      .select(releaseFields)
      .from(releases)
      .where(eq(releases.torrentHash, hash))
      .limit(1);

    return results[0];
  }
}

// Singleton instance
export const releaseRepository = new ReleaseRepository();
