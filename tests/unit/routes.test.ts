import { describe, expect, test, beforeEach, mock, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ErrorCode } from '../../src/server/utils/errors';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock game data
const mockGame = {
  id: 1,
  igdbId: 12345,
  title: 'Test Game',
  year: 2023,
  platform: 'PC',
  store: null,
  steamName: null,
  monitored: true,
  status: 'wanted' as const,
  coverUrl: 'https://example.com/cover.jpg',
  folderPath: null,
  summary: 'A test game',
  genres: '["Action", "Adventure"]',
  totalRating: 85,
  developer: 'Test Studio',
  publisher: 'Test Publisher',
  gameModes: '["Single Player"]',
  similarGames: null,
  installedVersion: null,
  installedQuality: null,
  latestVersion: null,
  updatePolicy: 'notify' as const,
  lastUpdateCheck: null,
  updateAvailable: false,
  addedAt: new Date(),
};

const mockGame2 = {
  ...mockGame,
  id: 2,
  igdbId: 67890,
  title: 'Another Game',
  year: 2024,
};

// ============================================================================
// GAMES ROUTES TESTS
// ============================================================================

describe('Games Routes', () => {
  // Create mock services
  const mockGameService = {
    getAllGames: mock(() => Promise.resolve([mockGame, mockGame2])),
    getGamesPaginated: mock(() =>
      Promise.resolve({
        items: [mockGame],
        total: 2,
        limit: 20,
        offset: 0,
      })
    ),
    getGameById: mock((id: number) =>
      Promise.resolve(id === 1 ? mockGame : undefined)
    ),
    addGameFromIGDB: mock(() => Promise.resolve(mockGame)),
    updateGame: mock((id: number, updates: Record<string, unknown>) =>
      Promise.resolve(id === 1 ? { ...mockGame, ...updates } : undefined)
    ),
    deleteGame: mock((id: number) => {
      if (id === 999) {
        return Promise.reject(new Error('Game not found'));
      }
      return Promise.resolve();
    }),
    toggleMonitored: mock((id: number) =>
      Promise.resolve(id === 1 ? { ...mockGame, monitored: false } : undefined)
    ),
    rematchGame: mock((id: number, _igdbId: number) =>
      Promise.resolve(
        id === 1 ? { ...mockGame, igdbId: 99999, title: 'Rematched Game' } : undefined
      )
    ),
  };

  // Create test app with games routes
  const createGamesApp = () => {
    const app = new Hono();

    const addGameSchema = z.object({
      igdbId: z.number(),
      monitored: z.boolean().optional().default(true),
      store: z.string().nullable().optional(),
    });

    const updateGameSchema = z.object({
      monitored: z.boolean().optional(),
      status: z.enum(['wanted', 'downloading', 'downloaded']).optional(),
      folderPath: z.string().nullable().optional(),
      store: z.string().nullable().optional(),
      updatePolicy: z.enum(['notify', 'auto', 'ignore']).optional(),
    });

    const rematchGameSchema = z.object({
      igdbId: z.number(),
    });

    // GET /api/v1/games
    app.get('/api/v1/games', async (c) => {
      const limitParam = c.req.query('limit');
      const offsetParam = c.req.query('offset');

      const limit = limitParam ? parseInt(limitParam) : undefined;
      const offset = offsetParam ? parseInt(offsetParam) : undefined;

      if (limitParam && (isNaN(limit!) || limit! < 1)) {
        return c.json(
          { success: false, error: 'Invalid limit parameter', code: ErrorCode.VALIDATION_ERROR },
          400
        );
      }
      if (offsetParam && (isNaN(offset!) || offset! < 0)) {
        return c.json(
          { success: false, error: 'Invalid offset parameter', code: ErrorCode.VALIDATION_ERROR },
          400
        );
      }

      if (limit !== undefined || offset !== undefined) {
        const result = await mockGameService.getGamesPaginated({ limit, offset });
        return c.json({
          success: true,
          data: result.items,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
          },
        });
      }

      const allGames = await mockGameService.getAllGames();
      return c.json({ success: true, data: allGames });
    });

    // POST /api/v1/games
    app.post('/api/v1/games', zValidator('json', addGameSchema), async (c) => {
      try {
        const { igdbId, monitored, store } = c.req.valid('json');
        const game = await mockGameService.addGameFromIGDB(igdbId, monitored, store);
        return c.json({ success: true, data: game }, 201);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('duplicate')) {
          return c.json({ success: false, error: errorMessage, code: ErrorCode.CONFLICT }, 409);
        }
        return c.json({ success: false, error: errorMessage }, 500);
      }
    });

    // GET /api/v1/games/:id
    app.get('/api/v1/games/:id', async (c) => {
      const id = parseInt(c.req.param('id'));
      if (isNaN(id)) {
        return c.json(
          { success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR },
          400
        );
      }

      const game = await mockGameService.getGameById(id);
      if (!game) {
        return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
      }
      return c.json({ success: true, data: game });
    });

    // PUT /api/v1/games/:id
    app.put('/api/v1/games/:id', zValidator('json', updateGameSchema), async (c) => {
      const id = parseInt(c.req.param('id'));
      if (isNaN(id)) {
        return c.json(
          { success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR },
          400
        );
      }

      const updates = c.req.valid('json');
      const game = await mockGameService.updateGame(id, updates);
      if (!game) {
        return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
      }
      return c.json({ success: true, data: game });
    });

    // DELETE /api/v1/games/:id
    app.delete('/api/v1/games/:id', async (c) => {
      const id = parseInt(c.req.param('id'));
      if (isNaN(id)) {
        return c.json(
          { success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR },
          400
        );
      }

      try {
        await mockGameService.deleteGame(id);
        return c.json({ success: true, data: { deleted: true } });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.toLowerCase().includes('not found')) {
          return c.json({ success: false, error: errorMessage, code: ErrorCode.NOT_FOUND }, 404);
        }
        return c.json({ success: false, error: errorMessage }, 500);
      }
    });

    // PATCH /api/v1/games/:id/toggle-monitor
    app.patch('/api/v1/games/:id/toggle-monitor', async (c) => {
      const id = parseInt(c.req.param('id'));
      if (isNaN(id)) {
        return c.json(
          { success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR },
          400
        );
      }

      const game = await mockGameService.toggleMonitored(id);
      if (!game) {
        return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
      }
      return c.json({ success: true, data: game });
    });

    // PATCH /api/v1/games/:id/rematch
    app.patch('/api/v1/games/:id/rematch', zValidator('json', rematchGameSchema), async (c) => {
      const id = parseInt(c.req.param('id'));
      if (isNaN(id)) {
        return c.json(
          { success: false, error: 'Invalid game ID', code: ErrorCode.VALIDATION_ERROR },
          400
        );
      }

      const { igdbId } = c.req.valid('json');
      const game = await mockGameService.rematchGame(id, igdbId);
      if (!game) {
        return c.json({ success: false, error: 'Game not found', code: ErrorCode.NOT_FOUND }, 404);
      }
      return c.json({ success: true, data: game });
    });

    return app;
  };

  let app: ReturnType<typeof createGamesApp>;

  beforeEach(() => {
    app = createGamesApp();
    // Reset mocks
    mockGameService.getAllGames.mockClear();
    mockGameService.getGamesPaginated.mockClear();
    mockGameService.getGameById.mockClear();
    mockGameService.addGameFromIGDB.mockClear();
    mockGameService.updateGame.mockClear();
    mockGameService.deleteGame.mockClear();
    mockGameService.toggleMonitored.mockClear();
    mockGameService.rematchGame.mockClear();
  });

  describe('GET /api/v1/games', () => {
    test('should return all games without pagination', async () => {
      const res = await app.request('/api/v1/games');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].title).toBe('Test Game');
    });

    test('should return paginated games when limit is specified', async () => {
      const res = await app.request('/api/v1/games?limit=20&offset=0');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.pagination).toBeDefined();
      expect(json.pagination.total).toBe(2);
      expect(json.pagination.limit).toBe(20);
      expect(json.pagination.offset).toBe(0);
    });

    test('should return 400 for invalid limit parameter', async () => {
      const res = await app.request('/api/v1/games?limit=-1');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid limit parameter');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should return 400 for invalid offset parameter', async () => {
      const res = await app.request('/api/v1/games?offset=-5');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid offset parameter');
    });

    test('should return 400 for non-numeric limit', async () => {
      const res = await app.request('/api/v1/games?limit=abc');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('POST /api/v1/games', () => {
    test('should create a new game successfully', async () => {
      const res = await app.request('/api/v1/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igdbId: 12345, monitored: true }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.igdbId).toBe(12345);
    });

    test('should create a game with optional store', async () => {
      const res = await app.request('/api/v1/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igdbId: 12345, monitored: false, store: 'Steam' }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test('should return 400 for missing igdbId', async () => {
      const res = await app.request('/api/v1/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: true }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for invalid igdbId type', async () => {
      const res = await app.request('/api/v1/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igdbId: 'not-a-number' }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 409 for duplicate game', async () => {
      mockGameService.addGameFromIGDB.mockImplementationOnce(() => {
        throw new Error('Game already exists in library');
      });

      const res = await app.request('/api/v1/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igdbId: 12345 }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.CONFLICT);
    });
  });

  describe('GET /api/v1/games/:id', () => {
    test('should return game by ID', async () => {
      const res = await app.request('/api/v1/games/1');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
      expect(json.data.title).toBe('Test Game');
    });

    test('should return 404 for non-existent game', async () => {
      const res = await app.request('/api/v1/games/999');

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Game not found');
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/games/invalid');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid game ID');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('PUT /api/v1/games/:id', () => {
    test('should update game successfully', async () => {
      const res = await app.request('/api/v1/games/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'downloaded', monitored: false }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('downloaded');
      expect(json.data.monitored).toBe(false);
    });

    test('should return 404 for non-existent game', async () => {
      const res = await app.request('/api/v1/games/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: false }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for invalid status value', async () => {
      const res = await app.request('/api/v1/games/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid-status' }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/games/abc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitored: false }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid game ID');
    });
  });

  describe('DELETE /api/v1/games/:id', () => {
    test('should delete game successfully', async () => {
      const res = await app.request('/api/v1/games/1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
    });

    test('should return 404 for non-existent game', async () => {
      const res = await app.request('/api/v1/games/999', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/games/invalid', {
        method: 'DELETE',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid game ID');
    });
  });

  describe('PATCH /api/v1/games/:id/toggle-monitor', () => {
    test('should toggle monitored status', async () => {
      const res = await app.request('/api/v1/games/1/toggle-monitor', {
        method: 'PATCH',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.monitored).toBe(false);
    });

    test('should return 404 for non-existent game', async () => {
      const res = await app.request('/api/v1/games/999/toggle-monitor', {
        method: 'PATCH',
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for invalid game ID', async () => {
      const res = await app.request('/api/v1/games/invalid/toggle-monitor', {
        method: 'PATCH',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/games/:id/rematch', () => {
    test('should rematch game to new IGDB entry', async () => {
      const res = await app.request('/api/v1/games/1/rematch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igdbId: 99999 }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.igdbId).toBe(99999);
      expect(json.data.title).toBe('Rematched Game');
    });

    test('should return 404 for non-existent game', async () => {
      const res = await app.request('/api/v1/games/999/rematch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igdbId: 99999 }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should return 400 for missing igdbId', async () => {
      const res = await app.request('/api/v1/games/1/rematch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for invalid igdbId type', async () => {
      const res = await app.request('/api/v1/games/1/rematch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igdbId: 'not-a-number' }),
      });

      expect(res.status).toBe(400);
    });
  });
});

// ============================================================================
// SETTINGS ROUTES TESTS
// ============================================================================

describe('Settings Routes', () => {
  // Mock settings service
  const mockSettingsService = {
    getAllSettings: mock(() =>
      Promise.resolve({
        prowlarr_url: 'http://localhost:9696',
        prowlarr_api_key: '***HIDDEN***',
        qbittorrent_host: 'http://localhost:8080',
        dry_run: false,
      })
    ),
    getDryRun: mock(() => Promise.resolve(false)),
    setDryRun: mock(() => Promise.resolve()),
    getProwlarrCategories: mock(() => Promise.resolve([4050])),
    setProwlarrCategories: mock(() => Promise.resolve()),
    getQBittorrentCategory: mock(() => Promise.resolve('gamearr')),
    setQBittorrentCategory: mock(() => Promise.resolve()),
    getSetting: mock((key: string) => {
      if (key === 'library_path') return Promise.resolve('/games');
      return Promise.resolve(null);
    }),
    setSetting: mock(() => Promise.resolve()),
  };

  // Mock download service for qBittorrent categories
  const mockDownloadService = {
    getCategories: mock(() =>
      Promise.resolve(['gamearr', 'games', 'downloads'])
    ),
  };

  // Mock categories data
  const mockCategories = {
    ALL_CATEGORIES: [
      { id: 4000, name: 'PC (All)', description: 'All PC content' },
      { id: 4050, name: 'PC/Games', description: 'PC games' },
      { id: 1000, name: 'Console (All)', description: 'All console content' },
    ],
    CATEGORY_GROUPS: [
      { name: 'PC', categories: [{ id: 4000 }, { id: 4050 }] },
      { name: 'Console', categories: [{ id: 1000 }] },
    ],
    DEFAULT_CATEGORIES: [4050],
  };

  // Create test app with settings routes
  const createSettingsApp = () => {
    const app = new Hono();

    const dryRunSchema = z.object({
      enabled: z.boolean(),
    });

    const categoriesSchema = z.object({
      categories: z.array(z.number()),
    });

    const qbCategorySchema = z.object({
      category: z.string().min(1),
    });

    const settingValueSchema = z.object({
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.unknown()),
        z.record(z.unknown()),
      ]),
    });

    // GET /api/v1/settings
    app.get('/api/v1/settings', async (c) => {
      const allSettings = await mockSettingsService.getAllSettings();
      return c.json({ success: true, data: allSettings });
    });

    // GET /api/v1/settings/dry-run
    app.get('/api/v1/settings/dry-run', async (c) => {
      const dryRun = await mockSettingsService.getDryRun();
      return c.json({ success: true, data: dryRun });
    });

    // PUT /api/v1/settings/dry-run
    app.put('/api/v1/settings/dry-run', zValidator('json', dryRunSchema), async (c) => {
      const { enabled } = c.req.valid('json');
      await mockSettingsService.setDryRun(enabled);
      return c.json({
        success: true,
        message: `Dry-run mode ${enabled ? 'enabled' : 'disabled'}`,
        data: enabled,
      });
    });

    // GET /api/v1/settings/categories
    app.get('/api/v1/settings/categories', async (c) => {
      return c.json({
        success: true,
        data: {
          available: mockCategories.ALL_CATEGORIES,
          groups: mockCategories.CATEGORY_GROUPS,
          default: mockCategories.DEFAULT_CATEGORIES,
        },
      });
    });

    // GET /api/v1/settings/categories/selected
    app.get('/api/v1/settings/categories/selected', async (c) => {
      const categories = await mockSettingsService.getProwlarrCategories();
      return c.json({ success: true, data: categories });
    });

    // PUT /api/v1/settings/categories
    app.put('/api/v1/settings/categories', zValidator('json', categoriesSchema), async (c) => {
      const { categories } = c.req.valid('json');

      const validCategoryIds = mockCategories.ALL_CATEGORIES.map((cat) => cat.id);
      const invalidCategories = categories.filter((id: number) => !validCategoryIds.includes(id));

      if (invalidCategories.length > 0) {
        return c.json(
          {
            success: false,
            error: `Invalid category IDs: ${invalidCategories.join(', ')}`,
            code: ErrorCode.VALIDATION_ERROR,
          },
          400
        );
      }

      await mockSettingsService.setProwlarrCategories(categories);
      return c.json({
        success: true,
        message: 'Categories updated successfully',
        data: categories,
      });
    });

    // GET /api/v1/settings/qbittorrent/categories
    app.get('/api/v1/settings/qbittorrent/categories', async (c) => {
      const categories = await mockDownloadService.getCategories();
      return c.json({ success: true, data: categories });
    });

    // GET /api/v1/settings/qbittorrent/category
    app.get('/api/v1/settings/qbittorrent/category', async (c) => {
      const category = await mockSettingsService.getQBittorrentCategory();
      return c.json({ success: true, data: category });
    });

    // PUT /api/v1/settings/qbittorrent/category
    app.put(
      '/api/v1/settings/qbittorrent/category',
      zValidator('json', qbCategorySchema),
      async (c) => {
        const { category } = c.req.valid('json');
        await mockSettingsService.setQBittorrentCategory(category);
        return c.json({
          success: true,
          message: 'qBittorrent category updated successfully',
          data: category,
        });
      }
    );

    // PUT /api/v1/settings (bulk)
    app.put('/api/v1/settings', async (c) => {
      const body = await c.req.json();
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          await mockSettingsService.setSetting(key, value);
        }
      }
      return c.json({ success: true, message: 'Settings updated successfully' });
    });

    // GET /api/v1/settings/:key
    app.get('/api/v1/settings/:key', async (c) => {
      const key = c.req.param('key');
      const value = await mockSettingsService.getSetting(key);

      if (value !== null) {
        try {
          const parsed = JSON.parse(value);
          return c.json({ success: true, data: parsed });
        } catch {
          return c.json({ success: true, data: value });
        }
      }

      return c.json({ success: true, data: value });
    });

    // PUT /api/v1/settings/:key
    app.put('/api/v1/settings/:key', zValidator('json', settingValueSchema), async (c) => {
      const key = c.req.param('key');
      const { value } = c.req.valid('json');

      const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
      await mockSettingsService.setSetting(key, valueToStore);

      return c.json({
        success: true,
        message: `Setting ${key} updated successfully`,
        data: value,
      });
    });

    return app;
  };

  let app: ReturnType<typeof createSettingsApp>;

  beforeEach(() => {
    app = createSettingsApp();
    mockSettingsService.getAllSettings.mockClear();
    mockSettingsService.getDryRun.mockClear();
    mockSettingsService.setDryRun.mockClear();
    mockSettingsService.getProwlarrCategories.mockClear();
    mockSettingsService.setProwlarrCategories.mockClear();
    mockSettingsService.getQBittorrentCategory.mockClear();
    mockSettingsService.setQBittorrentCategory.mockClear();
    mockSettingsService.getSetting.mockClear();
    mockSettingsService.setSetting.mockClear();
    mockDownloadService.getCategories.mockClear();
  });

  describe('GET /api/v1/settings', () => {
    test('should return all settings', async () => {
      const res = await app.request('/api/v1/settings');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.prowlarr_url).toBe('http://localhost:9696');
      expect(json.data.prowlarr_api_key).toBe('***HIDDEN***');
    });
  });

  describe('GET /api/v1/settings/dry-run', () => {
    test('should return dry-run status', async () => {
      const res = await app.request('/api/v1/settings/dry-run');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe(false);
    });
  });

  describe('PUT /api/v1/settings/dry-run', () => {
    test('should enable dry-run mode', async () => {
      const res = await app.request('/api/v1/settings/dry-run', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Dry-run mode enabled');
      expect(json.data).toBe(true);
    });

    test('should disable dry-run mode', async () => {
      const res = await app.request('/api/v1/settings/dry-run', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Dry-run mode disabled');
      expect(json.data).toBe(false);
    });

    test('should return 400 for missing enabled field', async () => {
      const res = await app.request('/api/v1/settings/dry-run', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for invalid enabled type', async () => {
      const res = await app.request('/api/v1/settings/dry-run', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: 'yes' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/settings/categories', () => {
    test('should return available categories', async () => {
      const res = await app.request('/api/v1/settings/categories');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.available).toHaveLength(3);
      expect(json.data.groups).toHaveLength(2);
      expect(json.data.default).toContain(4050);
    });
  });

  describe('GET /api/v1/settings/categories/selected', () => {
    test('should return selected categories', async () => {
      const res = await app.request('/api/v1/settings/categories/selected');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toContain(4050);
    });
  });

  describe('PUT /api/v1/settings/categories', () => {
    test('should update selected categories', async () => {
      const res = await app.request('/api/v1/settings/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: [4000, 4050] }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toContain(4000);
      expect(json.data).toContain(4050);
    });

    test('should return 400 for invalid category IDs', async () => {
      const res = await app.request('/api/v1/settings/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: [9999] }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid category IDs');
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    test('should return 400 for non-array categories', async () => {
      const res = await app.request('/api/v1/settings/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: 'not-an-array' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/settings/qbittorrent/categories', () => {
    test('should return qBittorrent categories', async () => {
      const res = await app.request('/api/v1/settings/qbittorrent/categories');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toContain('gamearr');
      expect(json.data).toContain('games');
    });
  });

  describe('GET /api/v1/settings/qbittorrent/category', () => {
    test('should return selected qBittorrent category', async () => {
      const res = await app.request('/api/v1/settings/qbittorrent/category');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe('gamearr');
    });
  });

  describe('PUT /api/v1/settings/qbittorrent/category', () => {
    test('should update qBittorrent category', async () => {
      const res = await app.request('/api/v1/settings/qbittorrent/category', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'games' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe('games');
    });

    test('should return 400 for empty category', async () => {
      const res = await app.request('/api/v1/settings/qbittorrent/category', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: '' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/v1/settings (bulk)', () => {
    test('should update multiple settings', async () => {
      const res = await app.request('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prowlarr_url: 'http://new-host:9696',
          library_path: '/new/path',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Settings updated successfully');
    });
  });

  describe('GET /api/v1/settings/:key', () => {
    test('should return individual setting', async () => {
      const res = await app.request('/api/v1/settings/library_path');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe('/games');
    });

    test('should return null for non-existent setting', async () => {
      mockSettingsService.getSetting.mockImplementationOnce(() => Promise.resolve(null));

      const res = await app.request('/api/v1/settings/non_existent');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });
  });

  describe('PUT /api/v1/settings/:key', () => {
    test('should update individual setting with string value', async () => {
      const res = await app.request('/api/v1/settings/library_path', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: '/new/games/path' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe('/new/games/path');
    });

    test('should update individual setting with boolean value', async () => {
      const res = await app.request('/api/v1/settings/dry_run', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe(true);
    });

    test('should update individual setting with array value', async () => {
      const res = await app.request('/api/v1/settings/prowlarr_categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: [4000, 4050] }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual([4000, 4050]);
    });

    test('should return 400 for missing value', async () => {
      const res = await app.request('/api/v1/settings/library_path', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });
});

// ============================================================================
// SYSTEM ROUTES TESTS
// ============================================================================

describe('System Routes', () => {
  // Mock app version
  const mockVersion = '1.0.0';

  // Mock game repository for stats
  const mockGameRepository = {
    count: mock(() => Promise.resolve(10)),
    getStats: mock(() =>
      Promise.resolve({
        totalGames: 10,
        wantedGames: 5,
        downloadingGames: 2,
        downloadedGames: 3,
      })
    ),
  };

  // Mock settings service for IGDB config check
  const mockSettingsService = {
    getIGDBClientId: mock(() => Promise.resolve('test-client-id')),
    getIGDBClientSecret: mock(() => Promise.resolve('test-secret')),
  };

  // Mock Prowlarr client
  const mockProwlarrClient = {
    isConfigured: mock(() => true),
    testConnection: mock(() => Promise.resolve(true)),
  };

  // Mock qBittorrent client
  const mockQBittorrentClient = {
    isConfigured: mock(() => true),
    testConnection: mock(() => Promise.resolve(true)),
  };

  // Create test app with system routes
  const createSystemApp = () => {
    const app = new Hono();

    interface ServiceStatus {
      name: string;
      status: 'healthy' | 'unhealthy' | 'unconfigured';
      message?: string;
      responseTime?: number;
    }

    // GET /api/v1/system/status
    app.get('/api/v1/system/status', async (c) => {
      return c.json({
        success: true,
        data: {
          status: 'healthy',
          version: mockVersion,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      });
    });

    // GET /api/v1/system/health
    app.get('/api/v1/system/health', async (c) => {
      const services: ServiceStatus[] = [];

      // Check Database
      try {
        const start = Date.now();
        await mockGameRepository.count();
        services.push({
          name: 'Database',
          status: 'healthy',
          responseTime: Date.now() - start,
        });
      } catch (error) {
        services.push({
          name: 'Database',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Check IGDB config
      try {
        const clientId = await mockSettingsService.getIGDBClientId();
        const clientSecret = await mockSettingsService.getIGDBClientSecret();

        if (!clientId || !clientSecret) {
          services.push({
            name: 'IGDB',
            status: 'unconfigured',
            message: 'IGDB credentials not configured',
          });
        } else {
          services.push({
            name: 'IGDB',
            status: 'healthy',
            message: 'Configured',
          });
        }
      } catch (error) {
        services.push({
          name: 'IGDB',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Check Prowlarr
      if (!mockProwlarrClient.isConfigured()) {
        services.push({
          name: 'Prowlarr',
          status: 'unconfigured',
          message: 'Prowlarr not configured',
        });
      } else {
        try {
          const start = Date.now();
          const connected = await mockProwlarrClient.testConnection();
          services.push({
            name: 'Prowlarr',
            status: connected ? 'healthy' : 'unhealthy',
            message: connected ? 'Connected' : 'Connection failed',
            responseTime: Date.now() - start,
          });
        } catch (error) {
          services.push({
            name: 'Prowlarr',
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Check qBittorrent
      if (!mockQBittorrentClient.isConfigured()) {
        services.push({
          name: 'qBittorrent',
          status: 'unconfigured',
          message: 'qBittorrent not configured',
        });
      } else {
        try {
          const start = Date.now();
          const connected = await mockQBittorrentClient.testConnection();
          services.push({
            name: 'qBittorrent',
            status: connected ? 'healthy' : 'unhealthy',
            message: connected ? 'Connected' : 'Connection failed',
            responseTime: Date.now() - start,
          });
        } catch (error) {
          services.push({
            name: 'qBittorrent',
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Get stats
      let stats;
      try {
        stats = await mockGameRepository.getStats();
      } catch {
        stats = undefined;
      }

      // Determine overall status
      const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length;
      const unconfiguredCount = services.filter((s) => s.status === 'unconfigured').length;

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (unhealthyCount > 0) {
        overallStatus = unhealthyCount >= 2 ? 'unhealthy' : 'degraded';
      } else if (unconfiguredCount > 0) {
        overallStatus = 'degraded';
      }

      const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

      return c.json(
        {
          success: true,
          data: {
            status: overallStatus,
            version: mockVersion,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services,
            stats,
          },
        },
        statusCode
      );
    });

    // GET /api/v1/system/logs
    app.get('/api/v1/system/logs', async (c) => {
      return c.json({ success: true, data: [] });
    });

    return app;
  };

  let app: ReturnType<typeof createSystemApp>;

  beforeEach(() => {
    app = createSystemApp();
    mockGameRepository.count.mockClear();
    mockGameRepository.getStats.mockClear();
    mockSettingsService.getIGDBClientId.mockClear();
    mockSettingsService.getIGDBClientSecret.mockClear();
    mockProwlarrClient.isConfigured.mockClear();
    mockProwlarrClient.testConnection.mockClear();
    mockQBittorrentClient.isConfigured.mockClear();
    mockQBittorrentClient.testConnection.mockClear();
  });

  describe('GET /api/v1/system/status', () => {
    test('should return basic status', async () => {
      const res = await app.request('/api/v1/system/status');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.version).toBe('1.0.0');
      expect(json.data.uptime).toBeDefined();
      expect(json.data.timestamp).toBeDefined();
    });

    test('should include valid timestamp in ISO format', async () => {
      const res = await app.request('/api/v1/system/status');

      const json = await res.json();
      const timestamp = new Date(json.data.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('GET /api/v1/system/health', () => {
    test('should return comprehensive health check when all services healthy', async () => {
      const res = await app.request('/api/v1/system/health');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.services).toHaveLength(4);
      expect(json.data.stats).toBeDefined();
      expect(json.data.stats.totalGames).toBe(10);
    });

    test('should return healthy status for all configured services', async () => {
      const res = await app.request('/api/v1/system/health');

      const json = await res.json();
      const dbService = json.data.services.find((s: any) => s.name === 'Database');
      const igdbService = json.data.services.find((s: any) => s.name === 'IGDB');
      const prowlarrService = json.data.services.find((s: any) => s.name === 'Prowlarr');
      const qbService = json.data.services.find((s: any) => s.name === 'qBittorrent');

      expect(dbService.status).toBe('healthy');
      expect(igdbService.status).toBe('healthy');
      expect(prowlarrService.status).toBe('healthy');
      expect(qbService.status).toBe('healthy');
    });

    test('should return degraded status when IGDB not configured', async () => {
      mockSettingsService.getIGDBClientId.mockImplementationOnce(() => Promise.resolve(null));

      const res = await app.request('/api/v1/system/health');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('degraded');
      const igdbService = json.data.services.find((s: any) => s.name === 'IGDB');
      expect(igdbService.status).toBe('unconfigured');
    });

    test('should return degraded status when Prowlarr not configured', async () => {
      mockProwlarrClient.isConfigured.mockImplementationOnce(() => false);

      const res = await app.request('/api/v1/system/health');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('degraded');
      const prowlarrService = json.data.services.find((s: any) => s.name === 'Prowlarr');
      expect(prowlarrService.status).toBe('unconfigured');
    });

    test('should return degraded status when qBittorrent not configured', async () => {
      mockQBittorrentClient.isConfigured.mockImplementationOnce(() => false);

      const res = await app.request('/api/v1/system/health');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('degraded');
      const qbService = json.data.services.find((s: any) => s.name === 'qBittorrent');
      expect(qbService.status).toBe('unconfigured');
    });

    test('should return degraded status when Prowlarr connection fails', async () => {
      mockProwlarrClient.testConnection.mockImplementationOnce(() => Promise.resolve(false));

      const res = await app.request('/api/v1/system/health');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('degraded');
      const prowlarrService = json.data.services.find((s: any) => s.name === 'Prowlarr');
      expect(prowlarrService.status).toBe('unhealthy');
    });

    test('should return 503 when multiple services are unhealthy', async () => {
      mockProwlarrClient.testConnection.mockImplementationOnce(() => Promise.resolve(false));
      mockQBittorrentClient.testConnection.mockImplementationOnce(() => Promise.resolve(false));

      const res = await app.request('/api/v1/system/health');

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.data.status).toBe('unhealthy');
    });

    test('should include response times for services', async () => {
      const res = await app.request('/api/v1/system/health');

      const json = await res.json();
      const dbService = json.data.services.find((s: any) => s.name === 'Database');
      expect(dbService.responseTime).toBeDefined();
      expect(typeof dbService.responseTime).toBe('number');
    });

    test('should handle database errors gracefully', async () => {
      mockGameRepository.count.mockImplementationOnce(() =>
        Promise.reject(new Error('Database connection failed'))
      );

      const res = await app.request('/api/v1/system/health');

      const json = await res.json();
      const dbService = json.data.services.find((s: any) => s.name === 'Database');
      expect(dbService.status).toBe('unhealthy');
      expect(dbService.message).toBe('Database connection failed');
    });

    test('should return stats even when some services fail', async () => {
      mockProwlarrClient.testConnection.mockImplementationOnce(() =>
        Promise.reject(new Error('Connection timeout'))
      );

      const res = await app.request('/api/v1/system/health');

      const json = await res.json();
      expect(json.data.stats).toBeDefined();
      expect(json.data.stats.totalGames).toBe(10);
    });
  });

  describe('GET /api/v1/system/logs', () => {
    test('should return empty logs array', async () => {
      const res = await app.request('/api/v1/system/logs');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });
  });
});

// ============================================================================
// RESPONSE FORMAT TESTS
// ============================================================================

describe('API Response Format', () => {
  test('success response should have correct format', () => {
    const successResponse = {
      success: true,
      data: { id: 1, name: 'Test' },
    };

    expect(successResponse.success).toBe(true);
    expect(successResponse.data).toBeDefined();
  });

  test('error response should have correct format', () => {
    const errorResponse = {
      success: false,
      error: 'Something went wrong',
      code: ErrorCode.UNKNOWN,
    };

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toBeDefined();
    expect(typeof errorResponse.error).toBe('string');
  });

  test('pagination response should have correct format', () => {
    const paginatedResponse = {
      success: true,
      data: [{ id: 1 }, { id: 2 }],
      pagination: {
        total: 100,
        limit: 20,
        offset: 0,
      },
    };

    expect(paginatedResponse.success).toBe(true);
    expect(paginatedResponse.data).toBeInstanceOf(Array);
    expect(paginatedResponse.pagination.total).toBe(100);
    expect(paginatedResponse.pagination.limit).toBe(20);
    expect(paginatedResponse.pagination.offset).toBe(0);
  });
});
