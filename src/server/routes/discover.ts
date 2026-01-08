import { Hono } from 'hono';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { gameRepository } from '../repositories/GameRepository';
import { logger } from '../utils/logger';
import { routeHandler } from '../utils/errors';

const discover = new Hono();

// GET /api/v1/discover/popularity-types - Get available popularity types
discover.get('/popularity-types', routeHandler(async () => {
  logger.info('GET /api/v1/discover/popularity-types');
  const types = await igdbClient.getPopularityTypes();
  return { success: true, data: types };
}, 'Get popularity types', logger.error.bind(logger)));

// GET /api/v1/discover/popular - Get popular games by type
discover.get('/popular', routeHandler(async (c) => {
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

  const popularGames = await igdbClient.getPopularGames(type, limit);

  // Get all games in library to check which popular games are already added
  const libraryGames = await gameRepository.findAll();
  const libraryIgdbIds = new Set(libraryGames.map(g => g.igdbId));

  // Add inLibrary flag to each result
  const results = popularGames.map(pg => ({
    ...pg,
    inLibrary: libraryIgdbIds.has(pg.game.igdbId),
  }));

  return {
    success: true,
    data: results,
    meta: {
      popularityType: type,
      totalResults: results.length,
    },
  };
}, 'Get popular games', logger.error.bind(logger)));

export default discover;
