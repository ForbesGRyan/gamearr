import { eq, desc, isNull, isNotNull, and } from 'drizzle-orm';
import { db } from '../db';
import { libraryFiles, type LibraryFile, type NewLibraryFile } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const libraryFileFields = {
  id: libraryFiles.id,
  folderPath: libraryFiles.folderPath,
  parsedTitle: libraryFiles.parsedTitle,
  parsedYear: libraryFiles.parsedYear,
  matchedGameId: libraryFiles.matchedGameId,
  libraryId: libraryFiles.libraryId,
  ignored: libraryFiles.ignored,
  scannedAt: libraryFiles.scannedAt,
};

export class LibraryFileRepository {
  /**
   * Get all library files
   */
  async findAll(): Promise<LibraryFile[]> {
    return db.select(libraryFileFields).from(libraryFiles).orderBy(desc(libraryFiles.scannedAt));
  }

  /**
   * Get library files by library ID
   */
  async findByLibraryId(libraryId: number): Promise<LibraryFile[]> {
    return db
      .select(libraryFileFields)
      .from(libraryFiles)
      .where(eq(libraryFiles.libraryId, libraryId))
      .orderBy(desc(libraryFiles.scannedAt));
  }

  /**
   * Get library file by folder path
   */
  async findByPath(folderPath: string): Promise<LibraryFile | undefined> {
    const results = await db
      .select(libraryFileFields)
      .from(libraryFiles)
      .where(eq(libraryFiles.folderPath, folderPath));
    return results[0];
  }

  /**
   * Get unmatched library files (excluding ignored)
   */
  async findUnmatched(): Promise<LibraryFile[]> {
    return db
      .select(libraryFileFields)
      .from(libraryFiles)
      .where(and(eq(libraryFiles.ignored, false), isNull(libraryFiles.matchedGameId)))
      .orderBy(desc(libraryFiles.scannedAt));
  }

  /**
   * Get ignored library files
   */
  async findIgnored(): Promise<LibraryFile[]> {
    return db
      .select(libraryFileFields)
      .from(libraryFiles)
      .where(eq(libraryFiles.ignored, true))
      .orderBy(desc(libraryFiles.scannedAt));
  }

  /**
   * Get matched library files
   */
  async findMatched(): Promise<LibraryFile[]> {
    return db
      .select(libraryFileFields)
      .from(libraryFiles)
      .where(isNotNull(libraryFiles.matchedGameId))
      .orderBy(desc(libraryFiles.scannedAt));
  }

  /**
   * Create or update a library file
   */
  async upsert(file: NewLibraryFile): Promise<LibraryFile> {
    logger.info(`Upserting library file: ${file.folderPath}`);

    // Check if exists
    const existing = await this.findByPath(file.folderPath);

    if (existing) {
      // Update existing
      const results = await db
        .update(libraryFiles)
        .set({
          ...file,
          scannedAt: new Date(),
        })
        .where(eq(libraryFiles.folderPath, file.folderPath))
        .returning();
      return results[0];
    } else {
      // Create new
      const results = await db.insert(libraryFiles).values(file).returning();
      return results[0];
    }
  }

  /**
   * Match a library file to a game
   */
  async matchToGame(folderPath: string, gameId: number): Promise<LibraryFile | undefined> {
    logger.info(`Matching library file ${folderPath} to game ID ${gameId}`);

    const results = await db
      .update(libraryFiles)
      .set({ matchedGameId: gameId })
      .where(eq(libraryFiles.folderPath, folderPath))
      .returning();

    return results[0];
  }

  /**
   * Unmatch a library file
   */
  async unmatch(folderPath: string): Promise<LibraryFile | undefined> {
    logger.info(`Unmatching library file ${folderPath}`);

    const results = await db
      .update(libraryFiles)
      .set({ matchedGameId: null })
      .where(eq(libraryFiles.folderPath, folderPath))
      .returning();

    return results[0];
  }

  /**
   * Ignore a library file
   */
  async ignore(folderPath: string): Promise<LibraryFile | undefined> {
    logger.info(`Ignoring library file ${folderPath}`);

    const results = await db
      .update(libraryFiles)
      .set({ ignored: true })
      .where(eq(libraryFiles.folderPath, folderPath))
      .returning();

    return results[0];
  }

  /**
   * Unignore a library file
   */
  async unignore(folderPath: string): Promise<LibraryFile | undefined> {
    logger.info(`Unignoring library file ${folderPath}`);

    const results = await db
      .update(libraryFiles)
      .set({ ignored: false })
      .where(eq(libraryFiles.folderPath, folderPath))
      .returning();

    return results[0];
  }

  /**
   * Delete a library file
   */
  async delete(folderPath: string): Promise<boolean> {
    logger.info(`Deleting library file: ${folderPath}`);

    const result = await db.delete(libraryFiles).where(eq(libraryFiles.folderPath, folderPath));
    return result.changes > 0;
  }

  /**
   * Clear all library files (for re-scan)
   */
  async clearAll(): Promise<number> {
    logger.info('Clearing all library files');

    const result = await db.delete(libraryFiles);
    return result.changes;
  }
}

// Singleton instance
export const libraryFileRepository = new LibraryFileRepository();
