import { Hono } from 'hono';
import { fileService } from '../services/FileService';
import { gameRepository } from '../repositories/GameRepository';
import { gameService } from '../services/GameService';
import { logger } from '../utils/logger';

const library = new Hono();

/**
 * Clean up scene release names and version info for better IGDB matching
 * Removes: scene groups, version numbers, "update" keywords, edition names, common tags
 */
function cleanSearchQuery(title: string): string {
  let cleaned = title;

  // Remove version numbers BEFORE normalizing dots to spaces
  // Patterns like .v1.0, .v2.3.1, .1.2.3.4567 (preceded by separator or space)
  cleaned = cleaned.replace(/[\s.\-_][vV]\d+(\.\d+)*/g, ' '); // v1, v1.0, v1.2.3
  cleaned = cleaned.replace(/[.\-_]\d+(\.\d+){1,}/g, ' '); // .1.2.3 style versions (must have at least 2 parts)

  // Now normalize separators to spaces
  cleaned = cleaned.replace(/[._-]/g, ' ');

  // Remove common scene group tags (case insensitive)
  const sceneGroups = [
    'CODEX', 'SKIDROW', 'PLAZA', 'RELOADED', 'PROPHET', 'CPY', 'HOODLUM',
    'STEAMPUNKS', 'GOLDBERG', 'FLT', 'RAZOR1911', 'TENOKE', 'DARKSiDERS',
    'RUNE', 'GOG', 'DODI', 'FitGirl', 'ElAmigos', 'CHRONOS', 'TiNYiSO',
    'I_KnoW', 'SiMPLEX', 'DINOByTES', 'ANOMALY', 'EMPRESS',
    'P2P', 'PROPER', 'INTERNAL', 'KaOs', 'Portable', 'x64', 'x86'
  ];

  // Remove scene groups
  sceneGroups.forEach((group) => {
    cleaned = cleaned.replace(new RegExp(`\\b${group}\\b`, 'gi'), ' ');
  });

  // Remove content in brackets (usually metadata)
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');

  // Remove any remaining version patterns after space normalization
  cleaned = cleaned.replace(/\b[vV]\d+\b/g, ' '); // Standalone v1, v2, etc.
  cleaned = cleaned.replace(/\b(build|patch|update|updated|hotfix)\s*\d*\b/gi, ' ');

  // Remove multi-word edition phrases FIRST (before single words)
  const editionPhrases = [
    'Game of the Year',
    "Director'?s Cut",
    'Directors? Cut',
    "Collector'?s Edition",
    'Collectors? Edition',
    'Limited Edition',
    'Special Edition',
    'Gold Edition',
    'Premium Edition',
    'Digital Edition',
    'Digital Deluxe',
    'Super Deluxe',
    'Complete Edition',
    'Definitive Edition',
    'Enhanced Edition',
    'Ultimate Edition',
    'Deluxe Edition',
    'Standard Edition',
    'Legendary Edition',
    'Base Game',
    'All DLCs?',
    'incl\\.?\\s*DLCs?',
    '\\+\\s*DLCs?',
    'with\\s+DLCs?',
    'and\\s+DLCs?'
  ];
  editionPhrases.forEach((phrase) => {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), ' ');
  });

  // Remove common single-word tags (be careful not to remove words that are part of game titles)
  const tags = [
    'Repack', 'MULTi\\d*', 'RIP', 'Cracked', 'Crack',
    'DLC', 'DLCs', 'GOTY', 'Complete', 'Edition', 'Deluxe', 'Ultimate',
    'Definitive', 'Enhanced', 'Remastered', 'Anniversary', 'Remake',
    'Digital', 'Steam', 'Epic', 'Uplay', 'Origin',
    'Collectors?', 'Limited', 'Special', 'Gold', 'Premium', 'Standard',
    'Directors?', 'Extended', 'Expanded', 'Uncut', 'Uncensored',
    'Bundle', 'Trilogy', 'Anthology',
    'FHD', '4K', 'UHD', 'SDR', 'HDR',
    'Windows', 'Win', 'Mac', 'Linux',
    'Incl', 'Including'
  ];
  tags.forEach((tag) => {
    cleaned = cleaned.replace(new RegExp(`\\b${tag}\\b`, 'gi'), ' ');
  });

  // Note: We intentionally do NOT remove trailing numbers like "4" in "Far Cry 4"
  // The version number removal earlier handles actual versions like ".v1.2.3"
  // Any remaining numbers are likely part of the game title

  // Normalize spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

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

