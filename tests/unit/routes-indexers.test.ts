import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { ErrorCode } from '../../src/server/utils/errors';

// ============================================================================
// INDEXERS ROUTES TESTS
// ============================================================================

describe('Indexers Routes', () => {
  // Mock indexer data
  const mockIndexer = {
    id: 1,
    name: 'TestIndexer',
    enable: true,
    implementationName: 'Torznab',
    protocol: 'torrent',
  };

  // Mock release data with current date (within maxAge)
  const mockRelease = {
    guid: 'release-123',
    title: 'Test Game v1.0',
    size: 50000000000,
    seeders: 100,
    downloadUrl: 'https://example.com/torrent',
    indexer: 'TestIndexer',
    publishedAt: new Date(), // Use current date to be within the default 30-day maxAge
    score: 85,
  };

  // Mock indexer service
  const mockIndexerService = {
    getIndexers: mock(() => Promise.resolve([mockIndexer])),
    testConnection: mock(() => Promise.resolve(true)),
    manualSearch: mock(() => Promise.resolve([mockRelease])),
  };

  // Create test app with indexers routes
  const createIndexersApp = () => {
    const app = new Hono();

    // GET /api/v1/indexers - List indexers from Prowlarr
    app.get('/api/v1/indexers', async (c) => {
      try {
        const indexerList = await mockIndexerService.getIndexers();
        return c.json({ success: true, data: indexerList });
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

    // POST /api/v1/indexers - Add indexer (not implemented)
    app.post('/api/v1/indexers', async (c) => {
      return c.json({ success: true, message: 'Not implemented yet' }, 501);
    });

    // PUT /api/v1/indexers/:id - Update indexer (not implemented)
    app.put('/api/v1/indexers/:id', async (c) => {
      return c.json({ success: true, message: 'Not implemented yet' }, 501);
    });

    // DELETE /api/v1/indexers/:id - Delete indexer (not implemented)
    app.delete('/api/v1/indexers/:id', async (c) => {
      return c.json({ success: true, message: 'Not implemented yet' }, 501);
    });

    // GET /api/v1/indexers/test - Test Prowlarr connection
    app.get('/api/v1/indexers/test', async (c) => {
      try {
        const connected = await mockIndexerService.testConnection();
        return c.json({ success: true, data: connected });
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

    // GET /api/v1/indexers/torrents - Get top torrents from indexers
    app.get('/api/v1/indexers/torrents', async (c) => {
      const query = c.req.query('query') || 'game';
      const limitParam = c.req.query('limit');
      const maxAgeParam = c.req.query('maxAge');

      const limit = limitParam ? parseInt(limitParam) : 50;
      const maxAgeDays = maxAgeParam ? parseInt(maxAgeParam) : 30;

      if (limitParam && (isNaN(limit) || limit < 1)) {
        return c.json(
          {
            success: false,
            error: 'Invalid limit parameter',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }
      if (maxAgeParam && (isNaN(maxAgeDays) || maxAgeDays < 1)) {
        return c.json(
          {
            success: false,
            error: 'Invalid maxAge parameter',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      try {
        const releases = await mockIndexerService.manualSearch(query);

        const now = new Date();
        const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

        const filtered = releases.filter((release) => {
          const publishDate = new Date(release.publishedAt);
          return publishDate >= cutoffDate;
        });

        const sorted = filtered.sort((a, b) => b.seeders - a.seeders);

        return c.json({
          success: true,
          data: sorted.slice(0, limit),
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

  let app: ReturnType<typeof createIndexersApp>;

  beforeEach(() => {
    app = createIndexersApp();
    // Reset mocks but keep default implementations
    mockIndexerService.getIndexers.mockReset();
    mockIndexerService.testConnection.mockReset();
    mockIndexerService.manualSearch.mockReset();
    // Restore default implementations
    mockIndexerService.getIndexers.mockImplementation(() => Promise.resolve([mockIndexer]));
    mockIndexerService.testConnection.mockImplementation(() => Promise.resolve(true));
    mockIndexerService.manualSearch.mockImplementation(() => Promise.resolve([mockRelease]));
  });

  describe('GET /api/v1/indexers', () => {
    test('should return list of indexers', async () => {
      const res = await app.request('/api/v1/indexers');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('TestIndexer');
    });

    test('should handle service errors', async () => {
      mockIndexerService.getIndexers.mockImplementationOnce(() =>
        Promise.reject(new Error('Prowlarr not reachable'))
      );

      const res = await app.request('/api/v1/indexers');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Prowlarr not reachable');
    });

    test('should return empty array when no indexers configured', async () => {
      mockIndexerService.getIndexers.mockImplementationOnce(() => Promise.resolve([]));

      const res = await app.request('/api/v1/indexers');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });
  });

  describe('POST /api/v1/indexers', () => {
    test('should return 501 not implemented', async () => {
      const res = await app.request('/api/v1/indexers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'NewIndexer' }),
      });

      expect(res.status).toBe(501);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Not implemented yet');
    });
  });

  describe('PUT /api/v1/indexers/:id', () => {
    test('should return 501 not implemented', async () => {
      const res = await app.request('/api/v1/indexers/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: false }),
      });

      expect(res.status).toBe(501);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Not implemented yet');
    });
  });

  describe('DELETE /api/v1/indexers/:id', () => {
    test('should return 501 not implemented', async () => {
      const res = await app.request('/api/v1/indexers/1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(501);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Not implemented yet');
    });
  });

  describe('GET /api/v1/indexers/test', () => {
    test('should return true when connected', async () => {
      const res = await app.request('/api/v1/indexers/test');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe(true);
    });

    test('should return false when not connected', async () => {
      mockIndexerService.testConnection.mockImplementationOnce(() =>
        Promise.resolve(false)
      );

      const res = await app.request('/api/v1/indexers/test');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe(false);
    });

    test('should handle connection errors', async () => {
      mockIndexerService.testConnection.mockImplementationOnce(() =>
        Promise.reject(new Error('Connection timeout'))
      );

      const res = await app.request('/api/v1/indexers/test');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Connection timeout');
    });
  });

  describe('GET /api/v1/indexers/torrents', () => {
    test('should return torrents with default parameters', async () => {
      const res = await app.request('/api/v1/indexers/torrents');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(mockIndexerService.manualSearch).toHaveBeenCalledWith('game');
    });

    test('should return torrents with custom query', async () => {
      const res = await app.request('/api/v1/indexers/torrents?query=cyberpunk');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockIndexerService.manualSearch).toHaveBeenCalledWith('cyberpunk');
    });

    test('should limit results', async () => {
      const now = new Date();
      const manyReleases = Array(100)
        .fill(null)
        .map((_, i) => ({
          ...mockRelease,
          guid: `release-${i}`,
          seeders: 100 - i,
          publishedAt: now, // Ensure all releases are within maxAge
        }));
      mockIndexerService.manualSearch.mockImplementationOnce(() =>
        Promise.resolve(manyReleases)
      );

      const res = await app.request('/api/v1/indexers/torrents?limit=10');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(10);
    });

    test('should return 400 for invalid limit parameter', async () => {
      const res = await app.request('/api/v1/indexers/torrents?limit=-1');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid limit parameter');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should return 400 for non-numeric limit', async () => {
      const res = await app.request('/api/v1/indexers/torrents?limit=abc');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid limit parameter');
    });

    test('should return 400 for invalid maxAge parameter', async () => {
      const res = await app.request('/api/v1/indexers/torrents?maxAge=-1');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid maxAge parameter');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should return 400 for non-numeric maxAge', async () => {
      const res = await app.request('/api/v1/indexers/torrents?maxAge=abc');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid maxAge parameter');
    });

    test('should filter by maxAge', async () => {
      const oldRelease = {
        ...mockRelease,
        publishedAt: new Date('2020-01-01'),
      };
      const newRelease = {
        ...mockRelease,
        guid: 'new-release',
        publishedAt: new Date(),
      };
      mockIndexerService.manualSearch.mockImplementationOnce(() =>
        Promise.resolve([oldRelease, newRelease])
      );

      const res = await app.request('/api/v1/indexers/torrents?maxAge=7');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Should only return the new release (within 7 days)
      expect(json.data).toHaveLength(1);
    });

    test('should sort by seeders descending', async () => {
      const now = new Date();
      const releases = [
        { ...mockRelease, guid: 'low', seeders: 10, publishedAt: now },
        { ...mockRelease, guid: 'high', seeders: 1000, publishedAt: now },
        { ...mockRelease, guid: 'medium', seeders: 100, publishedAt: now },
      ];
      mockIndexerService.manualSearch.mockImplementationOnce(() =>
        Promise.resolve(releases)
      );

      const res = await app.request('/api/v1/indexers/torrents');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data[0].guid).toBe('high');
      expect(json.data[1].guid).toBe('medium');
      expect(json.data[2].guid).toBe('low');
    });

    test('should handle service errors', async () => {
      mockIndexerService.manualSearch.mockImplementationOnce(() =>
        Promise.reject(new Error('Search failed'))
      );

      const res = await app.request('/api/v1/indexers/torrents');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Search failed');
    });
  });
});
