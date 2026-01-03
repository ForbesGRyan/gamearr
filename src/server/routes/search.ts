import { Hono } from 'hono';
import { gameService } from '../services/GameService';
import { indexerService } from '../services/IndexerService';
import { downloadService } from '../services/DownloadService';
import { logger } from '../utils/logger';

const search = new Hono();

// GET /api/v1/search/games - Search IGDB for games
search.get('/games', async (c) => {
  const query = c.req.query('q');

  if (!query) {
    return c.json({ success: false, error: 'Query parameter "q" is required' }, 400);
  }

  logger.info(`GET /api/v1/search/games?q=${query}`);

  try {
    const results = await gameService.searchIGDB(query);
    return c.json({ success: true, data: results });
  } catch (error) {
    logger.error('IGDB search failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/search/releases/:id - Manual release search for a game
search.post('/releases/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid game ID' }, 400);
  }

  logger.info(`POST /api/v1/search/releases/${id}`);

  try {
    // Get the game
    const game = await gameService.getGameById(id);
    if (!game) {
      return c.json({ success: false, error: 'Game not found' }, 404);
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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// GET /api/v1/search/releases - Manual search with custom query
search.get('/releases', async (c) => {
  const query = c.req.query('q');

  if (!query) {
    return c.json({ success: false, error: 'Query parameter "q" is required' }, 400);
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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/search/grab - Grab a release
search.post('/grab', async (c) => {
  logger.info('POST /api/v1/search/grab');

  try {
    const body = await c.req.json();
    const { gameId, release } = body;

    if (!gameId || !release) {
      return c.json({ success: false, error: 'Missing gameId or release data' }, 400);
    }

    const result = await downloadService.grabRelease(gameId, release);

    if (!result.success) {
      return c.json({ success: false, error: result.message }, 400);
    }

    return c.json({
      success: true,
      message: result.message,
      data: {
        releaseId: result.releaseId,
        torrentHash: result.torrentHash,
      },
    });
  } catch (error) {
    logger.error('Grab release failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default search;
