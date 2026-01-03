import { Hono } from 'hono';
import { fileService } from '../services/FileService';
import { gameRepository } from '../repositories/GameRepository';
import { logger } from '../utils/logger';

const library = new Hono();

// POST /api/v1/library/scan - Scan library folder
library.post('/scan', async (c) => {
  logger.info('POST /api/v1/library/scan');

  try {
    const folders = await fileService.scanLibrary();
    const matchedCount = folders.filter((f) => f.matched).length;
    const unmatchedCount = folders.length - matchedCount;

    return c.json({
      success: true,
      data: {
        folders,
        count: folders.length,
        matchedCount,
        unmatchedCount,
      },
      message: `Found ${folders.length} folder${folders.length !== 1 ? 's' : ''} (${matchedCount} matched, ${unmatchedCount} unmatched)`,
    });
  } catch (error) {
    logger.error('Library scan failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/library/match - Match a library folder to a game
library.post('/match', async (c) => {
  logger.info('POST /api/v1/library/match');

  try {
    const body = await c.req.json();
    const { folderName, igdbGame } = body;

    if (!folderName || !igdbGame) {
      return c.json(
        { success: false, error: 'Missing required fields: folderName, igdbGame' },
        400
      );
    }

    // Check if game already exists
    const existingGame = await gameRepository.findByIgdbId(igdbGame.id);

    if (existingGame) {
      return c.json(
        { success: false, error: 'This game is already in your library' },
        400
      );
    }

    // Create new game with downloaded status (since it's already in library)
    const newGame = await gameRepository.create({
      igdbId: igdbGame.id,
      title: igdbGame.name,
      year: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000).getFullYear()
        : null,
      coverUrl: igdbGame.cover?.url || null,
      platform: igdbGame.platforms?.[0]?.name || 'Unknown',
      monitored: true,
      status: 'downloaded',
    });

    logger.info(`Matched library folder "${folderName}" to game: ${newGame.title}`);

    return c.json({
      success: true,
      data: newGame,
      message: `Successfully matched "${folderName}" to ${newGame.title}`,
    });
  } catch (error) {
    logger.error('Library match failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default library;
