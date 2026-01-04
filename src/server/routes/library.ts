import { Hono } from 'hono';
import { fileService } from '../services/FileService';
import { gameRepository } from '../repositories/GameRepository';
import { gameService } from '../services/GameService';
import { logger } from '../utils/logger';

const library = new Hono();

/**
 * Clean up scene release names and version info for better IGDB matching
 * Removes: scene groups, version numbers, "update" keywords, common tags
 */
function cleanSearchQuery(title: string): string {
  let cleaned = title;

  // Remove common scene group tags (case insensitive)
  const sceneGroups = [
    'CODEX', 'SKIDROW', 'PLAZA', 'RELOADED', 'PROPHET', 'CPY', 'HOODLUM',
    'STEAMPUNKS', 'GOLDBERG', 'FLT', 'RAZOR1911', 'TENOKE', 'DARKSiDERS',
    'RUNE', 'GOG', 'DODI', 'FitGirl', 'ElAmigos', 'CHRONOS', 'TiNYiSO',
    'I_KnoW', 'SiMPLEX', 'DINOByTES', 'ANOMALY'
  ];

  // Remove scene groups with common patterns like -CODEX, [CODEX], (CODEX)
  sceneGroups.forEach((group) => {
    const patterns = [
      new RegExp(`[-\\.\\s]${group}$`, 'gi'),           // -CODEX at end
      new RegExp(`\\[${group}\\]`, 'gi'),               // [CODEX]
      new RegExp(`\\(${group}\\)`, 'gi'),               // (CODEX)
      new RegExp(`${group}[-\\.\\s]`, 'gi'),            // CODEX- at start
    ];
    patterns.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, ' ');
    });
  });

  // Remove version numbers: v1.0, v2.3.1, V1.0.2, etc.
  cleaned = cleaned.replace(/\b[vV]?\d+(\.\d+){0,3}\b/g, ' ');

  // Remove "Update" or "Updated" keywords
  cleaned = cleaned.replace(/\b(update|updated)\b/gi, ' ');

  // Remove common tags
  const tags = [
    'Repack', 'MULTi\\d+', 'MULTI', 'RIP', 'Cracked', 'Crack',
    'DLC', 'GOTY', 'Complete', 'Edition', 'Deluxe', 'Ultimate',
    'Definitive', 'Enhanced', 'Remastered', 'Anniversary',
    'Digital', 'Steam', 'GOG\\.com', 'Epic', 'Uplay'
  ];
  tags.forEach((tag) => {
    cleaned = cleaned.replace(new RegExp(`\\b${tag}\\b`, 'gi'), ' ');
  });

  // Remove extra punctuation and normalize spaces
  cleaned = cleaned
    .replace(/[._-]/g, ' ')        // Replace dots, underscores, hyphens with spaces
    .replace(/\s+/g, ' ')          // Normalize multiple spaces
    .trim();

  return cleaned;
}

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

// POST /api/v1/library/auto-match - Auto-match a library folder by searching IGDB
library.post('/auto-match', async (c) => {
  logger.info('POST /api/v1/library/auto-match');

  try {
    const body = await c.req.json();
    const { parsedTitle, parsedYear } = body;

    if (!parsedTitle) {
      return c.json(
        { success: false, error: 'Missing required field: parsedTitle' },
        400
      );
    }

    // Clean up the title by removing scene tags, version numbers, etc.
    const cleanedTitle = cleanSearchQuery(parsedTitle);

    logger.info(`Auto-match: Original="${parsedTitle}", Cleaned="${cleanedTitle}"`);

    // Build search query with year if available
    const searchQuery = parsedYear ? `${cleanedTitle} ${parsedYear}` : cleanedTitle;

    // Search IGDB for the game
    const results = await gameService.searchIGDB(searchQuery);

    if (!results || results.length === 0) {
      return c.json({
        success: false,
        error: 'No matches found on IGDB',
      });
    }

    // Return the best match (first result)
    const bestMatch = results[0];

    logger.info(`Auto-matched "${parsedTitle}" to "${bestMatch.title}"`);

    return c.json({
      success: true,
      data: bestMatch,
      message: `Found match: ${bestMatch.title}`,
    });
  } catch (error) {
    logger.error('Auto-match failed:', error);
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
