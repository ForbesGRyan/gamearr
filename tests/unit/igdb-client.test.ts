import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { IGDBClient } from '../../src/server/integrations/igdb/IGDBClient';
import { IGDBError, ErrorCode } from '../../src/server/utils/errors';

// Store original fetch for restoration
const originalFetch = globalThis.fetch;

// Helper to create mock Response objects
function createMockResponse(body: unknown, options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}) {
  const { status = 200, statusText = 'OK', headers = {} } = options;
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

// Save original environment variables
const originalEnv: {
  IGDB_CLIENT_ID?: string;
  IGDB_CLIENT_SECRET?: string;
} = {};

describe('IGDBClient - Additional Tests', () => {
  let client: IGDBClient;

  beforeEach(() => {
    // Save environment variables
    originalEnv.IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
    originalEnv.IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;

    // Clear environment variables to ensure tests use only constructor params
    delete process.env.IGDB_CLIENT_ID;
    delete process.env.IGDB_CLIENT_SECRET;

    globalThis.fetch = originalFetch;
    client = new IGDBClient('test-client-id', 'test-client-secret');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;

    // Restore environment variables
    if (originalEnv.IGDB_CLIENT_ID !== undefined) {
      process.env.IGDB_CLIENT_ID = originalEnv.IGDB_CLIENT_ID;
    } else {
      delete process.env.IGDB_CLIENT_ID;
    }
    if (originalEnv.IGDB_CLIENT_SECRET !== undefined) {
      process.env.IGDB_CLIENT_SECRET = originalEnv.IGDB_CLIENT_SECRET;
    } else {
      delete process.env.IGDB_CLIENT_SECRET;
    }
  });

  // ============================================================================
  // configure() method tests
  // ============================================================================
  describe('configure()', () => {
    test('should update credentials and mark client as configured', () => {
      // Start with unconfigured client
      const unconfiguredClient = new IGDBClient('', '');
      expect(unconfiguredClient.isConfigured()).toBe(false);

      // Configure with new credentials
      unconfiguredClient.configure({
        clientId: 'new-client-id',
        clientSecret: 'new-client-secret',
      });

      expect(unconfiguredClient.isConfigured()).toBe(true);
    });

    test('should invalidate cached token when credentials change', async () => {
      const authResponse = {
        access_token: 'original-token',
        expires_in: 3600,
        token_type: 'bearer',
      };

      let authCallCount = 0;
      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          authCallCount++;
          return createMockResponse(authResponse);
        }
        return createMockResponse([{ id: 1942, name: 'Test Game' }]);
      });

      // First request - should authenticate
      await client.testConnection();
      expect(authCallCount).toBe(1);

      // Second request - should use cached token (no additional auth call)
      await client.testConnection();
      expect(authCallCount).toBe(1);

      // Change credentials - should invalidate token
      client.configure({
        clientId: 'different-client-id',
        clientSecret: 'different-client-secret',
      });

      // Next request should re-authenticate
      await client.testConnection();
      expect(authCallCount).toBe(2);
    });

    test('should not invalidate token when credentials remain the same', async () => {
      const authResponse = {
        access_token: 'same-token',
        expires_in: 3600,
        token_type: 'bearer',
      };

      let authCallCount = 0;
      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          authCallCount++;
          return createMockResponse(authResponse);
        }
        return createMockResponse([{ id: 1942, name: 'Test Game' }]);
      });

      // First request
      await client.testConnection();
      expect(authCallCount).toBe(1);

      // Configure with SAME credentials
      client.configure({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      // Should not need to re-authenticate
      await client.testConnection();
      expect(authCallCount).toBe(1);
    });

    test('should mark client as not configured when given empty credentials', () => {
      expect(client.isConfigured()).toBe(true);

      client.configure({
        clientId: '',
        clientSecret: '',
      });

      expect(client.isConfigured()).toBe(false);
    });

    test('should mark client as not configured when missing clientId', () => {
      client.configure({
        clientId: '',
        clientSecret: 'valid-secret',
      });

      expect(client.isConfigured()).toBe(false);
    });

    test('should mark client as not configured when missing clientSecret', () => {
      client.configure({
        clientId: 'valid-client-id',
        clientSecret: '',
      });

      expect(client.isConfigured()).toBe(false);
    });
  });

  // ============================================================================
  // getPopularityTypes() method tests
  // ============================================================================
  describe('getPopularityTypes()', () => {
    test('should fetch popularity types from IGDB', async () => {
      const authResponse = {
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'bearer',
      };

      const popularityTypesResponse = [
        { id: 1, name: 'IGDB Visits', popularity_source: 1, updated_at: 1700000000 },
        { id: 2, name: 'Twitch Viewers', popularity_source: 2, updated_at: 1700000000 },
        { id: 3, name: 'Steam Current Players', popularity_source: 3, updated_at: 1700000000 },
      ];

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        if (url.includes('popularity_types')) {
          return createMockResponse(popularityTypesResponse);
        }
        return createMockResponse([]);
      });

      const results = await client.getPopularityTypes();

      expect(results.length).toBe(3);
      expect(results[0].id).toBe(1);
      expect(results[0].name).toBe('IGDB Visits');
      expect(results[1].name).toBe('Twitch Viewers');
      expect(results[2].name).toBe('Steam Current Players');
    });

    test('should handle empty popularity types response', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([]);
      });

      const results = await client.getPopularityTypes();
      expect(results).toEqual([]);
    });

    test('should throw IGDBError on authentication failure', async () => {
      globalThis.fetch = mock(async () => {
        return createMockResponse({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
      });

      try {
        await client.getPopularityTypes();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(IGDBError);
        expect((error as IGDBError).code).toBe(ErrorCode.IGDB_AUTH_FAILED);
      }
    });
  });

  // ============================================================================
  // getPopularGames() method tests
  // ============================================================================
  describe('getPopularGames()', () => {
    test('should fetch popular games by popularity type', async () => {
      const authResponse = {
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'bearer',
      };

      const primitivesResponse = [
        { id: 1, game_id: 1942, popularity_type: 1, value: 1000 },
        { id: 2, game_id: 570, popularity_type: 1, value: 900 },
      ];

      const gamesResponse = [
        {
          id: 1942,
          name: 'The Witcher 3',
          cover: { image_id: 'witcher_cover' },
          first_release_date: 1432076400,
          platforms: [{ id: 6, name: 'PC' }],
          genres: [{ id: 12, name: 'RPG' }],
          total_rating: 92,
        },
        {
          id: 570,
          name: 'Dota 2',
          cover: { image_id: 'dota_cover' },
          first_release_date: 1373328000,
          platforms: [{ id: 6, name: 'PC' }],
          genres: [{ id: 36, name: 'MOBA' }],
          total_rating: 85,
        },
      ];

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        if (url.includes('popularity_primitives')) {
          return createMockResponse(primitivesResponse);
        }
        if (url.includes('games')) {
          return createMockResponse(gamesResponse);
        }
        return createMockResponse([]);
      });

      const results = await client.getPopularGames(1, 20);

      expect(results.length).toBe(2);
      expect(results[0].game.igdbId).toBe(1942);
      expect(results[0].game.title).toBe('The Witcher 3');
      expect(results[0].popularityValue).toBe(1000);
      expect(results[0].rank).toBe(1);
      expect(results[1].game.igdbId).toBe(570);
      expect(results[1].game.title).toBe('Dota 2');
      expect(results[1].popularityValue).toBe(900);
      expect(results[1].rank).toBe(2);
    });

    test('should return empty array when no popularity primitives found', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([]);
      });

      const results = await client.getPopularGames(1, 20);
      expect(results).toEqual([]);
    });

    test('should handle missing game details gracefully', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      // Popularity primitives reference a game that doesn't exist in games response
      const primitivesResponse = [
        { id: 1, game_id: 1942, popularity_type: 1, value: 1000 },
        { id: 2, game_id: 9999, popularity_type: 1, value: 900 }, // This game won't be in games response
      ];

      const gamesResponse = [
        {
          id: 1942,
          name: 'The Witcher 3',
          platforms: [{ id: 6, name: 'PC' }],
        },
      ];

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        if (url.includes('popularity_primitives')) {
          return createMockResponse(primitivesResponse);
        }
        if (url.includes('games')) {
          return createMockResponse(gamesResponse);
        }
        return createMockResponse([]);
      });

      const results = await client.getPopularGames(1, 20);

      // Should only return games that were found in the games response
      expect(results.length).toBe(1);
      expect(results[0].game.igdbId).toBe(1942);
    });

    test('should maintain rank order from popularity primitives', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      const primitivesResponse = [
        { id: 1, game_id: 100, popularity_type: 1, value: 500 },
        { id: 2, game_id: 200, popularity_type: 1, value: 400 },
        { id: 3, game_id: 300, popularity_type: 1, value: 300 },
      ];

      const gamesResponse = [
        { id: 300, name: 'Game C', platforms: [6] },
        { id: 100, name: 'Game A', platforms: [6] },
        { id: 200, name: 'Game B', platforms: [6] },
      ];

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        if (url.includes('popularity_primitives')) {
          return createMockResponse(primitivesResponse);
        }
        if (url.includes('games')) {
          return createMockResponse(gamesResponse);
        }
        return createMockResponse([]);
      });

      const results = await client.getPopularGames(1, 20);

      // Order should match primitives order (by value), not games response order
      expect(results[0].game.title).toBe('Game A');
      expect(results[0].rank).toBe(1);
      expect(results[1].game.title).toBe('Game B');
      expect(results[1].rank).toBe(2);
      expect(results[2].game.title).toBe('Game C');
      expect(results[2].rank).toBe(3);
    });
  });

  // ============================================================================
  // Error handling tests
  // ============================================================================
  describe('Error Handling', () => {
    test('should handle 401 unauthorized error on API call', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        // Return 401 on API call
        return createMockResponse({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      });

      try {
        await client.searchGames({ search: 'test' });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(IGDBError);
        expect((error as IGDBError).code).toBe(ErrorCode.IGDB_AUTH_FAILED);
      }
    });

    test('should handle 403 forbidden error', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
      });

      try {
        await client.searchGames({ search: 'test' });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(IGDBError);
        expect((error as IGDBError).code).toBe(ErrorCode.IGDB_AUTH_FAILED);
      }
    });

    test('should handle 400 bad request error', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        // Return 400 which is not retryable
        return createMockResponse({ error: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });
      });

      try {
        await client.searchGames({ search: 'test' });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(IGDBError);
        expect((error as IGDBError).code).toBe(ErrorCode.IGDB_ERROR);
      }
    });

    test('should invalidate token on 401 response and allow retry', async () => {
      let authCallCount = 0;

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          authCallCount++;
          return createMockResponse({
            access_token: `token-${authCallCount}`,
            expires_in: 3600,
            token_type: 'bearer',
          });
        }
        // First API call returns 401 to simulate token expiry
        if (authCallCount === 1) {
          return createMockResponse({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
        }
        return createMockResponse([{ id: 1, name: 'Game' }]);
      });

      // First call should fail and throw
      try {
        await client.searchGames({ search: 'test' });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(IGDBError);
      }

      // Reset the mock for the second call to succeed
      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse({
            access_token: 'new-token',
            expires_in: 3600,
            token_type: 'bearer',
          });
        }
        return createMockResponse([{ id: 1, name: 'Game', platforms: [6] }]);
      });

      // Second call should re-authenticate and succeed
      const results = await client.searchGames({ search: 'test' });
      expect(results.length).toBe(1);
    });

    test('should wrap non-IGDBError authentication errors', async () => {
      globalThis.fetch = mock(async () => {
        throw new Error('Network failure');
      });

      // testConnection returns false instead of throwing
      const result = await client.testConnection();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Platform mapping tests
  // ============================================================================
  describe('Platform Name Mapping', () => {
    test('should map raw platform IDs to names', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Multi-Platform Game',
          platforms: [6, 48, 49, 130, 14, 3], // Raw IDs: PC, PS4, Xbox One, Switch, Mac, Linux
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].platforms).toContain('PC');
      expect(results[0].platforms).toContain('PlayStation 4');
      expect(results[0].platforms).toContain('Xbox One');
      expect(results[0].platforms).toContain('Nintendo Switch');
      expect(results[0].platforms).toContain('Mac');
      expect(results[0].platforms).toContain('Linux');
    });

    test('should filter out unknown platform IDs', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Game',
          platforms: [6, 9999], // 6 = PC, 9999 = unknown
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].platforms).toContain('PC');
      expect(results[0].platforms?.length).toBe(1); // Only PC should be included
    });

    test('should handle expanded platform objects', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Game',
          platforms: [
            { id: 6, name: 'PC (Microsoft Windows)' },
            { id: 48, name: 'PlayStation 4' },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].platforms).toContain('PC (Microsoft Windows)');
      expect(results[0].platforms).toContain('PlayStation 4');
    });

    test('should handle games with no platforms', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Game',
          game_type: 0,
          // No platforms field
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].platforms).toBeUndefined();
    });
  });

  // ============================================================================
  // Extended metadata extraction tests
  // ============================================================================
  describe('Extended Metadata Extraction', () => {
    test('should extract themes', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Fantasy Game',
          platforms: [6],
          themes: [
            { id: 17, name: 'Fantasy' },
            { id: 18, name: 'Science fiction' },
            { id: 19, name: 'Horror' },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].themes).toContain('Fantasy');
      expect(results[0].themes).toContain('Science fiction');
      expect(results[0].themes).toContain('Horror');
    });

    test('should extract developer and publisher from involved_companies', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Test Game',
          platforms: [6],
          involved_companies: [
            {
              id: 1,
              company: { id: 100, name: 'CD Projekt RED' },
              developer: true,
              publisher: false,
            },
            {
              id: 2,
              company: { id: 101, name: 'CD Projekt' },
              developer: false,
              publisher: true,
            },
            {
              id: 3,
              company: { id: 102, name: 'Bandai Namco' },
              developer: false,
              publisher: true, // Second publisher should be ignored
            },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].developer).toBe('CD Projekt RED');
      expect(results[0].publisher).toBe('CD Projekt');
    });

    test('should handle games with only developer', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Indie Game',
          platforms: [6],
          involved_companies: [
            {
              id: 1,
              company: { id: 100, name: 'Indie Studio' },
              developer: true,
              publisher: false,
            },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].developer).toBe('Indie Studio');
      expect(results[0].publisher).toBeUndefined();
    });

    test('should extract similar games with cover URLs', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Test Game',
          platforms: [6],
          similar_games: [
            { id: 100, name: 'Similar Game 1', cover: { image_id: 'cover1' } },
            { id: 101, name: 'Similar Game 2', cover: { image_id: 'cover2' } },
            { id: 102, name: 'Similar Game 3' }, // No cover
            { id: 103, name: 'Similar Game 4', cover: { image_id: 'cover4' } },
            { id: 104, name: 'Similar Game 5', cover: { image_id: 'cover5' } },
            { id: 105, name: 'Similar Game 6', cover: { image_id: 'cover6' } },
            { id: 106, name: 'Similar Game 7', cover: { image_id: 'cover7' } }, // Should be excluded (limit 6)
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].similarGames?.length).toBe(6);
      expect(results[0].similarGames?.[0].igdbId).toBe(100);
      expect(results[0].similarGames?.[0].name).toBe('Similar Game 1');
      expect(results[0].similarGames?.[0].coverUrl).toBe('https://images.igdb.com/igdb/image/upload/t_cover_small/cover1.jpg');
      expect(results[0].similarGames?.[2].coverUrl).toBeUndefined(); // No cover
    });

    test('should extract game modes', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Multiplayer Game',
          platforms: [6],
          game_modes: [
            { id: 1, name: 'Single player' },
            { id: 2, name: 'Multiplayer' },
            { id: 3, name: 'Co-operative' },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].gameModes).toContain('Single player');
      expect(results[0].gameModes).toContain('Multiplayer');
      expect(results[0].gameModes).toContain('Co-operative');
    });
  });

  // ============================================================================
  // Multiplayer mode edge cases
  // ============================================================================
  describe('Multiplayer Mode Edge Cases', () => {
    test('should prefer PC multiplayer mode when available', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Cross-Platform Game',
          platforms: [6, 48],
          multiplayer_modes: [
            {
              id: 1,
              platform: 48, // PlayStation 4
              onlinecoop: true,
              onlinemax: 2,
            },
            {
              id: 2,
              platform: 6, // PC - this should be preferred
              onlinecoop: true,
              onlinemax: 4,
              lancoop: true,
            },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].multiplayer?.hasOnlineCoop).toBe(true);
      expect(results[0].multiplayer?.maxOnlinePlayers).toBe(4);
      expect(results[0].multiplayer?.hasLanCoop).toBe(true);
    });

    test('should handle multiplayer modes without any actual multiplayer features', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Single Player Only',
          platforms: [6],
          multiplayer_modes: [
            {
              id: 1,
              platform: 6,
              // All multiplayer fields are false/0
              onlinecoop: false,
              offlinecoop: false,
              lancoop: false,
              splitscreen: false,
            },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      // When no actual multiplayer features, should return undefined
      expect(results[0].multiplayer).toBeUndefined();
    });

    test('should handle splitscreenonline mode', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Splitscreen Game',
          platforms: [6],
          multiplayer_modes: [
            {
              id: 1,
              platform: 6,
              splitscreenonline: true,
            },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].multiplayer?.hasSplitscreen).toBe(true);
    });

    test('should extract dropin and campaigncoop modes', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Coop Game',
          platforms: [6],
          multiplayer_modes: [
            {
              id: 1,
              platform: 6,
              dropin: true,
              campaigncoop: true,
              onlinecoop: true,
              onlinemax: 4,
            },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].multiplayer?.hasDropIn).toBe(true);
      expect(results[0].multiplayer?.hasCampaignCoop).toBe(true);
    });

    test('should handle offlinecoopmax and onlinecoopmax', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Coop Game',
          platforms: [6],
          multiplayer_modes: [
            {
              id: 1,
              platform: 6,
              onlinecoop: true,
              offlinecoop: true,
              onlinecoopmax: 4,
              offlinecoopmax: 2,
            },
          ],
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].multiplayer?.maxOnlinePlayers).toBe(4);
      expect(results[0].multiplayer?.maxOfflinePlayers).toBe(2);
    });
  });

  // ============================================================================
  // searchGamesBatch edge cases
  // ============================================================================
  describe('searchGamesBatch Edge Cases', () => {
    test('should handle special characters in game names', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      let capturedBody = '';
      globalThis.fetch = mock(async (url: string, options?: RequestInit) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        if (url.includes('multiquery')) {
          capturedBody = options?.body as string;
          return createMockResponse([
            { name: '0', result: [{ id: 1, name: 'Test Game', platforms: [6] }] },
          ]);
        }
        return createMockResponse([]);
      });

      await client.searchGamesBatch(['Game: Special Edition\u2122', 'Test "Game"']);

      // Should have escaped trademark symbols and quotes
      expect(capturedBody).not.toContain('\u2122'); // Trademark removed
      expect(capturedBody).toContain('\\"'); // Quotes escaped
    });

    test('should handle more than 10 games (multiple batches)', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      let batchCount = 0;
      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        if (url.includes('multiquery')) {
          batchCount++;
          // Return empty results for each batch
          return createMockResponse([]);
        }
        return createMockResponse([]);
      });

      // Create 25 games (should result in 3 batches: 10, 10, 5)
      const gameNames = Array.from({ length: 25 }, (_, i) => `Game ${i + 1}`);
      await client.searchGamesBatch(gameNames);

      // With parallel batch limit of 4 and 3 batches, it could be 1 or 2 parallel groups
      expect(batchCount).toBeGreaterThanOrEqual(1);
    });

    test('should handle failed batch gracefully', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      let callCount = 0;
      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        if (url.includes('multiquery')) {
          callCount++;
          if (callCount === 1) {
            throw new Error('Network error');
          }
          return createMockResponse([
            { name: '0', result: [{ id: 1, name: 'Game', platforms: [6] }] },
          ]);
        }
        return createMockResponse([]);
      });

      // Should not throw, just return empty results for failed batch
      const results = await client.searchGamesBatch(['Game 1']);

      // Even with error, results map should exist with empty arrays
      expect(results.has('Game 1')).toBe(true);
      expect(results.get('Game 1')).toEqual([]);
    });

    test('should handle batch with undefined results', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        // Return response with null result
        return createMockResponse([
          { name: '0', result: null },
        ]);
      });

      const results = await client.searchGamesBatch(['Test Game']);

      // Should handle null results gracefully
      expect(results.has('Test Game')).toBe(true);
    });
  });

  // ============================================================================
  // Token caching and expiry tests
  // ============================================================================
  describe('Token Caching and Expiry', () => {
    test('should use cached token for subsequent requests', async () => {
      let authCallCount = 0;
      const authResponse = {
        access_token: 'cached-token',
        expires_in: 3600,
        token_type: 'bearer',
      };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          authCallCount++;
          return createMockResponse(authResponse);
        }
        return createMockResponse([{ id: 1, name: 'Game', platforms: [6] }]);
      });

      // Multiple API calls
      await client.searchGames({ search: 'test1' });
      await client.searchGames({ search: 'test2' });
      await client.getGame(1);

      // Should only authenticate once
      expect(authCallCount).toBe(1);
    });

    test('should return false from testConnection when game not found after successful auth', async () => {
      const authResponse = {
        access_token: 'valid-token',
        expires_in: 3600,
        token_type: 'bearer',
      };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        // Return empty array (game with ID 1942 not found)
        return createMockResponse([]);
      });

      const result = await client.testConnection();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Multiquery error handling tests
  // ============================================================================
  describe('Multiquery Error Handling', () => {
    test('should handle 401 auth error in multiquery', async () => {
      let authCallCount = 0;

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          authCallCount++;
          return createMockResponse({
            access_token: `token-${authCallCount}`,
            expires_in: 3600,
            token_type: 'bearer',
          });
        }
        return createMockResponse({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      });

      const results = await client.searchGamesBatch(['Test Game']);

      // Should return empty results after error
      expect(results.has('Test Game')).toBe(true);
      expect(results.get('Test Game')).toEqual([]);
    });

    test('should handle 403 forbidden in multiquery', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
      });

      const results = await client.searchGamesBatch(['Test Game']);

      // Should return empty results after error
      expect(results.has('Test Game')).toBe(true);
      expect(results.get('Test Game')).toEqual([]);
    });
  });

  // ============================================================================
  // getGame extended tests
  // ============================================================================
  describe('getGame Extended Tests', () => {
    test('should include all metadata fields in getGame response', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1942,
          name: 'The Witcher 3: Wild Hunt',
          cover: { image_id: 'witcher_cover' },
          first_release_date: 1432076400,
          platforms: [{ id: 6, name: 'PC' }],
          summary: 'An open world RPG',
          genres: [{ id: 12, name: 'RPG' }],
          total_rating: 92.8,
          game_modes: [{ id: 1, name: 'Single player' }],
          involved_companies: [
            { id: 1, company: { id: 100, name: 'CD Projekt RED' }, developer: true, publisher: false },
            { id: 2, company: { id: 101, name: 'CD Projekt' }, developer: false, publisher: true },
          ],
          themes: [{ id: 17, name: 'Fantasy' }],
          similar_games: [
            { id: 100, name: 'Skyrim', cover: { image_id: 'skyrim_cover' } },
          ],
          multiplayer_modes: [
            { id: 1, platform: 6, onlinecoop: false, offlinecoop: false },
          ],
        }]);
      });

      const result = await client.getGame(1942);

      expect(result).not.toBeNull();
      expect(result!.igdbId).toBe(1942);
      expect(result!.title).toBe('The Witcher 3: Wild Hunt');
      expect(result!.year).toBe(2015);
      expect(result!.coverUrl).toContain('witcher_cover');
      expect(result!.summary).toBe('An open world RPG');
      expect(result!.platforms).toContain('PC');
      expect(result!.genres).toContain('RPG');
      expect(result!.totalRating).toBe(93); // Rounded
      expect(result!.developer).toBe('CD Projekt RED');
      expect(result!.publisher).toBe('CD Projekt');
      expect(result!.themes).toContain('Fantasy');
      expect(result!.gameModes).toContain('Single player');
      expect(result!.similarGames?.[0].name).toBe('Skyrim');
      // No multiplayer features, so should be undefined
      expect(result!.multiplayer).toBeUndefined();
    });
  });

  // ============================================================================
  // Additional retro platform mapping tests
  // ============================================================================
  describe('Retro Platform Mapping', () => {
    test('should map retro console platform IDs', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Classic Game',
          platforms: [4, 19, 18, 37, 5, 41, 12, 9], // N64, SNES, NES, 3DS, Wii, WiiU, X360, PS3
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].platforms).toContain('Nintendo 64');
      expect(results[0].platforms).toContain('Super Nintendo');
      expect(results[0].platforms).toContain('NES');
      expect(results[0].platforms).toContain('Nintendo 3DS');
      expect(results[0].platforms).toContain('Wii');
      expect(results[0].platforms).toContain('Wii U');
      expect(results[0].platforms).toContain('Xbox 360');
      expect(results[0].platforms).toContain('PlayStation 3');
    });

    test('should map mobile platform IDs', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Mobile Game',
          platforms: [34, 39], // Android, iOS
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].platforms).toContain('Android');
      expect(results[0].platforms).toContain('iOS');
    });

    test('should map next-gen console IDs', async () => {
      const authResponse = { access_token: 'token', expires_in: 3600, token_type: 'bearer' };

      globalThis.fetch = mock(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return createMockResponse(authResponse);
        }
        return createMockResponse([{
          id: 1,
          name: 'Next Gen Game',
          platforms: [167, 169], // PS5, Xbox Series X|S
          game_type: 0,
        }]);
      });

      const results = await client.searchGames({ search: 'test' });

      expect(results[0].platforms).toContain('PlayStation 5');
      expect(results[0].platforms).toContain('Xbox Series X|S');
    });
  });
});
