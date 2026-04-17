import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { gameService } from '../services/GameService';
import { indexerService } from '../services/IndexerService';
import { downloadService } from '../services/DownloadService';
import { gameRepository } from '../repositories/GameRepository';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';

// Validation schemas
// Validate URL uses allowed schemes only (prevent SSRF via file://, ftp://, etc.)
const safeUrl = z.string().refine((url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'magnet:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}, { message: 'URL must use http, https, or magnet protocol' });

const grabReleaseSchema = z.object({
  gameId: z.number(),
  release: z.object({
    title: z.string(),
    downloadUrl: safeUrl.optional(),
    magnetUrl: safeUrl.optional(),
    size: z.number().optional(),
    seeders: z.number().optional(),
    leechers: z.number().optional(),
    indexer: z.string().optional(),
    publishDate: z.string().optional(),
    publishedAt: z.string().optional(), // Frontend sends this field name
    infoUrl: z.string().optional(),
    categories: z.array(z.number()).optional(),
    score: z.number().optional(),
    protocol: z.enum(['torrent', 'usenet']).optional(),
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

    // Check which games already exist in the library
    const igdbIds = results.map(r => r.igdbId);
    const existingGames = await gameRepository.findByIgdbIds(igdbIds);
    const existingMap = new Map(existingGames.map(g => [g.igdbId, g.id]));

    // Enrich results with existingGameId if they're already in the library
    const enrichedResults = results.map(result => ({
      ...result,
      existingGameId: existingMap.get(result.igdbId) || null,
    }));

    return c.json({ success: true, data: enrichedResults });
  } catch (error) {
    logger.error('IGDB search failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
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
    // Get the game from repository (returns db Game type needed by searchForGame)
    const game = await gameRepository.findById(id);
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/search/grab - Grab a release
search.post('/grab', zValidator('json', grabReleaseSchema), async (c) => {
  logger.info('POST /api/v1/search/grab');

  try {
    const { gameId, release } = c.req.valid('json');

    // Build a ScoredRelease-like object from the request
    // Prefer magnet links over proxy URLs for direct download client compatibility
    const scoredRelease = {
      guid: `manual-${Date.now()}`,
      title: release.title,
      size: release.size || 0,
      seeders: release.seeders || 0,
      leechers: release.leechers || 0,
      downloadUrl: release.magnetUrl || release.downloadUrl || '',
      magnetUrl: release.magnetUrl || undefined,
      indexer: release.indexer || 'Unknown',
      quality: undefined,
      publishedAt: release.publishedAt ? new Date(release.publishedAt) : release.publishDate ? new Date(release.publishDate) : new Date(),
      score: release.score || 0,
      matchConfidence: 'high' as const,
      releaseType: 'full' as const,
      protocol: release.protocol,
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

export default search;
