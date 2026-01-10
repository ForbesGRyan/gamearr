import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErrorCode } from '../../src/server/utils/errors';

// ============================================================================
// UPDATES ROUTES TESTS
// ============================================================================

describe('Updates Routes', () => {
  // Mock update data
  const mockUpdate = {
    id: 1,
    gameId: 1,
    version: '1.2.0',
    releaseTitle: 'Test Game v1.2.0',
    releaseSize: 5000000000,
    releaseDate: new Date(),
    status: 'pending' as const,
    createdAt: new Date(),
  };

  const mockUpdate2 = {
    ...mockUpdate,
    id: 2,
    gameId: 2,
    version: '2.0.0',
    releaseTitle: 'Another Game v2.0.0',
  };

  // Mock game data
  const mockGame = {
    id: 1,
    igdbId: 12345,
    title: 'Test Game',
    coverUrl: 'https://example.com/cover.jpg',
    updatePolicy: 'notify' as const,
  };

  // Mock services
  const mockUpdateService = {
    getPendingUpdates: mock(() => Promise.resolve([mockUpdate, mockUpdate2])),
    getPendingUpdatesPaginated: mock(() =>
      Promise.resolve({
        items: [mockUpdate],
        total: 2,
        limit: 20,
        offset: 0,
      })
    ),
    getGameUpdates: mock((gameId: number) =>
      Promise.resolve(gameId === 1 ? [mockUpdate] : [])
    ),
    checkGameForUpdates: mock(() =>
      Promise.resolve([{ version: '1.3.0', releaseTitle: 'New Update' }])
    ),
    grabUpdate: mock(() => Promise.resolve()),
    dismissUpdate: mock(() => Promise.resolve()),
  };

  const mockUpdateCheckJob = {
    triggerCheck: mock(() =>
      Promise.resolve({ checked: 10, updatesFound: 2 })
    ),
  };

  const mockGameService = {
    getGameById: mock((id: number) =>
      Promise.resolve(id === 1 ? mockGame : undefined)
    ),
    updateGame: mock((id: number, updates: Record<string, unknown>) =>
      Promise.resolve({ ...mockGame, ...updates })
    ),
  };

  const mockGameRepository = {
    findByIds: mock((ids: number[]) => {
      const map = new Map();
      if (ids.includes(1)) {
        map.set(1, mockGame);
      }
      if (ids.includes(2)) {
        map.set(2, { ...mockGame, id: 2, title: 'Another Game' });
      }
      return Promise.resolve(map);
    }),
  };

  // Validation schema
  const updatePolicySchema = z.object({
    policy: z.enum(['notify', 'auto', 'ignore']),
  });

  // Create test app with updates routes
  const createUpdatesApp = () => {
    const app = new Hono();

    // GET /api/v1/updates - List all pending updates
    app.get('/api/v1/updates', async (c) => {
      const limitParam = c.req.query('limit');
      const offsetParam = c.req.query('offset');

      const limit = limitParam ? parseInt(limitParam) : undefined;
      const offset = offsetParam ? parseInt(offsetParam) : undefined;

      if (limitParam && (isNaN(limit!) || limit! < 1)) {
        return c.json(
          {
            success: false,
            error: 'Invalid limit parameter',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }
      if (offsetParam && (isNaN(offset!) || offset! < 0)) {
        return c.json(
          {
            success: false,
            error: 'Invalid offset parameter',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      try {
        if (limit !== undefined || offset !== undefined) {
          const result = await mockUpdateService.getPendingUpdatesPaginated({
            limit,
            offset,
          });

          const gameIds = [...new Set(result.items.map((u) => u.gameId))];
          const gamesMap = await mockGameRepository.findByIds(gameIds);

          const updatesWithGames = result.items.map((update) => {
            const game = gamesMap.get(update.gameId);
            return {
              ...update,
              gameTitle: game?.title || 'Unknown',
              gameCoverUrl: game?.coverUrl,
            };
          });

          return c.json({
            success: true,
            data: updatesWithGames,
            pagination: {
              total: result.total,
              limit: result.limit,
              offset: result.offset,
            },
          });
        }

        const pendingUpdates = await mockUpdateService.getPendingUpdates();
        const gameIds = [...new Set(pendingUpdates.map((u) => u.gameId))];
        const gamesMap = await mockGameRepository.findByIds(gameIds);

        const updatesWithGames = pendingUpdates.map((update) => {
          const game = gamesMap.get(update.gameId);
          return {
            ...update,
            gameTitle: game?.title || 'Unknown',
            gameCoverUrl: game?.coverUrl,
          };
        });

        return c.json({ success: true, data: updatesWithGames });
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

    // POST /api/v1/updates/check - Trigger manual check for all games
    app.post('/api/v1/updates/check', async (c) => {
      try {
        const result = await mockUpdateCheckJob.triggerCheck();
        return c.json({ success: true, data: result });
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

    // POST /api/v1/updates/:id/grab - Download an update
    app.post('/api/v1/updates/:id/grab', async (c) => {
      const id = parseInt(c.req.param('id'));
      if (isNaN(id)) {
        return c.json(
          {
            success: false,
            error: 'Invalid update ID',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      try {
        await mockUpdateService.grabUpdate(id);
        return c.json({ success: true, data: { grabbed: true } });
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

    // POST /api/v1/updates/:id/dismiss - Dismiss an update
    app.post('/api/v1/updates/:id/dismiss', async (c) => {
      const id = parseInt(c.req.param('id'));
      if (isNaN(id)) {
        return c.json(
          {
            success: false,
            error: 'Invalid update ID',
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      try {
        await mockUpdateService.dismissUpdate(id);
        return c.json({ success: true, data: { dismissed: true } });
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

    // GET /api/v1/updates/games/:id - Get updates for specific game
    app.get('/api/v1/updates/games/:id', async (c) => {
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
        const gameUpdates = await mockUpdateService.getGameUpdates(id);
        return c.json({ success: true, data: gameUpdates });
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

    // POST /api/v1/updates/games/:id/check - Check single game for updates
    app.post('/api/v1/updates/games/:id/check', async (c) => {
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
        const updates = await mockUpdateService.checkGameForUpdates(id);
        return c.json({
          success: true,
          data: {
            updatesFound: updates.length,
            updates,
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

    // PUT /api/v1/updates/games/:id/policy - Set update policy for a game
    app.put(
      '/api/v1/updates/games/:id/policy',
      zValidator('json', updatePolicySchema),
      async (c) => {
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
          const { policy } = c.req.valid('json');

          const game = await mockGameService.getGameById(id);
          if (!game) {
            return c.json(
              { success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND },
              404
            );
          }

          const updatedGame = await mockGameService.updateGame(id, {
            updatePolicy: policy,
          });
          return c.json({ success: true, data: updatedGame });
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

  let app: ReturnType<typeof createUpdatesApp>;

  beforeEach(() => {
    app = createUpdatesApp();
    mockUpdateService.getPendingUpdates.mockClear();
    mockUpdateService.getPendingUpdatesPaginated.mockClear();
    mockUpdateService.getGameUpdates.mockClear();
    mockUpdateService.checkGameForUpdates.mockClear();
    mockUpdateService.grabUpdate.mockClear();
    mockUpdateService.dismissUpdate.mockClear();
    mockUpdateCheckJob.triggerCheck.mockClear();
    mockGameService.getGameById.mockClear();
    mockGameService.updateGame.mockClear();
    mockGameRepository.findByIds.mockClear();
  });

  describe('GET /api/v1/updates', () => {
    test('should return all pending updates', async () => {
      const res = await app.request('/api/v1/updates');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].gameTitle).toBe('Test Game');
    });

    test('should return paginated updates', async () => {
      const res = await app.request('/api/v1/updates?limit=20&offset=0');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.pagination).toBeDefined();
      expect(json.pagination.total).toBe(2);
      expect(json.pagination.limit).toBe(20);
      expect(json.pagination.offset).toBe(0);
    });

    test('should return 400 for invalid limit', async () => {
      const res = await app.request('/api/v1/updates?limit=-1');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid limit parameter');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should return 400 for invalid offset', async () => {
      const res = await app.request('/api/v1/updates?offset=-1');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid offset parameter');
    });

    test('should handle service errors', async () => {
      mockUpdateService.getPendingUpdates.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      const res = await app.request('/api/v1/updates');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database error');
    });
  });

  describe('POST /api/v1/updates/check', () => {
    test('should trigger update check successfully', async () => {
      const res = await app.request('/api/v1/updates/check', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.checked).toBe(10);
      expect(json.data.updatesFound).toBe(2);
    });

    test('should handle check errors', async () => {
      mockUpdateCheckJob.triggerCheck.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to check updates'))
      );

      const res = await app.request('/api/v1/updates/check', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to check updates');
    });
  });

  describe('POST /api/v1/updates/:id/grab', () => {
    test('should grab update successfully', async () => {
      const res = await app.request('/api/v1/updates/1/grab', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.grabbed).toBe(true);
    });

    test('should return 400 for invalid update ID', async () => {
      const res = await app.request('/api/v1/updates/invalid/grab', {
        method: 'POST',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid update ID');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should handle service errors', async () => {
      mockUpdateService.grabUpdate.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to grab update'))
      );

      const res = await app.request('/api/v1/updates/1/grab', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to grab update');
    });
  });

  describe('POST /api/v1/updates/:id/dismiss', () => {
    test('should dismiss update successfully', async () => {
      const res = await app.request('/api/v1/updates/1/dismiss', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.dismissed).toBe(true);
    });

    test('should return 400 for invalid update ID', async () => {
      const res = await app.request('/api/v1/updates/invalid/dismiss', {
        method: 'POST',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid update ID');
    });

    test('should handle service errors', async () => {
      mockUpdateService.dismissUpdate.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to dismiss update'))
      );

      const res = await app.request('/api/v1/updates/1/dismiss', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to dismiss update');
    });
  });

  describe('GET /api/v1/updates/games/:id', () => {
    test('should return updates for a game', async () => {
      const res = await app.request('/api/v1/updates/games/1');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].gameId).toBe(1);
    });

    test('should return empty array for game with no updates', async () => {
      const res = await app.request('/api/v1/updates/games/999');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/updates/games/invalid');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid game ID');
    });

    test('should handle service errors', async () => {
      mockUpdateService.getGameUpdates.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      const res = await app.request('/api/v1/updates/games/1');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database error');
    });
  });

  describe('POST /api/v1/updates/games/:id/check', () => {
    test('should check game for updates', async () => {
      const res = await app.request('/api/v1/updates/games/1/check', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updatesFound).toBe(1);
      expect(json.data.updates).toHaveLength(1);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/updates/games/invalid/check', {
        method: 'POST',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid game ID');
    });

    test('should handle service errors', async () => {
      mockUpdateService.checkGameForUpdates.mockImplementationOnce(() =>
        Promise.reject(new Error('Check failed'))
      );

      const res = await app.request('/api/v1/updates/games/1/check', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Check failed');
    });
  });

  describe('PUT /api/v1/updates/games/:id/policy', () => {
    test('should set update policy to notify', async () => {
      const res = await app.request('/api/v1/updates/games/1/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'notify' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updatePolicy).toBe('notify');
    });

    test('should set update policy to auto', async () => {
      const res = await app.request('/api/v1/updates/games/1/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'auto' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updatePolicy).toBe('auto');
    });

    test('should set update policy to ignore', async () => {
      const res = await app.request('/api/v1/updates/games/1/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'ignore' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updatePolicy).toBe('ignore');
    });

    test('should return 400 for invalid policy value', async () => {
      const res = await app.request('/api/v1/updates/games/1/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'invalid' }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for missing policy', async () => {
      const res = await app.request('/api/v1/updates/games/1/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test('should return 404 for non-existent game', async () => {
      const res = await app.request('/api/v1/updates/games/999/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'notify' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Game not found');
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/updates/games/invalid/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'notify' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid game ID');
    });

    test('should handle service errors', async () => {
      mockGameService.updateGame.mockImplementationOnce(() =>
        Promise.reject(new Error('Update failed'))
      );

      const res = await app.request('/api/v1/updates/games/1/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'notify' }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Update failed');
    });
  });
});
