import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErrorCode } from '../../src/server/utils/errors';

// ============================================================================
// LIBRARY ROUTES TESTS (folder matching, duplicate detection)
// ============================================================================

describe('Library Routes', () => {
  // Mock folder data
  const mockFolder = {
    path: '/games/Test Game (2023)',
    name: 'Test Game (2023)',
    parsedTitle: 'Test Game',
    parsedYear: 2023,
    matched: false,
    ignored: false,
    gameId: null,
    size: 50000000000,
    modifiedAt: new Date(),
  };

  const mockMatchedFolder = {
    ...mockFolder,
    path: '/games/Another Game (2022)',
    name: 'Another Game (2022)',
    parsedTitle: 'Another Game',
    parsedYear: 2022,
    matched: true,
    gameId: 1,
  };

  // Mock game data
  const mockGame = {
    id: 1,
    igdbId: 12345,
    title: 'Test Game',
    year: 2023,
    status: 'downloaded' as const,
    coverUrl: 'https://example.com/cover.jpg',
    folderPath: '/games/Test Game (2023)',
  };

  // Mock IGDB search result
  const mockIGDBResult = {
    igdbId: 12345,
    title: 'Test Game',
    year: 2023,
    coverUrl: 'https://example.com/cover.jpg',
    platforms: ['PC'],
  };

  // Mock duplicate game
  const mockDuplicate = {
    title: 'Duplicate Game',
    count: 2,
    games: [
      { id: 1, title: 'Duplicate Game', folderPath: '/games/Duplicate Game (2023)' },
      { id: 2, title: 'Duplicate Game', folderPath: '/games/Duplicate Game Copy' },
    ],
  };

  // Mock loose file
  const mockLooseFile = {
    path: '/games/game_installer.exe',
    name: 'game_installer.exe',
    size: 100000000,
    extension: '.exe',
    modifiedAt: new Date(),
  };

  // Mock services
  const mockFileService = {
    scanLibrary: mock(() => Promise.resolve([mockFolder, mockMatchedFolder])),
    refreshLibraryScan: mock(() => Promise.resolve([mockFolder, mockMatchedFolder])),
    matchFolderToGame: mock(() => Promise.resolve(true)),
    ignoreFolder: mock(() => Promise.resolve(true)),
    unignoreFolder: mock(() => Promise.resolve(true)),
    getIgnoredFolders: mock(() => Promise.resolve(['/games/Ignored Folder'])),
    findDuplicateGames: mock(() => Promise.resolve([mockDuplicate])),
    findLooseFiles: mock(() => Promise.resolve([mockLooseFile])),
    organizeLooseFile: mock(() =>
      Promise.resolve({ success: true, newPath: '/games/Organized/game_installer.exe' })
    ),
  };

  const mockGameService = {
    searchIGDB: mock(() => Promise.resolve([mockIGDBResult])),
    getGameById: mock((id: number) =>
      Promise.resolve(id === 1 ? mockGame : undefined)
    ),
    findByIgdbId: mock(() => Promise.resolve(null)),
    createGame: mock((data: Record<string, unknown>) =>
      Promise.resolve({ id: 2, ...data })
    ),
    updateGame: mock((id: number, updates: Record<string, unknown>) =>
      Promise.resolve({ ...mockGame, ...updates })
    ),
  };

  const mockDownloadService = {
    linkTorrentsToGame: mock(() => Promise.resolve(0)),
  };

  const mockSettingsService = {
    getSetting: mock(() => Promise.resolve('/games')),
  };

  // Validation schemas
  const autoMatchSchema = z.object({
    parsedTitle: z.string().min(1),
    parsedYear: z.number().nullable().optional(),
  });

  const matchSchema = z.object({
    folderPath: z.string().optional(),
    folderName: z.string().optional(),
    igdbGame: z.object({
      id: z.number().optional(),
      igdbId: z.number().optional(),
      title: z.string().optional(),
      name: z.string().optional(),
      year: z.number().nullable().optional(),
      coverUrl: z.string().nullable().optional(),
    }),
    store: z.string().nullable().optional(),
    libraryId: z.number().nullable().optional(),
  });

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

  // Create test app with library routes
  const createLibraryApp = () => {
    const app = new Hono();

    // GET /api/v1/library/scan - Get cached library scan
    app.get('/api/v1/library/scan', async (c) => {
      try {
        const folders = await mockFileService.scanLibrary();
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
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    });

    // POST /api/v1/library/scan - Refresh library scan
    app.post('/api/v1/library/scan', async (c) => {
      try {
        const folders = await mockFileService.refreshLibraryScan();
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
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    });

    // POST /api/v1/library/auto-match - Auto-match a library folder
    app.post(
      '/api/v1/library/auto-match',
      zValidator('json', autoMatchSchema),
      async (c) => {
        try {
          const { parsedTitle, parsedYear } = c.req.valid('json');
          const searchQuery = parsedYear
            ? `${parsedTitle} ${parsedYear}`
            : parsedTitle;

          const results = await mockGameService.searchIGDB(searchQuery);

          if (!results || results.length === 0) {
            return c.json(
              {
                success: false,
                error: 'No matches found on IGDB',
                code: ErrorCode.NOT_FOUND,
              },
              404
            );
          }

          return c.json({
            success: true,
            data: results[0],
          });
        } catch (error) {
          return c.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          );
        }
      }
    );

    // POST /api/v1/library/match - Match a library folder to a game
    app.post('/api/v1/library/match', zValidator('json', matchSchema), async (c) => {
      try {
        const { folderPath, folderName, igdbGame, store, libraryId } =
          c.req.valid('json');

        if (!folderPath && !folderName) {
          return c.json(
            {
              success: false,
              error: 'Either folderPath or folderName must be provided',
            },
            400
          );
        }

        const gameIgdbId = igdbGame.igdbId || igdbGame.id;
        const gameTitle = igdbGame.title || igdbGame.name;

        if (!gameIgdbId) {
          return c.json(
            {
              success: false,
              error: 'Game IGDB ID is required',
            },
            400
          );
        }

        // Check if game already exists
        const existingGame = await mockGameService.findByIgdbId(gameIgdbId);

        let game;
        if (existingGame) {
          game = await mockGameService.updateGame(existingGame.id, {
            status: 'downloaded',
            folderPath: folderPath || existingGame.folderPath,
            store: store || existingGame.store,
            libraryId: libraryId || existingGame.libraryId,
          });
        } else {
          game = await mockGameService.createGame({
            igdbId: gameIgdbId,
            title: gameTitle,
            year: igdbGame.year,
            coverUrl: igdbGame.coverUrl,
            store: store || null,
            folderPath: folderPath || null,
            libraryId: libraryId || null,
            status: 'downloaded',
          });
        }

        if (folderPath) {
          await mockFileService.matchFolderToGame(folderPath, game.id);
          await mockDownloadService.linkTorrentsToGame(folderPath, game.id);
        }

        return c.json({
          success: true,
          data: game,
        });
      } catch (error) {
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    });

    // POST /api/v1/library/match-existing - Match folder to existing game
    app.post(
      '/api/v1/library/match-existing',
      zValidator('json', matchExistingSchema),
      async (c) => {
        try {
          const { folderPath, gameId } = c.req.valid('json');

          const game = await mockGameService.getGameById(gameId);
          if (!game) {
            return c.json(
              { success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND },
              404
            );
          }

          const success = await mockFileService.matchFolderToGame(folderPath, gameId);
          if (!success) {
            return c.json(
              { success: false, error: 'Failed to match folder to game' },
              500
            );
          }

          await mockDownloadService.linkTorrentsToGame(folderPath, gameId);

          return c.json({
            success: true,
            data: game,
          });
        } catch (error) {
          return c.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          );
        }
      }
    );

    // POST /api/v1/library/ignore - Ignore a library folder
    app.post(
      '/api/v1/library/ignore',
      zValidator('json', folderPathSchema),
      async (c) => {
        try {
          const { folderPath } = c.req.valid('json');

          const result = await mockFileService.ignoreFolder(folderPath);

          if (!result) {
            return c.json(
              {
                success: false,
                error: 'Folder not found in library scan',
                code: ErrorCode.NOT_FOUND,
              },
              404
            );
          }

          return c.json({
            success: true,
            data: { ignored: true },
          });
        } catch (error) {
          return c.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          );
        }
      }
    );

    // POST /api/v1/library/unignore - Unignore a library folder
    app.post(
      '/api/v1/library/unignore',
      zValidator('json', folderPathSchema),
      async (c) => {
        try {
          const { folderPath } = c.req.valid('json');

          const result = await mockFileService.unignoreFolder(folderPath);

          if (!result) {
            return c.json(
              {
                success: false,
                error: 'Folder not found in library scan',
                code: ErrorCode.NOT_FOUND,
              },
              404
            );
          }

          return c.json({
            success: true,
            data: { unignored: true },
          });
        } catch (error) {
          return c.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          );
        }
      }
    );

    // GET /api/v1/library/ignored - Get ignored folders
    app.get('/api/v1/library/ignored', async (c) => {
      try {
        const ignoredFolders = await mockFileService.getIgnoredFolders();

        return c.json({
          success: true,
          data: ignoredFolders,
        });
      } catch (error) {
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    });

    // GET /api/v1/library/health/duplicates - Get potential duplicate games
    app.get('/api/v1/library/health/duplicates', async (c) => {
      try {
        const duplicates = await mockFileService.findDuplicateGames();

        return c.json({
          success: true,
          data: duplicates,
          count: duplicates.length,
        });
      } catch (error) {
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    });

    // GET /api/v1/library/health/loose-files - Get loose files in library
    app.get('/api/v1/library/health/loose-files', async (c) => {
      try {
        const looseFiles = await mockFileService.findLooseFiles();

        return c.json({
          success: true,
          data: looseFiles,
          count: looseFiles.length,
        });
      } catch (error) {
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    });

    // POST /api/v1/library/health/organize-file - Organize a loose file
    app.post(
      '/api/v1/library/health/organize-file',
      zValidator('json', organizeFileSchema),
      async (c) => {
        try {
          const { filePath, folderName } = c.req.valid('json');

          const result = await mockFileService.organizeLooseFile(
            filePath,
            folderName
          );

          if (!result.success) {
            return c.json(
              { success: false, error: result.error, code: ErrorCode.FILE_ERROR },
              400
            );
          }

          return c.json({
            success: true,
            data: { newPath: result.newPath },
          });
        } catch (error) {
          return c.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          );
        }
      }
    );

    return app;
  };

  let app: ReturnType<typeof createLibraryApp>;

  beforeEach(() => {
    app = createLibraryApp();
    mockFileService.scanLibrary.mockClear();
    mockFileService.refreshLibraryScan.mockClear();
    mockFileService.matchFolderToGame.mockClear();
    mockFileService.ignoreFolder.mockClear();
    mockFileService.unignoreFolder.mockClear();
    mockFileService.getIgnoredFolders.mockClear();
    mockFileService.findDuplicateGames.mockClear();
    mockFileService.findLooseFiles.mockClear();
    mockFileService.organizeLooseFile.mockClear();
    mockGameService.searchIGDB.mockClear();
    mockGameService.getGameById.mockClear();
    mockGameService.findByIgdbId.mockClear();
    mockGameService.createGame.mockClear();
    mockGameService.updateGame.mockClear();
    mockDownloadService.linkTorrentsToGame.mockClear();
    mockSettingsService.getSetting.mockClear();
  });

  describe('GET /api/v1/library/scan', () => {
    test('should return library folders with counts', async () => {
      const res = await app.request('/api/v1/library/scan');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.folders).toHaveLength(2);
      expect(json.data.count).toBe(2);
      expect(json.data.matchedCount).toBe(1);
      expect(json.data.unmatchedCount).toBe(1);
    });

    test('should handle service errors', async () => {
      mockFileService.scanLibrary.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to scan library'))
      );

      const res = await app.request('/api/v1/library/scan');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to scan library');
    });
  });

  describe('POST /api/v1/library/scan', () => {
    test('should refresh and return library folders', async () => {
      const res = await app.request('/api/v1/library/scan', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.folders).toHaveLength(2);
      expect(mockFileService.refreshLibraryScan).toHaveBeenCalled();
    });

    test('should handle service errors', async () => {
      mockFileService.refreshLibraryScan.mockImplementationOnce(() =>
        Promise.reject(new Error('Scan failed'))
      );

      const res = await app.request('/api/v1/library/scan', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Scan failed');
    });
  });

  describe('POST /api/v1/library/auto-match', () => {
    test('should return best match from IGDB', async () => {
      const res = await app.request('/api/v1/library/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedTitle: 'Test Game', parsedYear: 2023 }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Test Game');
      expect(json.data.igdbId).toBe(12345);
    });

    test('should search without year if not provided', async () => {
      const res = await app.request('/api/v1/library/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedTitle: 'Test Game' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test('should return 404 when no matches found', async () => {
      mockGameService.searchIGDB.mockImplementationOnce(() =>
        Promise.resolve([])
      );

      const res = await app.request('/api/v1/library/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedTitle: 'Unknown Game' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('No matches found on IGDB');
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for missing parsedTitle', async () => {
      const res = await app.request('/api/v1/library/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for empty parsedTitle', async () => {
      const res = await app.request('/api/v1/library/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedTitle: '' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/library/match', () => {
    test('should create new game when not existing', async () => {
      const res = await app.request('/api/v1/library/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '/games/Test Game (2023)',
          igdbGame: {
            igdbId: 12345,
            title: 'Test Game',
            year: 2023,
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(2);
      expect(mockGameService.createGame).toHaveBeenCalled();
    });

    test('should update existing game', async () => {
      mockGameService.findByIgdbId.mockImplementationOnce(() =>
        Promise.resolve(mockGame)
      );

      const res = await app.request('/api/v1/library/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '/games/Test Game (2023)',
          igdbGame: {
            igdbId: 12345,
            title: 'Test Game',
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockGameService.updateGame).toHaveBeenCalled();
    });

    test('should match folder and link torrents', async () => {
      const res = await app.request('/api/v1/library/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '/games/Test Game (2023)',
          igdbGame: {
            igdbId: 12345,
            title: 'Test Game',
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(mockFileService.matchFolderToGame).toHaveBeenCalled();
      expect(mockDownloadService.linkTorrentsToGame).toHaveBeenCalled();
    });

    test('should accept folderName instead of folderPath', async () => {
      const res = await app.request('/api/v1/library/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: 'Test Game (2023)',
          igdbGame: {
            igdbId: 12345,
            title: 'Test Game',
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test('should support store parameter', async () => {
      const res = await app.request('/api/v1/library/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '/games/Test Game (2023)',
          igdbGame: {
            igdbId: 12345,
            title: 'Test Game',
          },
          store: 'Steam',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test('should handle service errors', async () => {
      mockGameService.createGame.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      const res = await app.request('/api/v1/library/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '/games/Test Game (2023)',
          igdbGame: {
            igdbId: 12345,
            title: 'Test Game',
          },
        }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database error');
    });
  });

  describe('POST /api/v1/library/match-existing', () => {
    test('should match folder to existing game', async () => {
      const res = await app.request('/api/v1/library/match-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '/games/Test Game (2023)',
          gameId: 1,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
      expect(mockFileService.matchFolderToGame).toHaveBeenCalledWith(
        '/games/Test Game (2023)',
        1
      );
    });

    test('should return 404 for non-existent game', async () => {
      const res = await app.request('/api/v1/library/match-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '/games/Test Game (2023)',
          gameId: 999,
        }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Game not found');
    });

    test('should return 400 for missing folderPath', async () => {
      const res = await app.request('/api/v1/library/match-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 1 }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for missing gameId', async () => {
      const res = await app.request('/api/v1/library/match-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: '/games/Test' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/library/ignore', () => {
    test('should ignore folder successfully', async () => {
      const res = await app.request('/api/v1/library/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: '/games/Unwanted Folder' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.ignored).toBe(true);
    });

    test('should return 404 when folder not found', async () => {
      mockFileService.ignoreFolder.mockImplementationOnce(() =>
        Promise.resolve(false)
      );

      const res = await app.request('/api/v1/library/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: '/games/Nonexistent' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for missing folderPath', async () => {
      const res = await app.request('/api/v1/library/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/library/unignore', () => {
    test('should unignore folder successfully', async () => {
      const res = await app.request('/api/v1/library/unignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: '/games/Ignored Folder' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.unignored).toBe(true);
    });

    test('should return 404 when folder not found', async () => {
      mockFileService.unignoreFolder.mockImplementationOnce(() =>
        Promise.resolve(false)
      );

      const res = await app.request('/api/v1/library/unignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: '/games/Nonexistent' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/library/ignored', () => {
    test('should return ignored folders', async () => {
      const res = await app.request('/api/v1/library/ignored');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toContain('/games/Ignored Folder');
    });

    test('should handle service errors', async () => {
      mockFileService.getIgnoredFolders.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to get ignored folders'))
      );

      const res = await app.request('/api/v1/library/ignored');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/library/health/duplicates', () => {
    test('should return duplicate games', async () => {
      const res = await app.request('/api/v1/library/health/duplicates');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.count).toBe(1);
      expect(json.data[0].title).toBe('Duplicate Game');
      expect(json.data[0].count).toBe(2);
    });

    test('should return empty when no duplicates', async () => {
      mockFileService.findDuplicateGames.mockImplementationOnce(() =>
        Promise.resolve([])
      );

      const res = await app.request('/api/v1/library/health/duplicates');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
      expect(json.count).toBe(0);
    });

    test('should handle service errors', async () => {
      mockFileService.findDuplicateGames.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      const res = await app.request('/api/v1/library/health/duplicates');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/library/health/loose-files', () => {
    test('should return loose files', async () => {
      const res = await app.request('/api/v1/library/health/loose-files');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.count).toBe(1);
      expect(json.data[0].name).toBe('game_installer.exe');
    });

    test('should return empty when no loose files', async () => {
      mockFileService.findLooseFiles.mockImplementationOnce(() =>
        Promise.resolve([])
      );

      const res = await app.request('/api/v1/library/health/loose-files');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });

    test('should handle service errors', async () => {
      mockFileService.findLooseFiles.mockImplementationOnce(() =>
        Promise.reject(new Error('Scan failed'))
      );

      const res = await app.request('/api/v1/library/health/loose-files');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('POST /api/v1/library/health/organize-file', () => {
    test('should organize loose file successfully', async () => {
      const res = await app.request('/api/v1/library/health/organize-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: '/games/game_installer.exe',
          folderName: 'Organized',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.newPath).toBe('/games/Organized/game_installer.exe');
    });

    test('should return 400 when organize fails', async () => {
      mockFileService.organizeLooseFile.mockImplementationOnce(() =>
        Promise.resolve({ success: false, error: 'File not found' })
      );

      const res = await app.request('/api/v1/library/health/organize-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: '/games/missing.exe',
          folderName: 'Organized',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('File not found');
      expect(json.code).toBe(ErrorCode.FILE_ERROR);
    });

    test('should return 400 for missing filePath', async () => {
      const res = await app.request('/api/v1/library/health/organize-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: 'Organized' }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for missing folderName', async () => {
      const res = await app.request('/api/v1/library/health/organize-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: '/games/file.exe' }),
      });

      expect(res.status).toBe(400);
    });
  });
});
