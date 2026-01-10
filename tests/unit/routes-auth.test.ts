import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';

// ============================================================================
// AUTH ROUTES TESTS
// ============================================================================

describe('Auth Routes', () => {
  // Mock auth functions
  const mockIsAuthEnabled = mock(() => Promise.resolve(false));
  const mockEnableAuth = mock(() => Promise.resolve('new-api-key-12345'));
  const mockDisableAuth = mock(() => Promise.resolve());
  const mockResetApiKey = mock(() => Promise.resolve('reset-api-key-67890'));

  // Create test app with auth routes
  const createAuthApp = () => {
    const app = new Hono();

    // GET /api/v1/auth/status - Check if authentication is enabled
    app.get('/api/v1/auth/status', async (c) => {
      try {
        const enabled = await mockIsAuthEnabled();

        return c.json({
          success: true,
          data: {
            authEnabled: enabled,
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

    // POST /api/v1/auth/enable - Enable authentication
    app.post('/api/v1/auth/enable', async (c) => {
      try {
        const newApiKey = await mockEnableAuth();

        if (newApiKey) {
          return c.json({
            success: true,
            data: {
              authEnabled: true,
              apiKey: newApiKey,
              message:
                'Authentication enabled. SAVE THIS API KEY - it will not be shown again!',
            },
          });
        }

        return c.json({
          success: true,
          data: {
            authEnabled: true,
            message: 'Authentication enabled with existing API key.',
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

    // POST /api/v1/auth/disable - Disable authentication
    app.post('/api/v1/auth/disable', async (c) => {
      try {
        await mockDisableAuth();

        return c.json({
          success: true,
          data: {
            authEnabled: false,
            message:
              'Authentication disabled. API is now accessible without authentication.',
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

    // POST /api/v1/auth/reset-key - Generate a new API key
    app.post('/api/v1/auth/reset-key', async (c) => {
      try {
        const newApiKey = await mockResetApiKey();

        return c.json({
          success: true,
          data: {
            apiKey: newApiKey,
            message:
              'API key reset. SAVE THIS NEW API KEY - it will not be shown again!',
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

  let app: ReturnType<typeof createAuthApp>;

  beforeEach(() => {
    app = createAuthApp();
    mockIsAuthEnabled.mockClear();
    mockEnableAuth.mockClear();
    mockDisableAuth.mockClear();
    mockResetApiKey.mockClear();
  });

  describe('GET /api/v1/auth/status', () => {
    test('should return auth disabled status', async () => {
      mockIsAuthEnabled.mockImplementationOnce(() => Promise.resolve(false));

      const res = await app.request('/api/v1/auth/status');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.authEnabled).toBe(false);
    });

    test('should return auth enabled status', async () => {
      mockIsAuthEnabled.mockImplementationOnce(() => Promise.resolve(true));

      const res = await app.request('/api/v1/auth/status');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.authEnabled).toBe(true);
    });

    test('should handle service errors', async () => {
      mockIsAuthEnabled.mockImplementationOnce(() =>
        Promise.reject(new Error('Database error'))
      );

      const res = await app.request('/api/v1/auth/status');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Database error');
    });
  });

  describe('POST /api/v1/auth/enable', () => {
    test('should enable auth and return new API key', async () => {
      const res = await app.request('/api/v1/auth/enable', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.authEnabled).toBe(true);
      expect(json.data.apiKey).toBe('new-api-key-12345');
      expect(json.data.message).toContain('SAVE THIS API KEY');
    });

    test('should enable auth with existing key', async () => {
      mockEnableAuth.mockImplementationOnce(() => Promise.resolve(null));

      const res = await app.request('/api/v1/auth/enable', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.authEnabled).toBe(true);
      expect(json.data.apiKey).toBeUndefined();
      expect(json.data.message).toContain('existing API key');
    });

    test('should handle service errors', async () => {
      mockEnableAuth.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to enable auth'))
      );

      const res = await app.request('/api/v1/auth/enable', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to enable auth');
    });
  });

  describe('POST /api/v1/auth/disable', () => {
    test('should disable auth successfully', async () => {
      const res = await app.request('/api/v1/auth/disable', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.authEnabled).toBe(false);
      expect(json.data.message).toContain('Authentication disabled');
    });

    test('should handle service errors', async () => {
      mockDisableAuth.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to disable auth'))
      );

      const res = await app.request('/api/v1/auth/disable', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to disable auth');
    });
  });

  describe('POST /api/v1/auth/reset-key', () => {
    test('should reset API key and return new key', async () => {
      const res = await app.request('/api/v1/auth/reset-key', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.apiKey).toBe('reset-api-key-67890');
      expect(json.data.message).toContain('SAVE THIS NEW API KEY');
    });

    test('should handle service errors', async () => {
      mockResetApiKey.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to reset key'))
      );

      const res = await app.request('/api/v1/auth/reset-key', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to reset key');
    });

    test('should return different keys on subsequent calls', async () => {
      mockResetApiKey
        .mockImplementationOnce(() => Promise.resolve('key-1'))
        .mockImplementationOnce(() => Promise.resolve('key-2'));

      const res1 = await app.request('/api/v1/auth/reset-key', {
        method: 'POST',
      });
      const json1 = await res1.json();

      const res2 = await app.request('/api/v1/auth/reset-key', {
        method: 'POST',
      });
      const json2 = await res2.json();

      expect(json1.data.apiKey).toBe('key-1');
      expect(json2.data.apiKey).toBe('key-2');
      expect(mockResetApiKey).toHaveBeenCalledTimes(2);
    });
  });
});