// POST /api/v1/library/match - Match a library folder to a game (creates new or links to existing)
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

    // Support both formats: GameSearchResult format (igdbId) or raw IGDB format (id)
    const gameIgdbId = igdbGame.igdbId || igdbGame.id;
    const gameTitle = igdbGame.title || igdbGame.name;
    const gameYear = igdbGame.year || (igdbGame.first_release_date
      ? new Date(igdbGame.first_release_date * 1000).getFullYear()
      : null);
    const gameCoverUrl = igdbGame.coverUrl || igdbGame.cover?.url || null;
    const gamePlatform = igdbGame.platforms?.[0]?.name || igdbGame.platforms?.[0] || 'PC';

    // Check if game already exists
    const existingGame = await gameRepository.findByIgdbId(gameIgdbId);

    let game;
    let wasExisting = false;

    if (existingGame) {
      // Game already exists - link folder to it and update status
      logger.info(`Game "${existingGame.title}" already exists, linking folder to it`);

      await gameRepository.update(existingGame.id, {
        status: 'downloaded',
        folderPath: folderPath || existingGame.folderPath,
        store: store || existingGame.store,
      });

      game = { ...existingGame, status: 'downloaded', folderPath: folderPath || existingGame.folderPath };
      wasExisting = true;
    } else {
      // Create new game with downloaded status (since it's already in library)
      // Include metadata if available from GameSearchResult format
      game = await gameRepository.create({
        igdbId: gameIgdbId,
        title: gameTitle,
        year: gameYear,
        coverUrl: gameCoverUrl,
        platform: gamePlatform,
        store: store || null,
        folderPath: folderPath || null,
        monitored: true,
        status: 'downloaded',
        // Metadata from GameSearchResult (if available)
        summary: igdbGame.summary || null,
        genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
        totalRating: igdbGame.totalRating || null,
        developer: igdbGame.developer || null,
        publisher: igdbGame.publisher || null,
        gameModes: igdbGame.gameModes ? JSON.stringify(igdbGame.gameModes) : null,
        similarGames: igdbGame.similarGames
          ? JSON.stringify(igdbGame.similarGames)
          : null,
      });
    }

    // Match folder to game if folderPath is provided (marks it as matched so it won't show in future scans)
    if (folderPath) {
      await fileService.matchFolderToGame(folderPath, game.id);
    }

    const action = wasExisting ? 'Linked' : 'Matched';
    logger.info(`${action} library folder "${folderName || folderPath}" to game: ${game.title}`);

    return c.json({
      success: true,
      data: game,
      message: `Successfully ${action.toLowerCase()} "${folderName || folderPath}" to ${game.title}`,
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

// ========================================
// Library Health Endpoints
// ========================================

// GET /api/v1/library/health/duplicates - Get potential duplicate games
library.get('/health/duplicates', async (c) => {
  logger.info('GET /api/v1/library/health/duplicates');

  try {
    const duplicates = await fileService.findDuplicateGames();

    return c.json({
      success: true,
      data: duplicates,
      count: duplicates.length,
    });
  } catch (error) {
    logger.error('Failed to find duplicate games:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// GET /api/v1/library/health/loose-files - Get loose files in library
library.get('/health/loose-files', async (c) => {
  logger.info('GET /api/v1/library/health/loose-files');

  try {
    const looseFiles = await fileService.findLooseFiles();

    return c.json({
      success: true,
      data: looseFiles,
      count: looseFiles.length,
    });
  } catch (error) {
    logger.error('Failed to find loose files:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/library/health/organize-file - Organize a loose file into a folder
library.post('/health/organize-file', async (c) => {
  logger.info('POST /api/v1/library/health/organize-file');

  try {
    const body = await c.req.json();
    const { filePath } = body;

    if (!filePath) {
      return c.json({ success: false, error: 'Missing required field: filePath' }, 400);
    }

    const result = await fileService.organizeLooseFile(filePath);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: { newPath: result.newPath },
      message: 'File organized successfully',
    });
  } catch (error) {
    logger.error('Failed to organize file:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default library;
