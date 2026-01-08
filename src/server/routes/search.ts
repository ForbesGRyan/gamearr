import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { gameService } from '../services/GameService';
import { indexerService } from '../services/IndexerService';
import { downloadService } from '../services/DownloadService';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';

// Validation schemas
const grabReleaseSchema = z.object({
  gameId: z.number(),
  release: z.object({
    title: z.string(),
    downloadUrl: z.string().optional(),
    magnetUrl: z.string().optional(),
    size: z.number().optional(),
    seeders: z.number().optional(),
    leechers: z.number().optional(),
    indexer: z.string().optional(),
    publishDate: z.string().optional(),
    infoUrl: z.string().optional(),
    categories: z.array(z.number()).optional(),
    score: z.number().optional(),
  }),
});

const search = new Hono();

// GET /api/v1/search/games - Search IGDB for games
search.get('/games', async (c) => {
  const query = c.req.query('q');

  if (!query) {
    return c.json({ success: false, error: 'Query parameter "q" is required', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  logger.info(`GET /api/v1/search/games?q=${query}`);

  try {
    const results = await gameService.searchIGDB(query);
    return c.json({ success: true, data: results });
  } catch (error) {
    logger.error('IGDB search failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/search/releases/:id - Manual release search for a game
search.get('/releases/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  logger.info(`GET /api/v1/search/releases/${id}`);

  try {
    // Get the game
    const game = await gameService.getGameById(id);
    if (!game) {
      return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
    }

    // Search for releases
    const releases = await indexerService.searchForGame(game);

    return c.json({
      success: true,
      data: releases,
      meta: {
        gameId: game.id,
        gameTitle: game.title,
        totalResults: releases.length,
      },
    });
  } catch (error) {
    logger.error('Release search failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/search/releases - Manual search with custom query
search.get('/releases', async (c) => {
  const query = c.req.query('q');

  if (!query) {
    return c.json({ success: false, error: 'Query parameter "q" is required', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  logger.info(`GET /api/v1/search/releases?q=${query}`);

  try {
    const releases = await indexerService.manualSearch(query);
    return c.json({
      success: true,
      data: releases,
      meta: {
        totalResults: releases.length,
      },
    });
  } catch (error) {
    logger.error('Manual search failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/search/grab - Grab a release
search.post('/grab', zValidator('json', grabReleaseSchema), async (c) => {
  logger.info('POST /api/v1/search/grab');

  try {
    const { gameId, release } = c.req.valid('json');

    // Build a ScoredRelease-like object from the request
    const scoredRelease = {
      guid: `manual-${Date.now()}`,
      title: release.title,
      size: release.size || 0,
      seeders: release.seeders || 0,
      downloadUrl: release.downloadUrl || release.magnetUrl || '',
      indexer: release.indexer || 'Unknown',
      quality: undefined,
      publishedAt: release.publishDate ? new Date(release.publishDate) : new Date(),
      score: release.score || 0,
      matchConfidence: 'high' as const,
    };

    const result = await downloadService.grabRelease(gameId, scoredRelease);

    return c.json({
      success: true,
      data: {
        releaseId: result.releaseId,
        torrentHash: result.torrentHash,
      },
    });
  } catch (error) {
    logger.error('Grab release failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default search;
