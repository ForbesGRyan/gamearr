import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import { libraries, type Library, type NewLibrary } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const libraryFields = {
  id: libraries.id,
  name: libraries.name,
  path: libraries.path,
  platform: libraries.platform,
  monitored: libraries.monitored,
  downloadEnabled: libraries.downloadEnabled,
  priority: libraries.priority,
  createdAt: libraries.createdAt,
};

export class LibraryRepository {
  /**
   * Get all libraries ordered by priority
   */
  async findAll(): Promise<Library[]> {
    return db.select(libraryFields).from(libraries).orderBy(asc(libraries.priority), desc(libraries.createdAt));
  }

  /**
   * Get library by ID
   */
  async findById(id: number): Promise<Library | undefined> {
    const results = await db.select(libraryFields).from(libraries).where(eq(libraries.id, id));
    return results[0];
  }

  /**
   * Get library by path
   */
  async findByPath(path: string): Promise<Library | undefined> {
    const results = await db.select(libraryFields).from(libraries).where(eq(libraries.path, path));
    return results[0];
  }

  /**
   * Get libraries by platform
   */
  async findByPlatform(platform: string): Promise<Library[]> {
    return db
      .select(libraryFields)
      .from(libraries)
      .where(eq(libraries.platform, platform))
      .orderBy(asc(libraries.priority));
  }

  /**
   * Get monitored libraries
   */
  async findMonitored(): Promise<Library[]> {
    return db
      .select(libraryFields)
      .from(libraries)
      .where(eq(libraries.monitored, true))
      .orderBy(asc(libraries.priority));
  }

  /**
   * Get libraries with downloads enabled
   */
  async findDownloadEnabled(): Promise<Library[]> {
    return db
      .select(libraryFields)
      .from(libraries)
      .where(eq(libraries.downloadEnabled, true))
      .orderBy(asc(libraries.priority));
  }

  /**
   * Create a new library
   */
  async create(library: NewLibrary): Promise<Library> {
    logger.info(`Creating library: ${library.name} at ${library.path}`);

    const results = await db.insert(libraries).values(library).returning();
    return results[0];
  }

  /**
   * Update a library
   */
  async update(id: number, updates: Partial<NewLibrary>): Promise<Library | undefined> {
    logger.info(`Updating library ID: ${id}`);

    const results = await db
      .update(libraries)
      .set(updates)
      .where(eq(libraries.id, id))
      .returning();

    return results[0];
  }

  /**
   * Delete a library
   */
  async delete(id: number): Promise<boolean> {
    logger.info(`Deleting library ID: ${id}`);

    const result = await db.delete(libraries).where(eq(libraries.id, id));
    return result.changes > 0;
  }

  /**
   * Check if library exists by path
   */
  async existsByPath(path: string): Promise<boolean> {
    const library = await this.findByPath(path);
    return !!library;
  }

  /**
   * Get count of libraries
   */
  async count(): Promise<number> {
    const results = await db.select(libraryFields).from(libraries);
    return results.length;
  }
}

// Singleton instance
export const libraryRepository = new LibraryRepository();
