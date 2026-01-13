import { Hono } from 'hono';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { gameService } from '../services/GameService';
import { cacheService } from '../services/CacheService';
import { logger } from '../utils/logger';
import { routeHandler } from '../utils/errors';

const discover = new Hono();

// GET /api/v1/discover/popularity-types - Get available popularity types
discover.get('/popularity-types', routeHandler(async () => {
  logger.info('GET /api/v1/discover/popularity-types');

  // Try cache first
  const cached = await cacheService.getPopularityTypes();
  if (cached) {
    logger.debug('Returning cached popularity types');
    return { success: true, data: cached, cached: true };
  }

  // Cache miss - fetch directly and cache
  const types = await cacheService.refreshPopularityTypes();
  return { success: true, data: types, cached: false };
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

  // Try cache first
  const cached = await cacheService.getTrendingGames(type);
  if (cached) {
    logger.debug(`Returning cached trending games (type: ${type})`);
    const results = cached.slice(0, limit);
    return {
      success: true,
      data: results,
      meta: {
        popularityType: type,
        totalResults: results.length,
        cached: true,
      },
    };
  }

  // Cache miss - fetch directly
  logger.debug(`Cache miss for trending games type ${type}, fetching from IGDB`);
  const popularGames = await igdbClient.getPopularGames(type, limit);

  // Get all games in library to check which popular games are already added
  const libraryIgdbIds = await gameService.getAllIgdbIds();

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
      cached: false,
    },
  };
}, 'Get popular games', logger.error.bind(logger)));

export default discover;
