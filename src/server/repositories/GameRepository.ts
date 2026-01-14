import { eq, desc, count, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { games, type Game, type NewGame } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const gameFields = {
  id: games.id,
  igdbId: games.igdbId,
  title: games.title,
  slug: games.slug,
  year: games.year,
  platform: games.platform,
  store: games.store,
  steamName: games.steamName,
  monitored: games.monitored,
  status: games.status,
  coverUrl: games.coverUrl,
  folderPath: games.folderPath,
  libraryId: games.libraryId,
  summary: games.summary,
  genres: games.genres,
  totalRating: games.totalRating,
  developer: games.developer,
  publisher: games.publisher,
  gameModes: games.gameModes,
  similarGames: games.similarGames,
  installedVersion: games.installedVersion,
  installedQuality: games.installedQuality,
  latestVersion: games.latestVersion,
  updatePolicy: games.updatePolicy,
  lastUpdateCheck: games.lastUpdateCheck,
  updateAvailable: games.updateAvailable,
  addedAt: games.addedAt,
};

// Minimal fields for list views and status checks
const gameMinimalFields = {
  id: games.id,
  igdbId: games.igdbId,
  title: games.title,
  slug: games.slug,
  year: games.year,
  status: games.status,
  monitored: games.monitored,
  coverUrl: games.coverUrl,
  libraryId: games.libraryId,
};

export interface GameStats {
  totalGames: number;
  wantedGames: number;
  downloadingGames: number;
  downloadedGames: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export class GameRepository {
  /**
   * Get all games (non-paginated, for internal use)
   */
  async findAll(): Promise<Game[]> {
    return db.select(gameFields).from(games).orderBy(desc(games.addedAt));
  }

  /**
   * Get games with pagination
   */
  async findAllPaginated(params: PaginationParams = {}): Promise<PaginatedResult<Game>> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    const [items, totalResult] = await Promise.all([
      db.select(gameFields).from(games).orderBy(desc(games.addedAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(games),
    ]);

    return {
      items,
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  /**
   * Get game by ID
   */
  async findById(id: number): Promise<Game | undefined> {
    const results = await db.select(gameFields).from(games).where(eq(games.id, id));
    return results[0];
  }

  /**
   * Get game by IGDB ID
   */
  async findByIgdbId(igdbId: number): Promise<Game | undefined> {
    const results = await db
      .select(gameFields)
      .from(games)
      .where(eq(games.igdbId, igdbId));
    return results[0];
  }

  /**
   * Get games by multiple IGDB IDs (batch lookup)
   */
  async findByIgdbIds(igdbIds: number[]): Promise<Game[]> {
    if (igdbIds.length === 0) return [];
    return db
      .select(gameFields)
      .from(games)
      .where(inArray(games.igdbId, igdbIds));
  }

  /**
   * Get games by slug (may return multiple if same title exists for different platforms)
   */
  async findBySlug(slug: string): Promise<Game[]> {
    return db
      .select(gameFields)
      .from(games)
      .where(eq(games.slug, slug));
  }

  /**
   * Get all monitored games
   */
  async findMonitored(): Promise<Game[]> {
    return db
      .select(gameFields)
      .from(games)
      .where(eq(games.monitored, true))
      .orderBy(desc(games.addedAt));
  }

  /**
   * Get games by status
   */
  async findByStatus(status: 'wanted' | 'downloading' | 'downloaded'): Promise<Game[]> {
    return db
      .select(gameFields)
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
   * Batch update game status for multiple games
   */
  async batchUpdateStatus(
    gameIds: number[],
    status: 'wanted' | 'downloading' | 'downloaded'
  ): Promise<void> {
    if (gameIds.length === 0) return;

    logger.info(`Batch updating ${gameIds.length} games to status: ${status}`);
    await db
      .update(games)
      .set({ status })
      .where(inArray(games.id, gameIds));
  }

  /**
   * Find multiple games by their IDs in a single query
   * Returns a Map<gameId, Game> for efficient lookup
   */
  async findByIds(ids: number[]): Promise<Map<number, Game>> {
    if (ids.length === 0) return new Map();

    const results = await db
      .select(gameFields)
      .from(games)
      .where(inArray(games.id, ids));

    return new Map(results.map((game) => [game.id, game]));
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

  /**
   * Get total count of games (useful for health checks)
   */
  async count(): Promise<number> {
    const result = await db.select({ count: count() }).from(games);
    return result[0]?.count ?? 0;
  }

  /**
   * Get game statistics by status
   * Uses SQL GROUP BY for efficient aggregation at database level
   */
  async getStats(): Promise<GameStats> {
    // Use SQL aggregation instead of loading all games into memory
    const statusCounts = await db
      .select({
        status: games.status,
        count: count(),
      })
      .from(games)
      .groupBy(games.status);

    // Build stats from aggregated results
    const stats: GameStats = {
      totalGames: 0,
      wantedGames: 0,
      downloadingGames: 0,
      downloadedGames: 0,
    };

    for (const row of statusCounts) {
      stats.totalGames += row.count;
      if (row.status === 'wanted') {
        stats.wantedGames = row.count;
      } else if (row.status === 'downloading') {
        stats.downloadingGames = row.count;
      } else if (row.status === 'downloaded') {
        stats.downloadedGames = row.count;
      }
    }

    return stats;
  }
}

// Singleton instance
export const gameRepository = new GameRepository();
