import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { gameService } from '../services/GameService';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode, NotFoundError, ValidationError } from '../utils/errors';

const games = new Hono();

// Validation schemas
const addGameSchema = z.object({
  igdbId: z.number(),
  monitored: z.boolean().optional().default(true),
  store: z.string().nullable().optional(),
  libraryId: z.number().optional(),
});

const updateGameSchema = z.object({
  monitored: z.boolean().optional(),
  status: z.enum(['wanted', 'downloading', 'downloaded']).optional(),
  folderPath: z.string().nullable().optional(),
  store: z.string().nullable().optional(),
  updatePolicy: z.enum(['notify', 'auto', 'ignore']).optional(),
});

// GET /api/v1/games - List all games (supports pagination via ?limit=20&offset=0)
games.get('/', async (c) => {
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');

  // Parse pagination params (undefined means no pagination)
  const limit = limitParam ? parseInt(limitParam) : undefined;
  const offset = offsetParam ? parseInt(offsetParam) : undefined;

  // Validate params if provided
  if (limitParam && (isNaN(limit!) || limit! < 1)) {
    return c.json({ success: false, error: 'Invalid limit parameter', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  if (offsetParam && (isNaN(offset!) || offset! < 0)) {
    return c.json({ success: false, error: 'Invalid offset parameter', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  logger.info(`GET /api/v1/games${limitParam ? ` (limit=${limit}, offset=${offset})` : ''}`);

  try {
    // If pagination params provided, use paginated query
    if (limit !== undefined || offset !== undefined) {
      const result = await gameService.getGamesPaginated({ limit, offset });
      return c.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    }

    // Otherwise return all games (backwards compatible)
    const allGames = await gameService.getAllGames();
    return c.json({ success: true, data: allGames });
  } catch (error) {
    logger.error('Failed to get games:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/games - Add a new game
games.post('/', zValidator('json', addGameSchema), async (c) => {
  logger.info('POST /api/v1/games');

  try {
    const { igdbId, monitored, store, libraryId } = c.req.valid('json');
    const game = await gameService.addGameFromIGDB(igdbId, monitored, store, libraryId);
    return c.json({ success: true, data: game }, 201);
  } catch (error) {
    logger.error('Failed to add game:', error);
    // Check if this is a duplicate error (conflict)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('duplicate')) {
      return c.json({ success: false, error: errorMessage, code: ErrorCode.CONFLICT }, 409);
    }
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/games/:id - Get game details
games.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`GET /api/v1/games/${id}`);

  try {
    const game = await gameService.getGameById(id);
    if (!game) {
      return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
    }
    return c.json({ success: true, data: game });
  } catch (error) {
    logger.error('Failed to get game:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/games/:id - Update game
games.put('/:id', zValidator('json', updateGameSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`PUT /api/v1/games/${id}`);

  try {
    const updates = c.req.valid('json');
    const game = await gameService.updateGame(id, updates);
    if (!game) {
      return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
    }
    return c.json({ success: true, data: game });
  } catch (error) {
    logger.error('Failed to update game:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// DELETE /api/v1/games/:id - Delete game
games.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`DELETE /api/v1/games/${id}`);

  try {
    await gameService.deleteGame(id);
    return c.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error('Failed to delete game:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.toLowerCase().includes('not found')) {
      return c.json({ success: false, error: errorMessage, code: ErrorCode.NOT_FOUND }, 404);
    }
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PATCH /api/v1/games/:id/toggle-monitor - Toggle monitored status
games.patch('/:id/toggle-monitor', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`PATCH /api/v1/games/${id}/toggle-monitor`);

  try {
    const game = await gameService.toggleMonitored(id);
    if (!game) {
      return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
    }
    return c.json({ success: true, data: game });
  } catch (error) {
    logger.error('Failed to toggle monitor:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// Validation schema for rematch
const rematchGameSchema = z.object({
  igdbId: z.number(),
});

// PATCH /api/v1/games/:id/rematch - Change the IGDB match for a game
games.patch('/:id/rematch', zValidator('json', rematchGameSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`PATCH /api/v1/games/${id}/rematch`);

  try {
    const { igdbId } = c.req.valid('json');
    const game = await gameService.rematchGame(id, igdbId);
    if (!game) {
      return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
    }
    return c.json({ success: true, data: game });
  } catch (error) {
    logger.error('Failed to rematch game:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default games;
