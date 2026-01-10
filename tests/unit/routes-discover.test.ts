import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';

// ============================================================================
// DISCOVER ROUTES TESTS
// ============================================================================

describe('Discover Routes', () => {
  // Mock popularity types
  const mockPopularityTypes = [
    { id: 1, name: 'Follows' },
    { id: 2, name: 'Want to Play' },
    { id: 3, name: 'Playing' },
    { id: 4, name: 'Played' },
    { id: 5, name: 'Peak Concurrent Users' },
    { id: 6, name: 'Most Collected' },
    { id: 7, name: 'Recent Releases' },
    { id: 8, name: 'Trending' },
  ];

  // Mock popular game
  const mockPopularGame = {
    game: {
      igdbId: 12345,
      title: 'Popular Game',
      year: 2024,
      coverUrl: 'https://example.com/cover.jpg',
      summary: 'A very popular game',
    },
    value: 50000,
    popularity_type: 2,
  };

  const mockPopularGame2 = {
    game: {
      igdbId: 67890,
      title: 'Another Popular Game',
      year: 2024,
      coverUrl: 'https://example.com/cover2.jpg',
      summary: 'Another popular game',
    },
    value: 40000,
    popularity_type: 2,
  };

  // Mock services
  const mockIGDBClient = {
    getPopularityTypes: mock(() => Promise.resolve(mockPopularityTypes)),
    getPopularGames: mock(() =>
      Promise.resolve([mockPopularGame, mockPopularGame2])
    ),
  };

  const mockGameService = {
    getAllIgdbIds: mock(() => Promise.resolve(new Set([12345]))),
  };

  // Create test app with discover routes
  const createDiscoverApp = () => {
    const app = new Hono();

    // GET /api/v1/discover/popularity-types - Get available popularity types
    app.get('/api/v1/discover/popularity-types', async (c) => {
      try {
        const types = await mockIGDBClient.getPopularityTypes();
        return c.json({ success: true, data: types });
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

    // GET /api/v1/discover/popular - Get popular games by type
    app.get('/api/v1/discover/popular', async (c) => {
      try {
        const typeParam = c.req.query('type');
        const limitParam = c.req.query('limit');

        // Default to type 2 ("Want to Play") if not specified or invalid
        let type = typeParam ? parseInt(typeParam) : 2;
        if (isNaN(type) || type < 1 || type > 8) {
          type = 2;
        }

        let limit = limitParam ? parseInt(limitParam) : 20;
        if (isNaN(limit) || limit < 1) {
          limit = 20;
        } else if (limit > 100) {
          limit = 100;
        }

        const popularGames = await mockIGDBClient.getPopularGames(type, limit);

        // Get all games in library to check which popular games are already added
        const libraryIgdbIds = await mockGameService.getAllIgdbIds();

        // Add inLibrary flag to each result
        const results = popularGames.map((pg) => ({
          ...pg,
          inLibrary: libraryIgdbIds.has(pg.game.igdbId),
        }));

        return c.json({
          success: true,
          data: results,
          meta: {
            popularityType: type,
            totalResults: results.length,
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

  let app: ReturnType<typeof createDiscoverApp>;

  beforeEach(() => {
    app = createDiscoverApp();
    mockIGDBClient.getPopularityTypes.mockClear();
    mockIGDBClient.getPopularGames.mockClear();
    mockGameService.getAllIgdbIds.mockClear();
  });

  describe('GET /api/v1/discover/popularity-types', () => {
    test('should return all popularity types', async () => {
      const res = await app.request('/api/v1/discover/popularity-types');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(8);
      expect(json.data[0].name).toBe('Follows');
      expect(json.data[1].name).toBe('Want to Play');
    });

    test('should handle service errors', async () => {
      mockIGDBClient.getPopularityTypes.mockImplementationOnce(() =>
        Promise.reject(new Error('IGDB connection failed'))
      );

      const res = await app.request('/api/v1/discover/popularity-types');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('IGDB connection failed');
    });
  });

  describe('GET /api/v1/discover/popular', () => {
    test('should return popular games with default parameters', async () => {
      const res = await app.request('/api/v1/discover/popular');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.meta.popularityType).toBe(2);
      expect(json.meta.totalResults).toBe(2);
      expect(mockIGDBClient.getPopularGames).toHaveBeenCalledWith(2, 20);
    });

    test('should return popular games with custom type', async () => {
      const res = await app.request('/api/v1/discover/popular?type=5');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.meta.popularityType).toBe(5);
      expect(mockIGDBClient.getPopularGames).toHaveBeenCalledWith(5, 20);
    });

    test('should return popular games with custom limit', async () => {
      const res = await app.request('/api/v1/discover/popular?limit=50');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockIGDBClient.getPopularGames).toHaveBeenCalledWith(2, 50);
    });

    test('should cap limit at 100', async () => {
      const res = await app.request('/api/v1/discover/popular?limit=200');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockIGDBClient.getPopularGames).toHaveBeenCalledWith(2, 100);
    });

    test('should use default type for invalid type value', async () => {
      const res = await app.request('/api/v1/discover/popular?type=invalid');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.meta.popularityType).toBe(2);
    });

    test('should use default type for out-of-range type value', async () => {
      const res = await app.request('/api/v1/discover/popular?type=99');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.meta.popularityType).toBe(2);
    });

    test('should use default type for zero type value', async () => {
      const res = await app.request('/api/v1/discover/popular?type=0');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.meta.popularityType).toBe(2);
    });

    test('should use default limit for invalid limit value', async () => {
      const res = await app.request('/api/v1/discover/popular?limit=invalid');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockIGDBClient.getPopularGames).toHaveBeenCalledWith(2, 20);
    });

    test('should use default limit for zero limit value', async () => {
      const res = await app.request('/api/v1/discover/popular?limit=0');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockIGDBClient.getPopularGames).toHaveBeenCalledWith(2, 20);
    });

    test('should mark games already in library', async () => {
      const res = await app.request('/api/v1/discover/popular');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const gameInLibrary = json.data.find(
        (g: { game: { igdbId: number } }) => g.game.igdbId === 12345
      );
      const gameNotInLibrary = json.data.find(
        (g: { game: { igdbId: number } }) => g.game.igdbId === 67890
      );

      expect(gameInLibrary.inLibrary).toBe(true);
      expect(gameNotInLibrary.inLibrary).toBe(false);
    });

    test('should handle service errors', async () => {
      mockIGDBClient.getPopularGames.mockImplementationOnce(() =>
        Promise.reject(new Error('IGDB API error'))
      );

      const res = await app.request('/api/v1/discover/popular');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('IGDB API error');
    });

    test('should return empty array when no popular games', async () => {
      mockIGDBClient.getPopularGames.mockImplementationOnce(() =>
        Promise.resolve([])
      );

      const res = await app.request('/api/v1/discover/popular');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
      expect(json.meta.totalResults).toBe(0);
    });

    test('should support type and limit together', async () => {
      const res = await app.request('/api/v1/discover/popular?type=3&limit=30');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.meta.popularityType).toBe(3);
      expect(mockIGDBClient.getPopularGames).toHaveBeenCalledWith(3, 30);
    });
  });
});
