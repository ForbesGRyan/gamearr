import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { gameRepository } from '../repositories/GameRepository';

// Get data path from environment or use default (same as db/index.ts)
const dataPath = process.env.DATA_PATH || './data';
const CACHE_DIR = path.join(dataPath, 'cache', 'images', 'covers');

// Track in-flight downloads to prevent duplicate requests
const inFlightDownloads = new Map<number, Promise<string | null>>();

export class ImageCacheService {
  private initialized = false;

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      this.initialized = true;
      logger.info(`Image cache directory initialized: ${CACHE_DIR}`);
    } catch (error) {
      logger.error('Failed to create image cache directory:', error);
      throw error;
    }
  }

  /**
   * Get the cache file path for a game
   */
  getCachedImagePath(gameId: number): string {
    return path.join(CACHE_DIR, `${gameId}.jpg`);
  }

  /**
   * Check if an image is cached
   */
  async isCached(gameId: number): Promise<boolean> {
    try {
      const cachePath = this.getCachedImagePath(gameId);
      await fs.access(cachePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached image as a Buffer, or null if not cached
   */
  async getCachedImage(gameId: number): Promise<Buffer | null> {
    try {
      const cachePath = this.getCachedImagePath(gameId);
      return await fs.readFile(cachePath);
    } catch {
      return null;
    }
  }

  /**
   * Ensure an image is cached, downloading if necessary
   * Returns the cache path if successful, null if failed
   */
  async ensureCached(gameId: number, sourceUrl: string): Promise<string | null> {
    // Check if already downloading
    const inFlight = inFlightDownloads.get(gameId);
    if (inFlight) {
      return inFlight;
    }

    // Check if already cached
    if (await this.isCached(gameId)) {
      return this.getCachedImagePath(gameId);
    }

    // Start download
    const downloadPromise = this.downloadAndCache(gameId, sourceUrl);
    inFlightDownloads.set(gameId, downloadPromise);

    try {
      return await downloadPromise;
    } finally {
      inFlightDownloads.delete(gameId);
    }
  }

  /**
   * Download image from source URL and cache it
   */
  private async downloadAndCache(gameId: number, sourceUrl: string): Promise<string | null> {
    await this.ensureCacheDir();

    try {
      logger.debug(`Downloading image for game ${gameId} from ${sourceUrl}`);

      const response = await fetch(sourceUrl, {
        headers: {
          'User-Agent': 'Gamearr/1.0',
        },
      });

      if (!response.ok) {
        logger.warn(`Failed to download image for game ${gameId}: HTTP ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        logger.warn(`Invalid content type for game ${gameId} image: ${contentType}`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Validate it's not an empty or corrupt image
      if (buffer.length < 100) {
        logger.warn(`Image for game ${gameId} is too small (${buffer.length} bytes), likely corrupt`);
        return null;
      }

      const cachePath = this.getCachedImagePath(gameId);
      await fs.writeFile(cachePath, buffer);

      logger.debug(`Cached image for game ${gameId} (${buffer.length} bytes)`);
      return cachePath;
    } catch (error) {
      logger.error(`Failed to download/cache image for game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Delete cached image for a game
   */
  async deleteCache(gameId: number): Promise<boolean> {
    try {
      const cachePath = this.getCachedImagePath(gameId);
      await fs.unlink(cachePath);
      logger.debug(`Deleted cached image for game ${gameId}`);
      return true;
    } catch {
      // File doesn't exist or couldn't be deleted
      return false;
    }
  }

  /**
   * Clear all cached images
   */
  async clearAll(): Promise<number> {
    try {
      const files = await fs.readdir(CACHE_DIR);
      let deleted = 0;

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          try {
            await fs.unlink(path.join(CACHE_DIR, file));
            deleted++;
          } catch {
            // Ignore individual file deletion errors
          }
        }
      }

      logger.info(`Cleared ${deleted} cached images`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Clean up orphaned cache files (images for games that no longer exist)
   */
  async cleanupOrphans(): Promise<number> {
    try {
      const files = await fs.readdir(CACHE_DIR);
      let deleted = 0;

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          const gameId = parseInt(file.replace('.jpg', ''), 10);
          if (!isNaN(gameId)) {
            const game = await gameRepository.findById(gameId);
            if (!game) {
              await fs.unlink(path.join(CACHE_DIR, file));
              deleted++;
            }
          }
        }
      }

      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} orphaned cached images`);
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup orphaned images:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ count: number; totalSize: number }> {
    try {
      const files = await fs.readdir(CACHE_DIR);
      let totalSize = 0;
      let count = 0;

      for (const file of files) {
        if (file.endsWith('.jpg')) {
          const stats = await fs.stat(path.join(CACHE_DIR, file));
          totalSize += stats.size;
          count++;
        }
      }

      return { count, totalSize };
    } catch {
      return { count: 0, totalSize: 0 };
    }
  }
}

// Singleton instance
export const imageCacheService = new ImageCacheService();
