import { Hono } from 'hono';
import { fileService } from '../services/FileService';
import { gameRepository } from '../repositories/GameRepository';
import { logger } from '../utils/logger';

const library = new Hono();

// GET /api/v1/library/scan - Get cached library scan
library.get('/scan', async (c) => {
  logger.info('GET /api/v1/library/scan');

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
    });
  } catch (error) {
    logger.error('Library scan failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/library/scan - Refresh library scan
library.post('/scan', async (c) => {
  logger.info('POST /api/v1/library/scan (refresh)');

  try {
    const folders = await fileService.refreshLibraryScan();
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
      message: `Scanned ${folders.length} folder${folders.length !== 1 ? 's' : ''} (${matchedCount} matched, ${unmatchedCount} unmatched)`,
    });
  } catch (error) {
    logger.error('Library scan failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/library/match - Match a library folder to a new game
library.post('/match', async (c) => {
  logger.info('POST /api/v1/library/match');

  try {
    const body = await c.req.json();
    const { folderPath, folderName, igdbGame, store } = body;

    if ((!folderPath && !folderName) || !igdbGame) {
      return c.json(
        { success: false, error: 'Missing required fields: folderPath or folderName, igdbGame' },
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
      store: store || null,
      folderPath: folderPath || null,
      monitored: true,
      status: 'downloaded',
    });

    // Match folder to game if folderPath is provided
    if (folderPath) {
      await fileService.matchFolderToGame(folderPath, newGame.id);
    }

    logger.info(`Matched library folder "${folderName || folderPath}" to game: ${newGame.title}`);

    return c.json({
      success: true,
      data: newGame,
      message: `Successfully matched "${folderName || folderPath}" to ${newGame.title}`,
    });
  } catch (error) {
    logger.error('Library match failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/library/match-existing - Match a library folder to an existing game
library.post('/match-existing', async (c) => {
  logger.info('POST /api/v1/library/match-existing');

  try {
    const body = await c.req.json();
    const { folderPath, gameId } = body;

    if (!folderPath || !gameId) {
      return c.json(
        { success: false, error: 'Missing required fields: folderPath, gameId' },
        400
      );
    }

    // Check if game exists
    const game = await gameRepository.findById(gameId);

    if (!game) {
      return c.json({ success: false, error: 'Game not found' }, 404);
    }

    // Match folder to game
    const success = await fileService.matchFolderToGame(folderPath, gameId);

    if (!success) {
      return c.json({ success: false, error: 'Failed to match folder to game' }, 500);
    }

    logger.info(`Matched library folder "${folderPath}" to existing game: ${game.title}`);

    return c.json({
      success: true,
      data: game,
      message: `Successfully matched folder to ${game.title}`,
    });
  } catch (error) {
    logger.error('Library match failed:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/library/ignore - Ignore a library folder
library.post('/ignore', async (c) => {
  logger.info('POST /api/v1/library/ignore');

  try {
    const body = await c.req.json();
    const { folderPath } = body;

    if (!folderPath) {
      return c.json({ success: false, error: 'Missing required field: folderPath' }, 400);
    }

    // Import libraryFileRepository
    const { libraryFileRepository } = await import('../repositories/LibraryFileRepository');
    const result = await libraryFileRepository.ignore(folderPath);

    if (!result) {
      return c.json({ success: false, error: 'Folder not found in library scan' }, 404);
    }

    logger.info(`Ignored library folder: ${folderPath}`);

    return c.json({
      success: true,
      message: 'Folder ignored successfully',
    });
  } catch (error) {
    logger.error('Failed to ignore folder:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/library/unignore - Unignore a library folder
library.post('/unignore', async (c) => {
  logger.info('POST /api/v1/library/unignore');

  try {
    const body = await c.req.json();
    const { folderPath } = body;

    if (!folderPath) {
      return c.json({ success: false, error: 'Missing required field: folderPath' }, 400);
    }

    const { libraryFileRepository } = await import('../repositories/LibraryFileRepository');
    const result = await libraryFileRepository.unignore(folderPath);

    if (!result) {
      return c.json({ success: false, error: 'Folder not found in library scan' }, 404);
    }

    logger.info(`Unignored library folder: ${folderPath}`);

    return c.json({
      success: true,
      message: 'Folder unignored successfully',
    });
  } catch (error) {
    logger.error('Failed to unignore folder:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// GET /api/v1/library/ignored - Get ignored folders
library.get('/ignored', async (c) => {
  logger.info('GET /api/v1/library/ignored');

  try {
    const { libraryFileRepository } = await import('../repositories/LibraryFileRepository');
    const ignoredFiles = await libraryFileRepository.findIgnored();

    return c.json({
      success: true,
      data: ignoredFiles.map((file) => ({
        folderName: file.folderPath.split(/[/\\]/).pop(),
        parsedTitle: file.parsedTitle,
        parsedYear: file.parsedYear,
        path: file.folderPath,
      })),
    });
  } catch (error) {
    logger.error('Failed to get ignored folders:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default library;
