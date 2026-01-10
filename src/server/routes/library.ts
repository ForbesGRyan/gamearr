import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { fileService } from '../services/FileService';
import { gameService } from '../services/GameService';
import { downloadService } from '../services/DownloadService';
import { logger } from '../utils/logger';
import { validatePathWithinBase } from '../utils/pathSecurity';
import { settingsService } from '../services/SettingsService';
import { PathTraversalError, formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';
import { cleanSearchQuery } from '../utils/searchQuery';

// Validation schemas
const autoMatchSchema = z.object({
  parsedTitle: z.string().min(1),
  parsedYear: z.number().nullable().optional(),
});

const matchSchema = z.object({
  folderPath: z.string().optional(),
  folderName: z.string().optional(),
  igdbGame: z.object({
    id: z.number().int().positive().optional(),
    igdbId: z.number().int().positive().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    year: z.number().nullable().optional(),
    first_release_date: z.number().optional(),
    coverUrl: z.string().nullable().optional(),
    cover: z.object({ url: z.string() }).optional(),
    platforms: z.array(z.any()).optional(),
    summary: z.string().nullable().optional(),
    genres: z.array(z.string()).optional(),
    totalRating: z.number().nullable().optional(),
    developer: z.string().nullable().optional(),
    publisher: z.string().nullable().optional(),
    gameModes: z.array(z.string()).optional(),
    themes: z.array(z.string()).optional(),
    similarGames: z.array(z.union([
      z.number(),
      z.object({ igdbId: z.number(), name: z.string().optional(), coverUrl: z.string().optional() })
    ])).optional(),
  }).refine(
    (data) => (data.id !== undefined && data.id > 0) || (data.igdbId !== undefined && data.igdbId > 0),
    { message: 'Either id or igdbId must be a valid positive number' }
  ),
  store: z.string().nullable().optional(),
  libraryId: z.number().int().positive().nullable().optional(),
}).refine(
  (data) => data.folderPath || data.folderName,
  { message: 'Either folderPath or folderName must be provided' }
);

const matchExistingSchema = z.object({
  folderPath: z.string().min(1),
  gameId: z.number(),
});

const folderPathSchema = z.object({
  folderPath: z.string().min(1),
});

const organizeFileSchema = z.object({
  filePath: z.string().min(1),
  folderName: z.string().min(1),
});

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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
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
    });
  } catch (error) {
    logger.error('Library scan failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/library/auto-match - Auto-match a library folder by searching IGDB
library.post('/auto-match', zValidator('json', autoMatchSchema), async (c) => {
  logger.info('POST /api/v1/library/auto-match');

  try {
    const { parsedTitle, parsedYear } = c.req.valid('json');

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
        code: ErrorCode.NOT_FOUND,
      }, 404);
    }

    // Return the best match (first result)
    const bestMatch = results[0];

    logger.info(`Auto-matched "${parsedTitle}" to "${bestMatch.title}"`);

    return c.json({
      success: true,
      data: bestMatch,
    });
  } catch (error) {
    logger.error('Auto-match failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/library/match - Match a library folder to a game (creates new or links to existing)
library.post('/match', zValidator('json', matchSchema), async (c) => {
  logger.info('POST /api/v1/library/match');

  try {
    const { folderPath, folderName, igdbGame, store, libraryId } = c.req.valid('json');

    // Support both formats: GameSearchResult format (igdbId) or raw IGDB format (id)
    const gameIgdbId = igdbGame.igdbId || igdbGame.id;
    const gameTitle = igdbGame.title || igdbGame.name;
    const gameYear = igdbGame.year || (igdbGame.first_release_date
      ? new Date(igdbGame.first_release_date * 1000).getFullYear()
      : null);
    const gameCoverUrl = igdbGame.coverUrl || igdbGame.cover?.url || null;
    const gamePlatform = igdbGame.platforms?.[0]?.name || igdbGame.platforms?.[0] || 'PC';

    // Check if game already exists
    const existingGame = await gameService.findByIgdbId(gameIgdbId);

    let game;
    let wasExisting = false;

    if (existingGame) {
      // Game already exists - link folder to it and update status
      logger.info(`Game "${existingGame.title}" already exists, linking folder to it`);

      game = await gameService.updateGame(existingGame.id, {
        status: 'downloaded',
        folderPath: folderPath || existingGame.folderPath,
        store: store || existingGame.store,
        libraryId: libraryId || existingGame.libraryId,
      });

      wasExisting = true;
    } else {
      // Get the default update policy from settings
      const defaultUpdatePolicy = await settingsService.getSetting('default_update_policy') as 'notify' | 'auto' | 'ignore' | null;

      // Create new game with downloaded status (since it's already in library)
      // Include metadata if available from GameSearchResult format
      game = await gameService.createGame({
        igdbId: gameIgdbId,
        title: gameTitle,
        year: gameYear,
        coverUrl: gameCoverUrl,
        platform: gamePlatform,
        store: store || null,
        folderPath: folderPath || null,
        libraryId: libraryId || null,
        monitored: true,
        status: 'downloaded',
        updatePolicy: defaultUpdatePolicy || 'notify',
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

      // Try to link any matching qBittorrent torrents to this game
      const linkedCount = await downloadService.linkTorrentsToGame(folderPath, game.id);
      if (linkedCount > 0) {
        logger.info(`Linked ${linkedCount} qBittorrent torrent(s) to game ${game.id}`);
      }
    }

    const action = wasExisting ? 'Linked' : 'Matched';
    logger.info(`${action} library folder "${folderName || folderPath}" to game: ${game.title}`);

    return c.json({
      success: true,
      data: game,
    });
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return c.json({ success: false, error: error.message, code: ErrorCode.PATH_TRAVERSAL }, 403);
    }
    logger.error('Library match failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/library/match-existing - Match a library folder to an existing game
library.post('/match-existing', zValidator('json', matchExistingSchema), async (c) => {
  logger.info('POST /api/v1/library/match-existing');

  try {
    const { folderPath, gameId } = c.req.valid('json');

    // Check if game exists
    const game = await gameService.getGameById(gameId);

    if (!game) {
      return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
    }

    // Match folder to game
    const success = await fileService.matchFolderToGame(folderPath, gameId);

    if (!success) {
      return c.json({ success: false, error: 'Failed to match folder to game', code: ErrorCode.UNKNOWN }, 500);
    }

    // Try to link any matching qBittorrent torrents to this game
    const linkedCount = await downloadService.linkTorrentsToGame(folderPath, gameId);
    if (linkedCount > 0) {
      logger.info(`Linked ${linkedCount} qBittorrent torrent(s) to game ${gameId}`);
    }

    logger.info(`Matched library folder "${folderPath}" to existing game: ${game.title}`);

    return c.json({
      success: true,
      data: game,
    });
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return c.json({ success: false, error: error.message, code: ErrorCode.PATH_TRAVERSAL }, 403);
    }
    logger.error('Library match failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/library/ignore - Ignore a library folder
library.post('/ignore', zValidator('json', folderPathSchema), async (c) => {
  logger.info('POST /api/v1/library/ignore');

  try {
    const { folderPath } = c.req.valid('json');

    // Security: Validate that the folder path is within the library
    const libraryPath = await settingsService.getSetting('library_path');
    if (libraryPath) {
      validatePathWithinBase(folderPath, libraryPath, 'ignore folder');
    }

    const result = await fileService.ignoreFolder(folderPath);

    if (!result) {
      return c.json({ success: false, error: 'Folder not found in library scan', code: ErrorCode.NOT_FOUND }, 404);
    }

    logger.info(`Ignored library folder: ${folderPath}`);

    return c.json({
      success: true,
      data: { ignored: true },
    });
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return c.json({ success: false, error: error.message, code: ErrorCode.PATH_TRAVERSAL }, 403);
    }
    logger.error('Failed to ignore folder:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/library/unignore - Unignore a library folder
library.post('/unignore', zValidator('json', folderPathSchema), async (c) => {
  logger.info('POST /api/v1/library/unignore');

  try {
    const { folderPath } = c.req.valid('json');

    // Security: Validate that the folder path is within the library
    const libraryPath = await settingsService.getSetting('library_path');
    if (libraryPath) {
      validatePathWithinBase(folderPath, libraryPath, 'unignore folder');
    }

    const result = await fileService.unignoreFolder(folderPath);

    if (!result) {
      return c.json({ success: false, error: 'Folder not found in library scan', code: ErrorCode.NOT_FOUND }, 404);
    }

    logger.info(`Unignored library folder: ${folderPath}`);

    return c.json({
      success: true,
      data: { unignored: true },
    });
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return c.json({ success: false, error: error.message, code: ErrorCode.PATH_TRAVERSAL }, 403);
    }
    logger.error('Failed to unignore folder:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/library/ignored - Get ignored folders
library.get('/ignored', async (c) => {
  logger.info('GET /api/v1/library/ignored');

  try {
    const ignoredFolders = await fileService.getIgnoredFolders();

    return c.json({
      success: true,
      data: ignoredFolders,
    });
  } catch (error) {
    logger.error('Failed to get ignored folders:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/library/health/organize-file - Organize a loose file into a folder
library.post('/health/organize-file', zValidator('json', organizeFileSchema), async (c) => {
  logger.info('POST /api/v1/library/health/organize-file');

  try {
    const { filePath, folderName } = c.req.valid('json');

    const result = await fileService.organizeLooseFile(filePath, folderName);

    if (!result.success) {
      return c.json({ success: false, error: result.error, code: ErrorCode.FILE_ERROR }, 400);
    }

    return c.json({
      success: true,
      data: { newPath: result.newPath },
    });
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return c.json({ success: false, error: error.message, code: ErrorCode.PATH_TRAVERSAL }, 403);
    }
    logger.error('Failed to organize file:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default library;
