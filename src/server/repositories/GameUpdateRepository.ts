import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { gameUpdates, type GameUpdate, type NewGameUpdate } from '../db/schema';
import { logger } from '../utils/logger';

export class GameUpdateRepository {
  /**
   * Get all updates
   */
  async findAll(): Promise<GameUpdate[]> {
    return db.select().from(gameUpdates).orderBy(desc(gameUpdates.detectedAt));
  }

  /**
   * Get updates for a specific game
   */
  async findByGameId(gameId: number): Promise<GameUpdate[]> {
    return db
      .select()
      .from(gameUpdates)
      .where(eq(gameUpdates.gameId, gameId))
      .orderBy(desc(gameUpdates.detectedAt));
  }

  /**
   * Get all pending updates
   */
  async findPending(): Promise<GameUpdate[]> {
    return db
      .select()
      .from(gameUpdates)
      .where(eq(gameUpdates.status, 'pending'))
      .orderBy(desc(gameUpdates.detectedAt));
  }

  /**
   * Get pending updates for a specific game
   */
  async findPendingByGameId(gameId: number): Promise<GameUpdate[]> {
    return db
      .select()
      .from(gameUpdates)
      .where(
        and(
          eq(gameUpdates.gameId, gameId),
          eq(gameUpdates.status, 'pending')
        )
      )
      .orderBy(desc(gameUpdates.detectedAt));
  }

  /**
   * Find update by download URL
   */
  async findByDownloadUrl(downloadUrl: string): Promise<GameUpdate | undefined> {
    const results = await db
      .select()
      .from(gameUpdates)
      .where(eq(gameUpdates.downloadUrl, downloadUrl));
    return results[0];
  }

  /**
   * Find update by title and game ID
   */
  async findByTitleAndGameId(title: string, gameId: number): Promise<GameUpdate | undefined> {
    const results = await db
      .select()
      .from(gameUpdates)
      .where(
        and(
          eq(gameUpdates.title, title),
          eq(gameUpdates.gameId, gameId)
        )
      );
    return results[0];
  }

  /**
   * Create a new update
   */
  async create(update: NewGameUpdate): Promise<GameUpdate> {
    logger.info(`Creating game update: ${update.title} (type: ${update.updateType})`);

    const results = await db.insert(gameUpdates).values(update).returning();
    return results[0];
  }

  /**
   * Update status
   */
  async updateStatus(
    id: number,
    status: 'pending' | 'grabbed' | 'dismissed'
  ): Promise<GameUpdate | undefined> {
    logger.info(`Updating game update ID ${id} status to: ${status}`);

    const results = await db
      .update(gameUpdates)
      .set({ status })
      .where(eq(gameUpdates.id, id))
      .returning();

    return results[0];
  }

  /**
   * Delete an update by ID
   */
  async delete(id: number): Promise<boolean> {
    logger.info(`Deleting game update ID: ${id}`);

    const result = await db.delete(gameUpdates).where(eq(gameUpdates.id, id));
    return result.changes > 0;
  }

  /**
   * Delete all updates for a game
   */
  async deleteByGameId(gameId: number): Promise<number> {
    logger.info(`Deleting all updates for game ID: ${gameId}`);

    const result = await db.delete(gameUpdates).where(eq(gameUpdates.gameId, gameId));
    return result.changes;
  }

  /**
   * Get update by ID
   */
  async findById(id: number): Promise<GameUpdate | undefined> {
    const results = await db
      .select()
      .from(gameUpdates)
      .where(eq(gameUpdates.id, id));
    return results[0];
  }
}

// Singleton instance
export const gameUpdateRepository = new GameUpdateRepository();
