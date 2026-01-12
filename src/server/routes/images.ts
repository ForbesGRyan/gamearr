import { Hono } from 'hono';
import { logger } from '../utils/logger';
import { imageCacheService } from '../services/ImageCacheService';
import { gameRepository } from '../repositories/GameRepository';

const images = new Hono();

// GET /api/v1/images/cover/:gameId - Get cached cover image for a game
images.get('/cover/:gameId', async (c) => {
  const gameIdStr = c.req.param('gameId');
  const gameId = parseInt(gameIdStr, 10);

  if (isNaN(gameId)) {
    return c.json({ success: false, error: 'Invalid game ID' }, 400);
  }

  try {
    // Check cache first
    const cachedImage = await imageCacheService.getCachedImage(gameId);

    if (cachedImage) {
      // Serve from cache with long cache headers
      c.header('Content-Type', 'image/jpeg');
      c.header('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
      c.header('X-Cache', 'HIT');
      return c.body(cachedImage);
    }

    // Not cached - look up game to get source URL
    const game = await gameRepository.findById(gameId);

    if (!game) {
      return c.json({ success: false, error: 'Game not found' }, 404);
    }

    if (!game.coverUrl) {
      return c.json({ success: false, error: 'Game has no cover image' }, 404);
    }

    // Download and cache the image
    const cachePath = await imageCacheService.ensureCached(gameId, game.coverUrl);

    if (!cachePath) {
      // Failed to cache - redirect to original URL as fallback
      logger.warn(`Failed to cache image for game ${gameId}, redirecting to source`);
      return c.redirect(game.coverUrl, 302);
    }

    // Serve the newly cached image
    const newCachedImage = await imageCacheService.getCachedImage(gameId);

    if (newCachedImage) {
      c.header('Content-Type', 'image/jpeg');
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
      c.header('X-Cache', 'MISS');
      return c.body(newCachedImage);
    }

    // Fallback to redirect if something went wrong
    return c.redirect(game.coverUrl, 302);
  } catch (error) {
    logger.error(`Error serving cover image for game ${gameId}:`, error);
    return c.json({ success: false, error: 'Failed to serve image' }, 500);
  }
});

// GET /api/v1/images/stats - Get image cache statistics
images.get('/stats', async (c) => {
  try {
    const stats = await imageCacheService.getStats();
    return c.json({
      success: true,
      data: {
        cachedImages: stats.count,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
      },
    });
  } catch (error) {
    logger.error('Error getting image cache stats:', error);
    return c.json({ success: false, error: 'Failed to get stats' }, 500);
  }
});

// POST /api/v1/images/cleanup - Clean up orphaned cache files
images.post('/cleanup', async (c) => {
  try {
    const deleted = await imageCacheService.cleanupOrphans();
    return c.json({
      success: true,
      data: { deletedCount: deleted },
    });
  } catch (error) {
    logger.error('Error cleaning up image cache:', error);
    return c.json({ success: false, error: 'Failed to cleanup' }, 500);
  }
});

// DELETE /api/v1/images/cache - Clear all cached images
images.delete('/cache', async (c) => {
  try {
    const deleted = await imageCacheService.clearAll();
    return c.json({
      success: true,
      data: { deletedCount: deleted },
    });
  } catch (error) {
    logger.error('Error clearing image cache:', error);
    return c.json({ success: false, error: 'Failed to clear cache' }, 500);
  }
});

// DELETE /api/v1/images/cache/:gameId - Delete cached image for a specific game
images.delete('/cache/:gameId', async (c) => {
  const gameIdStr = c.req.param('gameId');
  const gameId = parseInt(gameIdStr, 10);

  if (isNaN(gameId)) {
    return c.json({ success: false, error: 'Invalid game ID' }, 400);
  }

  try {
    const deleted = await imageCacheService.deleteCache(gameId);
    return c.json({
      success: true,
      data: { deleted },
    });
  } catch (error) {
    logger.error(`Error deleting cached image for game ${gameId}:`, error);
    return c.json({ success: false, error: 'Failed to delete cache' }, 500);
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default images;
