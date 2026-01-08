import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { downloadHistory, type DownloadHistory, type NewDownloadHistory } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const downloadHistoryFields = {
  id: downloadHistory.id,
  gameId: downloadHistory.gameId,
  releaseId: downloadHistory.releaseId,
  downloadId: downloadHistory.downloadId,
  status: downloadHistory.status,
  progress: downloadHistory.progress,
  completedAt: downloadHistory.completedAt,
};

export class DownloadHistoryRepository {
  /**
   * Get all download history entries
   */
  async findAll(): Promise<DownloadHistory[]> {
    return db.select(downloadHistoryFields).from(downloadHistory).orderBy(desc(downloadHistory.id));
  }

  /**
   * Get download history entry by ID
   */
  async findById(id: number): Promise<DownloadHistory | undefined> {
    const results = await db.select(downloadHistoryFields).from(downloadHistory).where(eq(downloadHistory.id, id));
    return results[0];
  }

  /**
   * Get download history entries for a specific game
   */
  async findByGameId(gameId: number): Promise<DownloadHistory[]> {
    return db
      .select(downloadHistoryFields)
      .from(downloadHistory)
      .where(eq(downloadHistory.gameId, gameId))
      .orderBy(desc(downloadHistory.id));
  }

  /**
   * Get download history entries for a specific release
   */
  async findByReleaseId(releaseId: number): Promise<DownloadHistory[]> {
    return db
      .select(downloadHistoryFields)
      .from(downloadHistory)
      .where(eq(downloadHistory.releaseId, releaseId))
      .orderBy(desc(downloadHistory.id));
  }

  /**
   * Get download history entry by download ID
   */
  async findByDownloadId(downloadId: string): Promise<DownloadHistory | undefined> {
    const results = await db
      .select(downloadHistoryFields)
      .from(downloadHistory)
      .where(eq(downloadHistory.downloadId, downloadId));
    return results[0];
  }

  /**
   * Create a new download history entry
   */
  async create(entry: NewDownloadHistory): Promise<DownloadHistory> {
    logger.info(`Creating download history entry for game ID: ${entry.gameId}`);

    const results = await db.insert(downloadHistory).values(entry).returning();
    return results[0];
  }

  /**
   * Update a download history entry
   */
  async update(id: number, updates: Partial<NewDownloadHistory>): Promise<DownloadHistory | undefined> {
    logger.info(`Updating download history ID: ${id}`);

    const results = await db
      .update(downloadHistory)
      .set(updates)
      .where(eq(downloadHistory.id, id))
      .returning();

    return results[0];
  }

  /**
   * Update download history by download ID
   */
  async updateByDownloadId(
    downloadId: string,
    updates: Partial<NewDownloadHistory>
  ): Promise<DownloadHistory | undefined> {
    logger.info(`Updating download history for download ID: ${downloadId}`);

    const results = await db
      .update(downloadHistory)
      .set(updates)
      .where(eq(downloadHistory.downloadId, downloadId))
      .returning();

    return results[0];
  }

  /**
   * Delete a download history entry
   */
  async delete(id: number): Promise<boolean> {
    logger.info(`Deleting download history ID: ${id}`);

    const result = await db.delete(downloadHistory).where(eq(downloadHistory.id, id));
    return result.changes > 0;
  }

  /**
   * Delete all download history entries for a game
   */
  async deleteByGameId(gameId: number): Promise<number> {
    logger.info(`Deleting all download history for game ID: ${gameId}`);

    const result = await db.delete(downloadHistory).where(eq(downloadHistory.gameId, gameId));
    return result.changes;
  }

  /**
   * Delete all download history entries for a release
   */
  async deleteByReleaseId(releaseId: number): Promise<number> {
    logger.info(`Deleting all download history for release ID: ${releaseId}`);

    const result = await db.delete(downloadHistory).where(eq(downloadHistory.releaseId, releaseId));
    return result.changes;
  }
}

// Singleton instance
export const downloadHistoryRepository = new DownloadHistoryRepository();
