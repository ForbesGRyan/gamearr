import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { downloadHistory, type DownloadHistory, type NewDownloadHistory } from '../db/schema';
import { logger } from '../utils/logger';

type Db = typeof db;

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
  // Defaults to the shared singleton; tests inject an isolated in-memory DB.
  constructor(private readonly database: Db = db) {}

  /**
   * Build the stable, unique download_history key for a release.
   * The torrent hash / nzo_id isn't known at grab time (it's discovered
   * asynchronously), so we key history rows by release id instead.
   */
  static downloadIdForRelease(releaseId: number): string {
    return `release-${releaseId}`;
  }

  /**
   * Get all download history entries
   */
  async findAll(): Promise<DownloadHistory[]> {
    return this.database.select(downloadHistoryFields).from(downloadHistory).orderBy(desc(downloadHistory.id));
  }

  /**
   * Get download history entry by ID
   */
  async findById(id: number): Promise<DownloadHistory | undefined> {
    const results = await this.database.select(downloadHistoryFields).from(downloadHistory).where(eq(downloadHistory.id, id));
    return results[0];
  }

  /**
   * Get download history entries for a specific game
   */
  async findByGameId(gameId: number): Promise<DownloadHistory[]> {
    return this.database
      .select(downloadHistoryFields)
      .from(downloadHistory)
      .where(eq(downloadHistory.gameId, gameId))
      .orderBy(desc(downloadHistory.id));
  }

  /**
   * Get download history entries for a specific release
   */
  async findByReleaseId(releaseId: number): Promise<DownloadHistory[]> {
    return this.database
      .select(downloadHistoryFields)
      .from(downloadHistory)
      .where(eq(downloadHistory.releaseId, releaseId))
      .orderBy(desc(downloadHistory.id));
  }

  /**
   * Get download history entry by download ID
   */
  async findByDownloadId(downloadId: string): Promise<DownloadHistory | undefined> {
    const results = await this.database
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

    const results = await this.database.insert(downloadHistory).values(entry).returning();
    return results[0];
  }

  /**
   * Insert or update the single history row for a release.
   *
   * Each grab creates exactly one release row, so one history row per release
   * tracks that download's lifecycle (status / progress / completion). Status
   * sync jobs call this again to advance the row in place. `progress` and
   * `completedAt` are only overwritten when explicitly provided.
   */
  async upsertForRelease(entry: {
    gameId: number;
    releaseId: number;
    status: string;
    progress?: number;
    completedAt?: Date | null;
  }): Promise<DownloadHistory> {
    const downloadId = DownloadHistoryRepository.downloadIdForRelease(entry.releaseId);
    const existing = await this.findByDownloadId(downloadId);

    if (existing) {
      const updates: Partial<NewDownloadHistory> = { status: entry.status };
      if (entry.progress !== undefined) updates.progress = entry.progress;
      if (entry.completedAt !== undefined) updates.completedAt = entry.completedAt;

      const results = await this.database
        .update(downloadHistory)
        .set(updates)
        .where(eq(downloadHistory.id, existing.id))
        .returning();
      return results[0];
    }

    const results = await this.database
      .insert(downloadHistory)
      .values({
        gameId: entry.gameId,
        releaseId: entry.releaseId,
        downloadId,
        status: entry.status,
        progress: entry.progress ?? 0,
        completedAt: entry.completedAt ?? null,
      })
      .returning();
    return results[0];
  }

  /**
   * Update a download history entry
   */
  async update(id: number, updates: Partial<NewDownloadHistory>): Promise<DownloadHistory | undefined> {
    logger.info(`Updating download history ID: ${id}`);

    const results = await this.database
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

    const results = await this.database
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

    const result = await this.database.delete(downloadHistory).where(eq(downloadHistory.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Delete all download history entries for a game
   */
  async deleteByGameId(gameId: number): Promise<number> {
    logger.info(`Deleting all download history for game ID: ${gameId}`);

    const result = await this.database.delete(downloadHistory).where(eq(downloadHistory.gameId, gameId)).returning();
    return result.length;
  }

  /**
   * Delete all download history entries for a release
   */
  async deleteByReleaseId(releaseId: number): Promise<number> {
    logger.info(`Deleting all download history for release ID: ${releaseId}`);

    const result = await this.database.delete(downloadHistory).where(eq(downloadHistory.releaseId, releaseId)).returning();
    return result.length;
  }
}

// Singleton instance
export const downloadHistoryRepository = new DownloadHistoryRepository();
