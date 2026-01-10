import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { updateService } from '../services/UpdateService';
import { updateCheckJob } from '../jobs/UpdateCheckJob';
import { gameService } from '../services/GameService';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';

const updates = new Hono();

// Validation schemas
const updatePolicySchema = z.object({
  policy: z.enum(['notify', 'auto', 'ignore']),
});

// GET /api/v1/updates - List all pending updates (supports pagination via ?limit=20&offset=0)
updates.get('/', async (c) => {
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

  logger.info(`GET /api/v1/updates${limitParam ? ` (limit=${limit}, offset=${offset})` : ''}`);

  try {
    // If pagination params provided, use paginated query
    if (limit !== undefined || offset !== undefined) {
      const result = await updateService.getPendingUpdatesPaginated({ limit, offset });

      // Join with game info for better display
      const updatesWithGames = await Promise.all(
        result.items.map(async (update) => {
          const game = await gameService.getGameById(update.gameId);
          return {
            ...update,
            gameTitle: game?.title || 'Unknown',
            gameCoverUrl: game?.coverUrl,
          };
        })
      );

      return c.json({
        success: true,
        data: updatesWithGames,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    }

    // Otherwise return all updates (backwards compatible)
    const pendingUpdates = await updateService.getPendingUpdates();

    // Join with game info for better display
    const updatesWithGames = await Promise.all(
      pendingUpdates.map(async (update) => {
        const game = await gameService.getGameById(update.gameId);
        return {
          ...update,
          gameTitle: game?.title || 'Unknown',
          gameCoverUrl: game?.coverUrl,
        };
      })
    );

    return c.json({ success: true, data: updatesWithGames });
  } catch (error) {
    logger.error('Failed to get updates:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/updates/check - Trigger manual check for all games
updates.post('/check', async (c) => {
  logger.info('POST /api/v1/updates/check');

  try {
    const result = await updateCheckJob.triggerCheck();
    return c.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to check for updates:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/updates/:id/grab - Download an update
updates.post('/:id/grab', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid update ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`POST /api/v1/updates/${id}/grab`);

  try {
    await updateService.grabUpdate(id);
    return c.json({ success: true, data: { grabbed: true } });
  } catch (error) {
    logger.error('Failed to grab update:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/updates/:id/dismiss - Dismiss an update
updates.post('/:id/dismiss', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid update ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`POST /api/v1/updates/${id}/dismiss`);

  try {
    await updateService.dismissUpdate(id);
    return c.json({ success: true, data: { dismissed: true } });
  } catch (error) {
    logger.error('Failed to dismiss update:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/updates/games/:id - Get updates for specific game
updates.get('/games/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`GET /api/v1/updates/games/${id}`);

  try {
    const gameUpdates = await updateService.getGameUpdates(id);
    return c.json({ success: true, data: gameUpdates });
  } catch (error) {
    logger.error('Failed to get game updates:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/updates/games/:id/check - Check single game for updates
updates.post('/games/:id/check', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`POST /api/v1/updates/games/${id}/check`);

  try {
    const updates = await updateService.checkGameForUpdates(id);
    return c.json({
      success: true,
      data: {
        updatesFound: updates.length,
        updates
      }
    });
  } catch (error) {
    logger.error('Failed to check game for updates:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/updates/games/:id/policy - Set update policy for a game
updates.put('/games/:id/policy', zValidator('json', updatePolicySchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  logger.info(`PUT /api/v1/updates/games/${id}/policy`);

  try {
    const { policy } = c.req.valid('json');

    const game = await gameService.getGameById(id);
    if (!game) {
      return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
    }

    const updatedGame = await gameService.updateGame(id, { updatePolicy: policy });
    return c.json({ success: true, data: updatedGame });
  } catch (error) {
    logger.error('Failed to set update policy:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default updates;
