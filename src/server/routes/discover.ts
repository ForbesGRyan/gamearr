import { Hono } from 'hono';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { gameRepository } from '../repositories/GameRepository';
import { logger } from '../utils/logger';

const discover = new Hono();

// GET /api/v1/discover/popularity-types - Get available popularity types
discover.get('/popularity-types', async (c) => {
  logger.info('GET /api/v1/discover/popularity-types');

  try {
    const types = await igdbClient.getPopularityTypes();
    return c.json({ success: true, data: types });
  } catch (error) {
    logger.error('Get popularity types failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// GET /api/v1/discover/popular - Get popular games by type
discover.get('/popular', async (c) => {
  const typeParam = c.req.query('type');
  const limitParam = c.req.query('limit');

  // Default to type 2 ("Want to Play") if not specified or invalid
  let type = typeParam ? parseInt(typeParam) : 2;
  if (isNaN(type) || type < 1 || type > 8) {
    type = 2;
  }

  let limit = limitParam ? parseInt(limitParam) : 20;
  if (isNaN(limit) || limit < 1) {
    limit = 20;
  } else if (limit > 100) {
    limit = 100;
  }

  logger.info(`GET /api/v1/discover/popular?type=${type}&limit=${limit}`);

  try {
    const popularGames = await igdbClient.getPopularGames(type, limit);

    // Get all games in library to check which popular games are already added
    const libraryGames = await gameRepository.findAll();
    const libraryIgdbIds = new Set(libraryGames.map(g => g.igdbId));

    // Add inLibrary flag to each result
    const results = popularGames.map(pg => ({
      ...pg,
      inLibrary: libraryIgdbIds.has(pg.game.igdbId),
    }));

    return c.json({
      success: true,
      data: results,
      meta: {
        popularityType: type,
        totalResults: results.length,
      },
    });
  } catch (error) {
    logger.error('Get popular games failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default discover;
