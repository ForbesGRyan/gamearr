import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { games, type Game, type NewGame } from '../db/schema';
import { logger } from '../utils/logger';

export class GameRepository {
  /**
   * Get all games
   */
  async findAll(): Promise<Game[]> {
    return db.select().from(games).orderBy(desc(games.addedAt));
  }

  /**
   * Get game by ID
   */
  async findById(id: number): Promise<Game | undefined> {
    const results = await db.select().from(games).where(eq(games.id, id));
    return results[0];
  }

  /**
   * Get game by IGDB ID
   */
  async findByIgdbId(igdbId: number): Promise<Game | undefined> {
    const results = await db
      .select()
      .from(games)
      .where(eq(games.igdbId, igdbId));
    return results[0];
  }

  /**
   * Get all monitored games
   */
  async findMonitored(): Promise<Game[]> {
    return db
      .select()
      .from(games)
      .where(eq(games.monitored, true))
      .orderBy(desc(games.addedAt));
  }

  /**
   * Get games by status
   */
  async findByStatus(status: 'wanted' | 'downloading' | 'downloaded'): Promise<Game[]> {
    return db
      .select()
      .from(games)
      .where(eq(games.status, status))
      .orderBy(desc(games.addedAt));
  }

  /**
   * Create a new game
   */
  async create(game: NewGame): Promise<Game> {
    logger.info(`Creating game: ${game.title}`);

    const results = await db.insert(games).values(game).returning();
    return results[0];
  }

  /**
   * Update a game
   */
  async update(id: number, updates: Partial<NewGame>): Promise<Game | undefined> {
    logger.info(`Updating game ID: ${id}`);

    const results = await db
      .update(games)
      .set(updates)
      .where(eq(games.id, id))
      .returning();

    return results[0];
  }

  /**
   * Delete a game
   */
  async delete(id: number): Promise<boolean> {
    logger.info(`Deleting game ID: ${id}`);

    const result = await db.delete(games).where(eq(games.id, id));
    return result.changes > 0;
  }

  /**
   * Check if game exists by IGDB ID
   */
  async existsByIgdbId(igdbId: number): Promise<boolean> {
    const game = await this.findByIgdbId(igdbId);
    return !!game;
  }
}

// Singleton instance
export const gameRepository = new GameRepository();
