import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// ============================================================================
// LIBRARIES ROUTES TESTS
// ============================================================================

describe('Libraries Routes', () => {
  // Mock library data
  const mockLibrary = {
    id: 1,
    name: 'Main Games',
    path: '/games/main',
    platform: 'PC',
    monitored: true,
    downloadEnabled: true,
    downloadCategory: 'gamearr',
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLibrary2 = {
    ...mockLibrary,
    id: 2,
    name: 'Steam Games',
    path: '/games/steam',
    platform: 'Steam',
    priority: 1,
  };

  // Mock library service
  const mockLibraryService = {
    getAllLibraries: mock(() => Promise.resolve([mockLibrary, mockLibrary2])),
    getLibrary: mock((id: number) =>
      Promise.resolve(id === 1 ? mockLibrary : id === 2 ? mockLibrary2 : undefined)
    ),
    createLibrary: mock((input: Record<string, unknown>) =>
      Promise.resolve({ ...mockLibrary, ...input, id: 3 })
    ),
    updateLibrary: mock((id: number, input: Record<string, unknown>) =>
      Promise.resolve(id === 1 ? { ...mockLibrary, ...input } : undefined)
    ),
    deleteLibrary: mock((id: number) => Promise.resolve(id === 1)),
    getUniquePlatforms: mock(() => Promise.resolve(['PC', 'Steam', 'GOG'])),
    testPath: mock((path: string) =>
      Promise.resolve({
        valid: path.startsWith('/games'),
        exists: path.startsWith('/games'),
        readable: path.startsWith('/games'),
        writable: path.startsWith('/games'),
      })
    ),
  };

  // Validation schemas (matching the actual routes)
  const createLibrarySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    path: z.string().min(1, 'Path is required'),
    platform: z.string().optional(),
    monitored: z.boolean().optional(),
    downloadEnabled: z.boolean().optional(),
    downloadCategory: z.string().optional(),
    priority: z.number().int().min(0).optional(),
  });

  const updateLibrarySchema = z.object({
    name: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    platform: z.string().nullable().optional(),
    monitored: z.boolean().optional(),
    downloadEnabled: z.boolean().optional(),
    downloadCategory: z.string().nullable().optional(),
    priority: z.number().int().min(0).optional(),
  });

  const testPathSchema = z.object({
    path: z.string().min(1, 'Path is required'),
  });

  // Create test app with libraries routes
  const createLibrariesApp = () => {
    const app = new Hono();

    // GET /api/v1/libraries - Get all libraries
    app.get('/api/v1/libraries', async (c) => {
      try {
        const libraries = await mockLibraryService.getAllLibraries();
        return c.json({ success: true, data: libraries });
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

    // GET /api/v1/libraries/platforms - Get unique platforms
    app.get('/api/v1/libraries/platforms', async (c) => {
      try {
        const platforms = await mockLibraryService.getUniquePlatforms();
        return c.json({ success: true, data: platforms });
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

    // POST /api/v1/libraries/test-path - Test if a path is valid
    app.post(
      '/api/v1/libraries/test-path',
      zValidator('json', testPathSchema),
      async (c) => {
        try {
          const { path } = c.req.valid('json');
          const result = await mockLibraryService.testPath(path);
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
      }
    );

    // POST /api/v1/libraries - Create a new library
    app.post(
      '/api/v1/libraries',
      zValidator('json', createLibrarySchema),
      async (c) => {
        try {
          const input = c.req.valid('json');
          const library = await mockLibraryService.createLibrary(input);
          return c.json({ success: true, data: library }, 201);
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

    // GET /api/v1/libraries/:id - Get library by ID
    app.get('/api/v1/libraries/:id', async (c) => {
      const id = parseInt(c.req.param('id'), 10);

      if (isNaN(id)) {
        return c.json({ success: false, error: 'Invalid library ID' }, 400);
      }

      try {
        const library = await mockLibraryService.getLibrary(id);
        if (!library) {
          return c.json({ success: false, error: 'Library not found' }, 404);
        }
        return c.json({ success: true, data: library });
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

    // PUT /api/v1/libraries/:id - Update a library
    app.put(
      '/api/v1/libraries/:id',
      zValidator('json', updateLibrarySchema),
      async (c) => {
        const id = parseInt(c.req.param('id'), 10);

        if (isNaN(id)) {
          return c.json({ success: false, error: 'Invalid library ID' }, 400);
        }

        try {
          const input = c.req.valid('json');
          const library = await mockLibraryService.updateLibrary(id, input);
          if (!library) {
            return c.json({ success: false, error: 'Library not found' }, 404);
          }
          return c.json({ success: true, data: library });
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

    // DELETE /api/v1/libraries/:id - Delete a library
    app.delete('/api/v1/libraries/:id', async (c) => {
      const id = parseInt(c.req.param('id'), 10);

      if (isNaN(id)) {
        return c.json({ success: false, error: 'Invalid library ID' }, 400);
      }

      try {
        const deleted = await mockLibraryService.deleteLibrary(id);
        if (!deleted) {
          return c.json({ success: false, error: 'Library not found' }, 404);
        }
        return c.json({ success: true, message: 'Library deleted successfully' });
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

  let app: ReturnType<typeof createLibrariesApp>;

  beforeEach(() => {
    app = createLibrariesApp();
    mockLibraryService.getAllLibraries.mockClear();
    mockLibraryService.getLibrary.mockClear();
    mockLibraryService.createLibrary.mockClear();
    mockLibraryService.updateLibrary.mockClear();
    mockLibraryService.deleteLibrary.mockClear();
    mockLibraryService.getUniquePlatforms.mockClear();
    mockLibraryService.testPath.mockClear();
  });

  describe('GET /api/v1/libraries', () => {
    test('should return all libraries', async () => {
      const res = await app.request('/api/v1/libraries');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].name).toBe('Main Games');
      expect(json.data[1].name).toBe('Steam Games');
    });

    test('should return empty array when no libraries', async () => {
      mockLibraryService.getAllLibraries.mockImplementationOnce(() =>
        Promise.resolve([])
      );

      const res = await app.request('/api/v1/libraries');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });

    test('should handle service errors', async () => {
      mockLibraryService.getAllLibraries.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      const res = await app.request('/api/v1/libraries');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database error');
    });
  });

  describe('GET /api/v1/libraries/platforms', () => {
    test('should return unique platforms', async () => {
      const res = await app.request('/api/v1/libraries/platforms');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toContain('PC');
      expect(json.data).toContain('Steam');
      expect(json.data).toContain('GOG');
    });

    test('should handle service errors', async () => {
      mockLibraryService.getUniquePlatforms.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to fetch platforms'))
      );

      const res = await app.request('/api/v1/libraries/platforms');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to fetch platforms');
    });
  });

  describe('POST /api/v1/libraries/test-path', () => {
    test('should return valid result for existing path', async () => {
      const res = await app.request('/api/v1/libraries/test-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/games/new' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(true);
      expect(json.data.exists).toBe(true);
      expect(json.data.readable).toBe(true);
      expect(json.data.writable).toBe(true);
    });

    test('should return invalid result for non-existent path', async () => {
      const res = await app.request('/api/v1/libraries/test-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/nonexistent/path' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(false);
    });

    test('should return 400 for missing path', async () => {
      const res = await app.request('/api/v1/libraries/test-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for empty path', async () => {
      const res = await app.request('/api/v1/libraries/test-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/libraries', () => {
    test('should create a new library', async () => {
      const res = await app.request('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Library',
          path: '/games/new',
          platform: 'PC',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(3);
      expect(json.data.name).toBe('New Library');
    });

    test('should create library with all optional fields', async () => {
      const res = await app.request('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Full Library',
          path: '/games/full',
          platform: 'GOG',
          monitored: true,
          downloadEnabled: true,
          downloadCategory: 'games',
          priority: 5,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.platform).toBe('GOG');
      expect(json.data.priority).toBe(5);
    });

    test('should return 400 for missing name', async () => {
      const res = await app.request('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/games/new',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for missing path', async () => {
      const res = await app.request('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Library',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for empty name', async () => {
      const res = await app.request('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          path: '/games/new',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 for negative priority', async () => {
      const res = await app.request('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Library',
          path: '/games/new',
          priority: -1,
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should handle service errors', async () => {
      mockLibraryService.createLibrary.mockImplementationOnce(() =>
        Promise.reject(new Error('Path already exists'))
      );

      const res = await app.request('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Library',
          path: '/games/existing',
        }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Path already exists');
    });
  });

  describe('GET /api/v1/libraries/:id', () => {
    test('should return library by ID', async () => {
      const res = await app.request('/api/v1/libraries/1');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
      expect(json.data.name).toBe('Main Games');
    });

    test('should return 404 for non-existent library', async () => {
      const res = await app.request('/api/v1/libraries/999');

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Library not found');
    });

    test('should return 400 for invalid ID', async () => {
      const res = await app.request('/api/v1/libraries/invalid');

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid library ID');
    });

    test('should handle service errors', async () => {
      mockLibraryService.getLibrary.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      const res = await app.request('/api/v1/libraries/1');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database error');
    });
  });

  describe('PUT /api/v1/libraries/:id', () => {
    test('should update library successfully', async () => {
      const res = await app.request('/api/v1/libraries/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Library',
          monitored: false,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Updated Library');
      expect(json.data.monitored).toBe(false);
    });

    test('should return 404 for non-existent library', async () => {
      const res = await app.request('/api/v1/libraries/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Library not found');
    });

    test('should return 400 for invalid ID', async () => {
      const res = await app.request('/api/v1/libraries/invalid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid library ID');
    });

    test('should return 400 for empty name', async () => {
      const res = await app.request('/api/v1/libraries/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      expect(res.status).toBe(400);
    });

    test('should handle service errors', async () => {
      mockLibraryService.updateLibrary.mockImplementationOnce(() =>
        Promise.reject(new Error('Update failed'))
      );

      const res = await app.request('/api/v1/libraries/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Update failed');
    });
  });

  describe('DELETE /api/v1/libraries/:id', () => {
    test('should delete library successfully', async () => {
      const res = await app.request('/api/v1/libraries/1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Library deleted successfully');
    });

    test('should return 404 for non-existent library', async () => {
      const res = await app.request('/api/v1/libraries/999', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Library not found');
    });

    test('should return 400 for invalid ID', async () => {
      const res = await app.request('/api/v1/libraries/invalid', {
        method: 'DELETE',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid library ID');
    });

    test('should handle service errors', async () => {
      mockLibraryService.deleteLibrary.mockImplementationOnce(() =>
        Promise.reject(new Error('Cannot delete library with games'))
      );

      const res = await app.request('/api/v1/libraries/1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Cannot delete library with games');
    });
  });
});
