import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { gameFolders, type GameFolder, type NewGameFolder } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const gameFolderFields = {
  id: gameFolders.id,
  gameId: gameFolders.gameId,
  folderPath: gameFolders.folderPath,
  version: gameFolders.version,
  quality: gameFolders.quality,
  isPrimary: gameFolders.isPrimary,
  addedAt: gameFolders.addedAt,
};

export class GameFolderRepository {
  /**
   * Get all folders for a game
   */
  async getFoldersForGame(gameId: number): Promise<GameFolder[]> {
    return db
      .select(gameFolderFields)
      .from(gameFolders)
      .where(eq(gameFolders.gameId, gameId))
      .orderBy(gameFolders.addedAt);
  }

  /**
   * Get folders for multiple games in a single query
   * Returns a Map<gameId, folders[]> for efficient batch enrichment
   */
  async getFoldersForGames(gameIds: number[]): Promise<Map<number, GameFolder[]>> {
    if (gameIds.length === 0) {
      return new Map();
    }

    const results = await db
      .select(gameFolderFields)
      .from(gameFolders)
      .where(inArray(gameFolders.gameId, gameIds))
      .orderBy(gameFolders.addedAt);

    // Group results by gameId
    const folderMap = new Map<number, GameFolder[]>();
    for (const row of results) {
      const existing = folderMap.get(row.gameId) || [];
      existing.push(row);
      folderMap.set(row.gameId, existing);
    }

    return folderMap;
  }

  /**
   * Get a folder by ID
   */
  async getFolderById(folderId: number): Promise<GameFolder | null> {
    const results = await db
      .select(gameFolderFields)
      .from(gameFolders)
      .where(eq(gameFolders.id, folderId));
    return results[0] ?? null;
  }

  /**
   * Get a folder by path
   */
  async getFolderByPath(folderPath: string): Promise<GameFolder | null> {
    const results = await db
      .select(gameFolderFields)
      .from(gameFolders)
      .where(eq(gameFolders.folderPath, folderPath));
    return results[0] ?? null;
  }

  /**
   * Get the primary folder for a game
   */
  async getPrimaryFolder(gameId: number): Promise<GameFolder | null> {
    const results = await db
      .select(gameFolderFields)
      .from(gameFolders)
      .where(and(eq(gameFolders.gameId, gameId), eq(gameFolders.isPrimary, true)));
    return results[0] ?? null;
  }

  /**
   * Add a new folder to a game
   */
  async addFolder(
    gameId: number,
    folderPath: string,
    options?: {
      version?: string;
      quality?: string;
      isPrimary?: boolean;
    }
  ): Promise<GameFolder> {
    logger.info(`Adding folder for game ${gameId}: ${folderPath}`);

    // Check if this is the first folder for the game
    const existingFolders = await this.getFoldersForGame(gameId);
    const isFirst = existingFolders.length === 0;

    // If this should be primary, unset other primary folders first
    const shouldBePrimary = options?.isPrimary ?? isFirst;
    if (shouldBePrimary && !isFirst) {
      await this.clearPrimaryForGame(gameId);
    }

    const results = await db
      .insert(gameFolders)
      .values({
        gameId,
        folderPath,
        version: options?.version,
        quality: options?.quality,
        isPrimary: shouldBePrimary,
      })
      .returning();

    return results[0];
  }

  /**
   * Update a folder's metadata
   */
  async updateFolder(
    folderId: number,
    updates: {
      version?: string;
      quality?: string;
    }
  ): Promise<GameFolder | null> {
    logger.info(`Updating folder ${folderId}`);

    const results = await db
      .update(gameFolders)
      .set(updates)
      .where(eq(gameFolders.id, folderId))
      .returning();

    return results[0] ?? null;
  }

  /**
   * Remove a folder
   */
  async removeFolder(folderId: number): Promise<void> {
    logger.info(`Removing folder ${folderId}`);

    // Get folder info first to check if it's primary
    const folder = await this.getFolderById(folderId);
    if (!folder) return;

    await db.delete(gameFolders).where(eq(gameFolders.id, folderId));

    // If removed folder was primary, set another one as primary
    if (folder.isPrimary) {
      const remainingFolders = await this.getFoldersForGame(folder.gameId);
      if (remainingFolders.length > 0) {
        await this.setPrimaryFolder(folder.gameId, remainingFolders[0].id);
      }
    }
  }

  /**
   * Set a folder as the primary folder for a game
   */
  async setPrimaryFolder(gameId: number, folderId: number): Promise<void> {
    logger.info(`Setting folder ${folderId} as primary for game ${gameId}`);

    // Clear existing primary
    await this.clearPrimaryForGame(gameId);

    // Set new primary
    await db
      .update(gameFolders)
      .set({ isPrimary: true })
      .where(and(eq(gameFolders.id, folderId), eq(gameFolders.gameId, gameId)));
  }

  /**
   * Clear primary flag for all folders of a game
   */
  private async clearPrimaryForGame(gameId: number): Promise<void> {
    await db
      .update(gameFolders)
      .set({ isPrimary: false })
      .where(eq(gameFolders.gameId, gameId));
  }

  /**
   * Check if a folder path already exists
   */
  async folderPathExists(folderPath: string): Promise<boolean> {
    const results = await db
      .select({ id: gameFolders.id })
      .from(gameFolders)
      .where(eq(gameFolders.folderPath, folderPath));
    return results.length > 0;
  }
}

// Singleton instance
export const gameFolderRepository = new GameFolderRepository();
