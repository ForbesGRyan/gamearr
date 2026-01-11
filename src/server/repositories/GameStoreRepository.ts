import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  stores,
  gameStores,
  games,
  type Store,
  type NewStore,
  type GameStore,
  type Game,
} from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const storeFields = {
  id: stores.id,
  name: stores.name,
  slug: stores.slug,
  iconUrl: stores.iconUrl,
  createdAt: stores.createdAt,
};

const gameStoreFields = {
  id: gameStores.id,
  gameId: gameStores.gameId,
  storeId: gameStores.storeId,
  storeGameId: gameStores.storeGameId,
  storeName: gameStores.storeName,
  addedAt: gameStores.addedAt,
};

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

export class GameStoreRepository {
  // ============================================
  // Store operations
  // ============================================

  /**
   * Get all stores
   */
  async getAllStores(): Promise<Store[]> {
    return db.select(storeFields).from(stores);
  }

  /**
   * Get store by slug
   */
  async getStoreBySlug(slug: string): Promise<Store | null> {
    const results = await db
      .select(storeFields)
      .from(stores)
      .where(eq(stores.slug, slug));
    return results[0] ?? null;
  }

  /**
   * Get store by name
   */
  async getStoreByName(name: string): Promise<Store | null> {
    const results = await db
      .select(storeFields)
      .from(stores)
      .where(eq(stores.name, name));
    return results[0] ?? null;
  }

  /**
   * Create a new store
   */
  async createStore(data: NewStore): Promise<Store> {
    logger.info(`Creating store: ${data.name} (${data.slug})`);

    const results = await db.insert(stores).values(data).returning();
    return results[0];
  }

  // ============================================
  // GameStore junction operations
  // ============================================

  /**
   * Get all stores for a game
   */
  async getStoresForGame(gameId: number): Promise<Store[]> {
    const results = await db
      .select(storeFields)
      .from(stores)
      .innerJoin(gameStores, eq(gameStores.storeId, stores.id))
      .where(eq(gameStores.gameId, gameId));

    // When using explicit field selection, result is flat (not nested by table)
    return results as Store[];
  }

  /**
   * Get store info for a game including storeGameId from junction table
   * Returns the data needed for API responses
   */
  async getStoreInfoForGame(gameId: number): Promise<{ name: string; slug: string; storeGameId: string | null }[]> {
    const results = await db
      .select({
        name: stores.name,
        slug: stores.slug,
        storeGameId: gameStores.storeGameId,
      })
      .from(stores)
      .innerJoin(gameStores, eq(gameStores.storeId, stores.id))
      .where(eq(gameStores.gameId, gameId));

    return results;
  }

  /**
   * Get store info for multiple games in a single query
   * Returns a Map<gameId, storeInfo[]> for efficient batch enrichment
   */
  async getStoreInfoForGames(gameIds: number[]): Promise<Map<number, { name: string; slug: string; storeGameId: string | null }[]>> {
    if (gameIds.length === 0) {
      return new Map();
    }

    const results = await db
      .select({
        gameId: gameStores.gameId,
        name: stores.name,
        slug: stores.slug,
        storeGameId: gameStores.storeGameId,
      })
      .from(stores)
      .innerJoin(gameStores, eq(gameStores.storeId, stores.id))
      .where(inArray(gameStores.gameId, gameIds));

    // Group results by gameId
    const storeMap = new Map<number, { name: string; slug: string; storeGameId: string | null }[]>();
    for (const row of results) {
      const existing = storeMap.get(row.gameId) || [];
      existing.push({
        name: row.name,
        slug: row.slug,
        storeGameId: row.storeGameId,
      });
      storeMap.set(row.gameId, existing);
    }

    return storeMap;
  }

  /**
   * Get all games for a store
   */
  async getGamesForStore(storeId: number): Promise<Game[]> {
    const results = await db
      .select(gameFields)
      .from(games)
      .innerJoin(gameStores, eq(gameStores.gameId, games.id))
      .where(eq(gameStores.storeId, storeId));

    // When using explicit field selection, result is flat (not nested by table)
    return results as Game[];
  }

  /**
   * Add a game to a store (creates junction record)
   */
  async addGameToStore(
    gameId: number,
    storeId: number,
    storeGameId?: string,
    storeName?: string
  ): Promise<GameStore> {
    logger.info(`Adding game ${gameId} to store ${storeId}`);

    const results = await db
      .insert(gameStores)
      .values({
        gameId,
        storeId,
        storeGameId,
        storeName,
      })
      .returning();

    return results[0];
  }

  /**
   * Remove a game from a store (deletes junction record)
   */
  async removeGameFromStore(gameId: number, storeId: number): Promise<void> {
    logger.info(`Removing game ${gameId} from store ${storeId}`);

    await db
      .delete(gameStores)
      .where(and(eq(gameStores.gameId, gameId), eq(gameStores.storeId, storeId)));
  }

  /**
   * Check if a game exists in a specific store by slug
   */
  async hasGameInStore(gameId: number, storeSlug: string): Promise<boolean> {
    const store = await this.getStoreBySlug(storeSlug);
    if (!store) {
      return false;
    }

    const results = await db
      .select({ id: gameStores.id })
      .from(gameStores)
      .where(and(eq(gameStores.gameId, gameId), eq(gameStores.storeId, store.id)));

    return results.length > 0;
  }

  /**
   * Get a specific game-store junction entry
   */
  async getGameStoreEntry(gameId: number, storeId: number): Promise<GameStore | null> {
    const results = await db
      .select(gameStoreFields)
      .from(gameStores)
      .where(and(eq(gameStores.gameId, gameId), eq(gameStores.storeId, storeId)));

    return results[0] ?? null;
  }

  /**
   * Update stores for a game (replaces all existing stores)
   * @param gameId - The game to update
   * @param storeNames - Array of store names to associate with the game
   */
  async setStoresForGame(gameId: number, storeNames: string[]): Promise<void> {
    logger.info(`Setting stores for game ${gameId}: ${storeNames.join(', ') || '(none)'}`);

    // Delete all existing store associations for this game
    await db.delete(gameStores).where(eq(gameStores.gameId, gameId));

    // If no stores to add, we're done
    if (storeNames.length === 0) {
      return;
    }

    // Get or create stores and add associations
    for (const storeName of storeNames) {
      // Find or create the store
      let store = await this.getStoreByName(storeName);
      if (!store) {
        // Create a slug from the name
        const slug = storeName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        store = await this.createStore({ name: storeName, slug });
      }

      // Add the junction record
      await db.insert(gameStores).values({
        gameId,
        storeId: store.id,
      });
    }
  }

  // ============================================
  // Helper for getting games with stores joined
  // ============================================

  /**
   * Get a game with all its associated stores
   */
  async getGameWithStores(gameId: number): Promise<{ game: Game; stores: Store[] } | null> {
    // First get the game
    const gameResults = await db
      .select(gameFields)
      .from(games)
      .where(eq(games.id, gameId));

    const game = gameResults[0];
    if (!game) {
      return null;
    }

    // Then get associated stores
    const storeResults = await this.getStoresForGame(gameId);

    return {
      game,
      stores: storeResults,
    };
  }
}

// Singleton instance
export const gameStoreRepository = new GameStoreRepository();
