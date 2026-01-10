import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { ErrorCode } from '../../src/server/utils/errors';

// ============================================================================
// STEAM ROUTES TESTS
// ============================================================================

describe('Steam Routes', () => {
  // Mock Steam game data
  const mockSteamGame = {
    appId: 123456,
    name: 'Test Steam Game',
    playtimeMinutes: 1200,
    iconUrl: 'https://cdn.steam.com/icon/123456.jpg',
    logoUrl: 'https://cdn.steam.com/logo/123456.jpg',
    rtimeLastPlayed: Date.now() / 1000,
  };

  const mockSteamGame2 = {
    appId: 789012,
    name: 'Another Steam Game',
    playtimeMinutes: 300,
    iconUrl: 'https://cdn.steam.com/icon/789012.jpg',
    logoUrl: 'https://cdn.steam.com/logo/789012.jpg',
    rtimeLastPlayed: Date.now() / 1000,
  };

  // Mock existing game in library
  const mockExistingGame = {
    id: 1,
    igdbId: 55555,
    title: 'Test Steam Game',
    status: 'downloaded',
  };

  // Mock IGDB search result
  const mockIGDBResult = {
    igdbId: 77777,
    title: 'Test Steam Game',
    year: 2023,
    coverUrl: 'https://images.igdb.com/cover.jpg',
  };

  // Mock services
  const mockSettingsService = {
    getSetting: mock((key: string) => {
      if (key === 'steam_api_key') return Promise.resolve('test-api-key');
      if (key === 'steam_id') return Promise.resolve('76561198012345678');
      if (key === 'igdb_client_id') return Promise.resolve('igdb-client-id');
      if (key === 'igdb_client_secret') return Promise.resolve('igdb-secret');
      return Promise.resolve(null);
    }),
  };

  const mockSteamClient = {
    testConnection: mock(() =>
      Promise.resolve({ success: true, playerName: 'TestPlayer' })
    ),
    getOwnedGames: mock(() => Promise.resolve([mockSteamGame, mockSteamGame2])),
  };

  const mockGameService = {
    getAllGames: mock(() => Promise.resolve([mockExistingGame])),
    createGame: mock((data: Record<string, unknown>) =>
      Promise.resolve({ id: 2, ...data })
    ),
  };

  const mockIGDBClient = {
    searchGamesBatch: mock(() => {
      const map = new Map();
      map.set('Test Steam Game', [mockIGDBResult]);
      map.set('Another Steam Game', [{ ...mockIGDBResult, igdbId: 88888 }]);
      return Promise.resolve(map);
    }),
  };

  // Create test app with steam routes
  const createSteamApp = () => {
    const app = new Hono();

    // GET /api/v1/steam/test - Test Steam connection
    app.get('/api/v1/steam/test', async (c) => {
      try {
        const apiKey = await mockSettingsService.getSetting('steam_api_key');
        const steamId = await mockSettingsService.getSetting('steam_id');

        if (!apiKey || !steamId) {
          return c.json(
            {
              success: false,
              error: 'Steam API key and Steam ID are required',
              code: ErrorCode.NOT_CONFIGURED,
            },
            400
          );
        }

        const result = await mockSteamClient.testConnection();

        if (result.success) {
          return c.json({
            success: true,
            data: { connected: true, playerName: result.playerName },
          });
        } else {
          return c.json(
            {
              success: false,
              error: 'Steam connection failed',
              code: ErrorCode.STEAM_ERROR,
            },
            502
          );
        }
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

    // GET /api/v1/steam/owned-games - Get owned Steam games
    app.get('/api/v1/steam/owned-games', async (c) => {
      try {
        const apiKey = await mockSettingsService.getSetting('steam_api_key');
        const steamId = await mockSettingsService.getSetting('steam_id');

        if (!apiKey || !steamId) {
          return c.json(
            {
              success: false,
              error: 'Steam API key and Steam ID are required',
              code: ErrorCode.NOT_CONFIGURED,
            },
            400
          );
        }

        const games = await mockSteamClient.getOwnedGames();
        const existingGames = await mockGameService.getAllGames();

        // Simple normalization for testing
        const normalize = (title: string) => title.toLowerCase().trim();
        const existingTitles = new Set(existingGames.map((g) => normalize(g.title)));

        const enrichedGames = games.map((game) => ({
          ...game,
          alreadyInLibrary: existingTitles.has(normalize(game.name)),
          headerImageUrl: `https://cdn.steam.com/header/${game.appId}.jpg`,
        }));

        enrichedGames.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);

        return c.json({
          success: true,
          data: enrichedGames,
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

    // POST /api/v1/steam/import - Import selected Steam games
    app.post('/api/v1/steam/import', async (c) => {
      try {
        const body = await c.req.json();
        const { appIds } = body;

        if (!appIds || !appIds.length) {
          return c.json(
            {
              success: false,
              error: 'No games selected for import',
              code: ErrorCode.VALIDATION_ERROR,
            },
            400
          );
        }

        const apiKey = await mockSettingsService.getSetting('steam_api_key');
        const steamId = await mockSettingsService.getSetting('steam_id');

        if (!apiKey || !steamId) {
          return c.json(
            {
              success: false,
              error: 'Steam API key and Steam ID are required',
              code: ErrorCode.STEAM_NOT_CONFIGURED,
            },
            400
          );
        }

        const igdbClientId = await mockSettingsService.getSetting('igdb_client_id');
        const igdbClientSecret = await mockSettingsService.getSetting(
          'igdb_client_secret'
        );

        if (!igdbClientId || !igdbClientSecret) {
          return c.json(
            {
              success: false,
              error: 'IGDB credentials are required for Steam import',
              code: ErrorCode.NOT_CONFIGURED,
            },
            400
          );
        }

        const ownedGames = await mockSteamClient.getOwnedGames();
        const selectedGames = ownedGames.filter((g) => appIds.includes(g.appId));
        const existingGames = await mockGameService.getAllGames();

        const normalize = (title: string) => title.toLowerCase().trim();
        const existingTitles = new Set(existingGames.map((g) => normalize(g.title)));
        const existingIgdbIds = new Set(existingGames.map((g) => g.igdbId));

        const gamesToImport = selectedGames.filter(
          (g) => !existingTitles.has(normalize(g.name))
        );

        if (gamesToImport.length === 0) {
          return c.json({
            success: true,
            data: {
              imported: 0,
              skipped: selectedGames.length,
              errors: undefined,
            },
          });
        }

        const igdbResults = await mockIGDBClient.searchGamesBatch(
          gamesToImport.map((g) => g.name),
          5
        );

        let imported = 0;
        let skipped = selectedGames.length - gamesToImport.length;
        const errors: string[] = [];

        for (const steamGame of gamesToImport) {
          const searchResults = igdbResults.get(steamGame.name) || [];

          if (searchResults.length === 0) {
            errors.push(`Could not find "${steamGame.name}" on IGDB - skipping`);
            continue;
          }

          const igdbData = searchResults[0];

          if (existingIgdbIds.has(igdbData.igdbId)) {
            skipped++;
            continue;
          }

          existingIgdbIds.add(igdbData.igdbId);
          await mockGameService.createGame({
            title: igdbData.title,
            igdbId: igdbData.igdbId,
            status: 'downloaded',
            store: 'Steam',
          });
          imported++;
        }

        return c.json({
          success: true,
          data: {
            imported,
            skipped,
            errors: errors.length > 0 ? errors : undefined,
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

  let app: ReturnType<typeof createSteamApp>;

  beforeEach(() => {
    app = createSteamApp();
    // Reset mocks and restore default implementations
    mockSettingsService.getSetting.mockReset();
    mockSettingsService.getSetting.mockImplementation((key: string) => {
      if (key === 'steam_api_key') return Promise.resolve('test-api-key');
      if (key === 'steam_id') return Promise.resolve('76561198012345678');
      if (key === 'igdb_client_id') return Promise.resolve('igdb-client-id');
      if (key === 'igdb_client_secret') return Promise.resolve('igdb-secret');
      return Promise.resolve(null);
    });

    mockSteamClient.testConnection.mockReset();
    mockSteamClient.testConnection.mockImplementation(() =>
      Promise.resolve({ success: true, playerName: 'TestPlayer' })
    );

    mockSteamClient.getOwnedGames.mockReset();
    mockSteamClient.getOwnedGames.mockImplementation(() =>
      Promise.resolve([mockSteamGame, mockSteamGame2])
    );

    mockGameService.getAllGames.mockReset();
    mockGameService.getAllGames.mockImplementation(() =>
      Promise.resolve([mockExistingGame])
    );

    mockGameService.createGame.mockReset();
    mockGameService.createGame.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve({ id: 2, ...data })
    );

    mockIGDBClient.searchGamesBatch.mockReset();
    mockIGDBClient.searchGamesBatch.mockImplementation(() => {
      const map = new Map();
      map.set('Test Steam Game', [mockIGDBResult]);
      map.set('Another Steam Game', [{ ...mockIGDBResult, igdbId: 88888 }]);
      return Promise.resolve(map);
    });
  });

  describe('GET /api/v1/steam/test', () => {
    test('should return connected status with player name', async () => {
      const res = await app.request('/api/v1/steam/test');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.connected).toBe(true);
      expect(json.data.playerName).toBe('TestPlayer');
    });

    test('should return 400 when Steam API key is not configured', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'steam_api_key') return Promise.resolve(null);
        if (key === 'steam_id') return Promise.resolve('76561198012345678');
        return Promise.resolve(null);
      });

      const res = await app.request('/api/v1/steam/test');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Steam API key and Steam ID are required');
      expect(json.code).toBe(ErrorCode.NOT_CONFIGURED);
    });

    test('should return 400 when Steam ID is not configured', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'steam_api_key') return Promise.resolve('test-api-key');
        if (key === 'steam_id') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const res = await app.request('/api/v1/steam/test');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Steam API key and Steam ID are required');
    });

    test('should return 502 when Steam connection fails', async () => {
      mockSteamClient.testConnection.mockImplementationOnce(() =>
        Promise.resolve({ success: false, error: 'Invalid API key' })
      );

      const res = await app.request('/api/v1/steam/test');

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.STEAM_ERROR);
    });

    test('should handle service errors', async () => {
      mockSteamClient.testConnection.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      const res = await app.request('/api/v1/steam/test');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Network error');
    });
  });

  describe('GET /api/v1/steam/owned-games', () => {
    test('should return owned games sorted by playtime', async () => {
      const res = await app.request('/api/v1/steam/owned-games');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      // First game should have more playtime
      expect(json.data[0].playtimeMinutes).toBe(1200);
      expect(json.data[1].playtimeMinutes).toBe(300);
    });

    test('should mark games already in library', async () => {
      const res = await app.request('/api/v1/steam/owned-games');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const existingGame = json.data.find(
        (g: { name: string }) => g.name === 'Test Steam Game'
      );
      const newGame = json.data.find(
        (g: { name: string }) => g.name === 'Another Steam Game'
      );

      expect(existingGame.alreadyInLibrary).toBe(true);
      expect(newGame.alreadyInLibrary).toBe(false);
    });

    test('should include header image URLs', async () => {
      const res = await app.request('/api/v1/steam/owned-games');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data[0].headerImageUrl).toContain('cdn.steam.com');
    });

    test('should return 400 when Steam not configured', async () => {
      mockSettingsService.getSetting.mockImplementation(() => Promise.resolve(null));

      const res = await app.request('/api/v1/steam/owned-games');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.NOT_CONFIGURED);
    });

    test('should handle service errors', async () => {
      mockSteamClient.getOwnedGames.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to fetch games'))
      );

      const res = await app.request('/api/v1/steam/owned-games');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to fetch games');
    });
  });

  describe('POST /api/v1/steam/import', () => {
    test('should import games successfully', async () => {
      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [789012] }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.imported).toBe(1);
      expect(json.data.skipped).toBe(0);
    });

    test('should skip games already in library by title', async () => {
      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [123456] }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.imported).toBe(0);
      expect(json.data.skipped).toBe(1);
    });

    test('should return 400 for empty appIds array', async () => {
      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [] }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('No games selected for import');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should return 400 for missing appIds', async () => {
      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('No games selected for import');
    });

    test('should return 400 when Steam not configured', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'steam_api_key') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [123456] }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.STEAM_NOT_CONFIGURED);
    });

    test('should return 400 when IGDB not configured', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'steam_api_key') return Promise.resolve('test-key');
        if (key === 'steam_id') return Promise.resolve('12345');
        if (key === 'igdb_client_id') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [123456] }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('IGDB credentials are required for Steam import');
      expect(json.code).toBe(ErrorCode.NOT_CONFIGURED);
    });

    test('should report errors for games not found on IGDB', async () => {
      mockIGDBClient.searchGamesBatch.mockImplementationOnce(() => {
        const map = new Map();
        // Return empty results for all games
        return Promise.resolve(map);
      });

      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [789012] }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.imported).toBe(0);
      expect(json.data.errors).toBeDefined();
      expect(json.data.errors.length).toBeGreaterThan(0);
    });

    test('should handle service errors', async () => {
      mockSteamClient.getOwnedGames.mockImplementationOnce(() =>
        Promise.reject(new Error('Steam API error'))
      );

      const res = await app.request('/api/v1/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [123456] }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Steam API error');
    });
  });
});
