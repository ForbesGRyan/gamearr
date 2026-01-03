import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { gameService } from '../services/GameService';
import { logger } from '../utils/logger';

const games = new Hono();

// Validation schemas
const addGameSchema = z.object({
  igdbId: z.number(),
  monitored: z.boolean().optional().default(true),
});

const updateGameSchema = z.object({
  monitored: z.boolean().optional(),
  status: z.enum(['wanted', 'downloading', 'downloaded']).optional(),
  folderPath: z.string().optional(),
});

// GET /api/v1/games - List all games
games.get('/', async (c) => {
  logger.info('GET /api/v1/games');

  try {
    const allGames = await gameService.getAllGames();
    return c.json({ success: true, data: allGames });
  } catch (error) {
    logger.error('Failed to get games:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/games - Add a new game
games.post('/', zValidator('json', addGameSchema), async (c) => {
  logger.info('POST /api/v1/games');

  try {
    const { igdbId, monitored } = c.req.valid('json');
    const game = await gameService.addGameFromIGDB(igdbId, monitored);
    return c.json({ success: true, data: game }, 201);
  } catch (error) {
    logger.error('Failed to add game:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      400
    );
  }
});

// GET /api/v1/games/:id - Get game details
games.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  logger.info(`GET /api/v1/games/${id}`);

  try {
    const game = await gameService.getGameById(id);
    if (!game) {
      return c.json({ success: false, error: 'Game not found' }, 404);
    }
    return c.json({ success: true, data: game });
  } catch (error) {
    logger.error('Failed to get game:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// PUT /api/v1/games/:id - Update game
games.put('/:id', zValidator('json', updateGameSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  logger.info(`PUT /api/v1/games/${id}`);

  try {
    const updates = c.req.valid('json');
    const game = await gameService.updateGame(id, updates);
    return c.json({ success: true, data: game });
  } catch (error) {
    logger.error('Failed to update game:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      400
    );
  }
});

// DELETE /api/v1/games/:id - Delete game
games.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  logger.info(`DELETE /api/v1/games/${id}`);

  try {
    await gameService.deleteGame(id);
    return c.json({ success: true, message: 'Game deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete game:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      400
    );
  }
});

// POST /api/v1/games/:id/toggle-monitor - Toggle monitored status
games.post('/:id/toggle-monitor', async (c) => {
  const id = parseInt(c.req.param('id'));
  logger.info(`POST /api/v1/games/${id}/toggle-monitor`);

  try {
    const game = await gameService.toggleMonitored(id);
    return c.json({ success: true, data: game });
  } catch (error) {
    logger.error('Failed to toggle monitor:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      400
    );
  }
});

export default games;
