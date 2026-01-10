import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErrorCode } from '../../src/server/utils/errors';

// ============================================================================
// SEARCH ROUTES TESTS
// ============================================================================

describe('Search Routes', () => {
  // Mock game data
  const mockGame = {
    id: 1,
    igdbId: 12345,
    title: 'Test Game',
    year: 2023,
    platform: 'PC',
    status: 'wanted' as const,
    coverUrl: 'https://example.com/cover.jpg',
    summary: 'A test game',
  };

  // Mock search result
  const mockSearchResult = {
    igdbId: 12345,
    title: 'Test Game',
    year: 2023,
    coverUrl: 'https://example.com/cover.jpg',
    platforms: ['PC'],
    summary: 'A test game',
  };

  // Mock release data
  const mockRelease = {
    guid: 'release-123',
    title: 'Test Game v1.0',
    size: 50000000000,
    seeders: 100,
    downloadUrl: 'https://example.com/torrent',
    indexer: 'TestIndexer',
    quality: 'GOG',
    publishedAt: new Date(),
    score: 85,
    matchConfidence: 'high' as const,
  };

  // Mock services
  const mockGameService = {
    searchIGDB: mock(() => Promise.resolve([mockSearchResult])),
    getGameById: mock((id: number) =>
      Promise.resolve(id === 1 ? mockGame : undefined)
    ),
  };

  const mockIndexerService = {
    searchForGame: mock(() => Promise.resolve([mockRelease])),
    manualSearch: mock(() => Promise.resolve([mockRelease])),
  };

  const mockDownloadService = {
    grabRelease: mock(() =>
      Promise.resolve({ releaseId: 1, torrentHash: 'abc123' })
    ),
  };

  // Create test app with search routes
  const createSearchApp = () => {
    const app = new Hono();

    const grabReleaseSchema = z.object({
      gameId: z.number(),
      release: z.object({
        title: z.string(),
        downloadUrl: z.string().optional(),
        magnetUrl: z.string().optional(),
        size: z.number().optional(),
        seeders: z.number().optional(),
        leechers: z.number().optional(),
        indexer: z.string().optional(),
        publishDate: z.string().optional(),
        infoUrl: z.string().optional(),
        categories: z.array(z.number()).optional(),
        score: z.number().optional(),
      }),
    });

    // GET /api/v1/search/games - Search IGDB for games
    app.get('/api/v1/search/games', async (c) => {
      const query = c.req.query('q');

      if (!query) {
        return c.json(
          {
            success: false,
            error: 'Query parameter "q" is required',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      try {
        const results = await mockGameService.searchIGDB(query);
        return c.json({ success: true, data: results });
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

    // GET /api/v1/search/releases/:id - Manual release search for a game
    app.get('/api/v1/search/releases/:id', async (c) => {
      const id = parseInt(c.req.param('id'));

      if (isNaN(id)) {
        return c.json(
          {
            success: false,
            error: 'Invalid game ID',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      try {
        const game = await mockGameService.getGameById(id);
        if (!game) {
          return c.json(
            { success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND },
            404
          );
        }

        const releases = await mockIndexerService.searchForGame(game);

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
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    });

    // GET /api/v1/search/releases - Manual search with custom query
    app.get('/api/v1/search/releases', async (c) => {
      const query = c.req.query('q');

      if (!query) {
        return c.json(
          {
            success: false,
            error: 'Query parameter "q" is required',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      try {
        const releases = await mockIndexerService.manualSearch(query);
        return c.json({
          success: true,
          data: releases,
          meta: {
            totalResults: releases.length,
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

    // POST /api/v1/search/grab - Grab a release
    app.post('/api/v1/search/grab', zValidator('json', grabReleaseSchema), async (c) => {
      try {
        const { gameId, release } = c.req.valid('json');

        const scoredRelease = {
          guid: `manual-${Date.now()}`,
          title: release.title,
          size: release.size || 0,
          seeders: release.seeders || 0,
          downloadUrl: release.downloadUrl || release.magnetUrl || '',
          indexer: release.indexer || 'Unknown',
          quality: undefined,
          publishedAt: release.publishDate ? new Date(release.publishDate) : new Date(),
          score: release.score || 0,
          matchConfidence: 'high' as const,
        };

        const result = await mockDownloadService.grabRelease(gameId, scoredRelease);

        return c.json({
          success: true,
          data: {
            releaseId: result.releaseId,
            torrentHash: result.torrentHash,
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

    return app;
  };

  let app: ReturnType<typeof createSearchApp>;

  beforeEach(() => {
    app = createSearchApp();
    mockGameService.searchIGDB.mockClear();
    mockGameService.getGameById.mockClear();
    mockIndexerService.searchForGame.mockClear();
    mockIndexerService.manualSearch.mockClear();
    mockDownloadService.grabRelease.mockClear();
  });

  describe('GET /api/v1/search/games', () => {
    test('should search IGDB for games successfully', async () => {
      const res = await app.request('/api/v1/search/games?q=test');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe('Test Game');
      expect(mockGameService.searchIGDB).toHaveBeenCalledWith('test');
    });

    test('should return 400 when query parameter is missing', async () => {
      const res = await app.request('/api/v1/search/games');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Query parameter "q" is required');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should handle service errors', async () => {
      mockGameService.searchIGDB.mockImplementationOnce(() =>
        Promise.reject(new Error('IGDB connection failed'))
      );

      const res = await app.request('/api/v1/search/games?q=test');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('IGDB connection failed');
    });

    test('should return empty array when no results found', async () => {
      mockGameService.searchIGDB.mockImplementationOnce(() => Promise.resolve([]));

      const res = await app.request('/api/v1/search/games?q=nonexistent');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/search/releases/:id', () => {
    test('should search releases for a game successfully', async () => {
      const res = await app.request('/api/v1/search/releases/1');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.meta.gameId).toBe(1);
      expect(json.meta.gameTitle).toBe('Test Game');
      expect(json.meta.totalResults).toBe(1);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/search/releases/invalid');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid game ID');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should return 404 when game not found', async () => {
      const res = await app.request('/api/v1/search/releases/999');

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Game not found');
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should handle indexer service errors', async () => {
      mockIndexerService.searchForGame.mockImplementationOnce(() =>
        Promise.reject(new Error('Prowlarr connection failed'))
      );

      const res = await app.request('/api/v1/search/releases/1');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Prowlarr connection failed');
    });
  });

  describe('GET /api/v1/search/releases', () => {
    test('should search releases with custom query successfully', async () => {
      const res = await app.request('/api/v1/search/releases?q=custom+search');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.meta.totalResults).toBe(1);
      expect(mockIndexerService.manualSearch).toHaveBeenCalledWith('custom search');
    });

    test('should return 400 when query parameter is missing', async () => {
      const res = await app.request('/api/v1/search/releases');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Query parameter "q" is required');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should handle service errors', async () => {
      mockIndexerService.manualSearch.mockImplementationOnce(() =>
        Promise.reject(new Error('Search failed'))
      );

      const res = await app.request('/api/v1/search/releases?q=test');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Search failed');
    });
  });

  describe('POST /api/v1/search/grab', () => {
    test('should grab a release successfully', async () => {
      const res = await app.request('/api/v1/search/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 1,
          release: {
            title: 'Test Game v1.0',
            downloadUrl: 'https://example.com/torrent',
            size: 50000000000,
            seeders: 100,
            indexer: 'TestIndexer',
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.releaseId).toBe(1);
      expect(json.data.torrentHash).toBe('abc123');
    });

    test('should grab a release with magnet URL', async () => {
      const res = await app.request('/api/v1/search/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 1,
          release: {
            title: 'Test Game v1.0',
            magnetUrl: 'magnet:?xt=urn:btih:abc123',
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test('should return 400 for missing gameId', async () => {
      const res = await app.request('/api/v1/search/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          release: {
            title: 'Test Game v1.0',
          },
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for missing release title', async () => {
      const res = await app.request('/api/v1/search/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 1,
          release: {},
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should handle download service errors', async () => {
      mockDownloadService.grabRelease.mockImplementationOnce(() =>
        Promise.reject(new Error('Download failed'))
      );

      const res = await app.request('/api/v1/search/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 1,
          release: {
            title: 'Test Game v1.0',
            downloadUrl: 'https://example.com/torrent',
          },
        }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Download failed');
    });
  });
});
