import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { ErrorCode } from '../../src/server/utils/errors';

// ============================================================================
// DOWNLOADS ROUTES TESTS
// ============================================================================

describe('Downloads Routes', () => {
  // Mock download data
  const mockDownload = {
    hash: 'abc123def456',
    name: 'Test Game v1.0',
    size: 50000000000,
    progress: 0.5,
    downloadSpeed: 1000000,
    uploadSpeed: 500000,
    state: 'downloading',
    eta: 3600,
    category: 'gamearr',
    savePath: '/downloads/games',
    addedOn: Date.now(),
    completedOn: null,
  };

  // Mock completed download
  const mockCompletedDownload = {
    ...mockDownload,
    hash: 'completed123',
    progress: 1,
    state: 'completed',
    completedOn: Date.now(),
  };

  // Mock services
  const mockDownloadService = {
    getActiveDownloads: mock((includeCompleted: boolean) =>
      Promise.resolve(
        includeCompleted ? [mockDownload, mockCompletedDownload] : [mockDownload]
      )
    ),
    getDownload: mock((hash: string) =>
      Promise.resolve(hash === 'abc123def456' ? mockDownload : null)
    ),
    cancelDownload: mock(() => Promise.resolve()),
    pauseDownload: mock(() => Promise.resolve()),
    resumeDownload: mock(() => Promise.resolve()),
    testConnection: mock(() => Promise.resolve(true)),
  };

  const mockSettingsService = {
    getSetting: mock((key: string) => {
      if (key === 'qbittorrent_host') return Promise.resolve('http://localhost:8080');
      if (key === 'qbittorrent_username') return Promise.resolve('admin');
      if (key === 'qbittorrent_password') return Promise.resolve('password');
      return Promise.resolve(null);
    }),
  };

  // Create test app with downloads routes
  const createDownloadsApp = () => {
    const app = new Hono();

    // GET /api/v1/downloads - Get current downloads
    app.get('/api/v1/downloads', async (c) => {
      const includeCompleted = c.req.query('includeCompleted') === 'true';

      try {
        const activeDownloads = await mockDownloadService.getActiveDownloads(
          includeCompleted
        );
        return c.json({ success: true, data: activeDownloads });
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

    // GET /api/v1/downloads/test - Test qBittorrent connection
    app.get('/api/v1/downloads/test', async (c) => {
      try {
        const connected = await mockDownloadService.testConnection();
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

    // GET /api/v1/downloads/:hash - Get download by hash
    app.get('/api/v1/downloads/:hash', async (c) => {
      const hash = c.req.param('hash');

      try {
        const download = await mockDownloadService.getDownload(hash);

        if (!download) {
          return c.json(
            { success: false, error: 'Download not found', code: ErrorCode.NOT_FOUND },
            404
          );
        }

        return c.json({ success: true, data: download });
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

    // DELETE /api/v1/downloads/:hash - Cancel download
    app.delete('/api/v1/downloads/:hash', async (c) => {
      const hash = c.req.param('hash');
      const deleteFiles = c.req.query('deleteFiles') === 'true';

      try {
        await mockDownloadService.cancelDownload(hash, deleteFiles);
        return c.json({ success: true, message: 'Download cancelled successfully' });
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

    // POST /api/v1/downloads/:hash/pause - Pause download
    app.post('/api/v1/downloads/:hash/pause', async (c) => {
      const hash = c.req.param('hash');

      try {
        await mockDownloadService.pauseDownload(hash);
        return c.json({ success: true, message: 'Download paused successfully' });
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

    // POST /api/v1/downloads/:hash/resume - Resume download
    app.post('/api/v1/downloads/:hash/resume', async (c) => {
      const hash = c.req.param('hash');

      try {
        await mockDownloadService.resumeDownload(hash);
        return c.json({ success: true, message: 'Download resumed successfully' });
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

  let app: ReturnType<typeof createDownloadsApp>;

  beforeEach(() => {
    app = createDownloadsApp();
    mockDownloadService.getActiveDownloads.mockClear();
    mockDownloadService.getDownload.mockClear();
    mockDownloadService.cancelDownload.mockClear();
    mockDownloadService.pauseDownload.mockClear();
    mockDownloadService.resumeDownload.mockClear();
    mockDownloadService.testConnection.mockClear();
    mockSettingsService.getSetting.mockClear();
  });

  describe('GET /api/v1/downloads', () => {
    test('should return active downloads', async () => {
      const res = await app.request('/api/v1/downloads');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].hash).toBe('abc123def456');
      expect(mockDownloadService.getActiveDownloads).toHaveBeenCalledWith(false);
    });

    test('should include completed downloads when requested', async () => {
      const res = await app.request('/api/v1/downloads?includeCompleted=true');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(mockDownloadService.getActiveDownloads).toHaveBeenCalledWith(true);
    });

    test('should handle service errors', async () => {
      mockDownloadService.getActiveDownloads.mockImplementationOnce(() =>
        Promise.reject(new Error('qBittorrent connection failed'))
      );

      const res = await app.request('/api/v1/downloads');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('qBittorrent connection failed');
    });

    test('should return empty array when no downloads', async () => {
      mockDownloadService.getActiveDownloads.mockImplementationOnce(() =>
        Promise.resolve([])
      );

      const res = await app.request('/api/v1/downloads');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/downloads/test', () => {
    test('should return true when connected', async () => {
      const res = await app.request('/api/v1/downloads/test');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe(true);
    });

    test('should return false when not connected', async () => {
      mockDownloadService.testConnection.mockImplementationOnce(() =>
        Promise.resolve(false)
      );

      const res = await app.request('/api/v1/downloads/test');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBe(false);
    });

    test('should handle connection errors', async () => {
      mockDownloadService.testConnection.mockImplementationOnce(() =>
        Promise.reject(new Error('Connection refused'))
      );

      const res = await app.request('/api/v1/downloads/test');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Connection refused');
    });
  });

  describe('GET /api/v1/downloads/:hash', () => {
    test('should return download by hash', async () => {
      const res = await app.request('/api/v1/downloads/abc123def456');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.hash).toBe('abc123def456');
      expect(json.data.name).toBe('Test Game v1.0');
    });

    test('should return 404 when download not found', async () => {
      const res = await app.request('/api/v1/downloads/nonexistent');

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Download not found');
      expect(json.code).toBe(ErrorCode.NOT_FOUND);
    });

    test('should handle service errors', async () => {
      mockDownloadService.getDownload.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to fetch download'))
      );

      const res = await app.request('/api/v1/downloads/abc123def456');

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to fetch download');
    });
  });

  describe('DELETE /api/v1/downloads/:hash', () => {
    test('should cancel download without deleting files', async () => {
      const res = await app.request('/api/v1/downloads/abc123def456', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Download cancelled successfully');
      expect(mockDownloadService.cancelDownload).toHaveBeenCalledWith(
        'abc123def456',
        false
      );
    });

    test('should cancel download and delete files when requested', async () => {
      const res = await app.request(
        '/api/v1/downloads/abc123def456?deleteFiles=true',
        { method: 'DELETE' }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockDownloadService.cancelDownload).toHaveBeenCalledWith(
        'abc123def456',
        true
      );
    });

    test('should handle service errors', async () => {
      mockDownloadService.cancelDownload.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to cancel download'))
      );

      const res = await app.request('/api/v1/downloads/abc123def456', {
        method: 'DELETE',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to cancel download');
    });
  });

  describe('POST /api/v1/downloads/:hash/pause', () => {
    test('should pause download successfully', async () => {
      const res = await app.request('/api/v1/downloads/abc123def456/pause', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Download paused successfully');
      expect(mockDownloadService.pauseDownload).toHaveBeenCalledWith('abc123def456');
    });

    test('should handle service errors', async () => {
      mockDownloadService.pauseDownload.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to pause download'))
      );

      const res = await app.request('/api/v1/downloads/abc123def456/pause', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to pause download');
    });
  });

  describe('POST /api/v1/downloads/:hash/resume', () => {
    test('should resume download successfully', async () => {
      const res = await app.request('/api/v1/downloads/abc123def456/resume', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Download resumed successfully');
      expect(mockDownloadService.resumeDownload).toHaveBeenCalledWith('abc123def456');
    });

    test('should handle service errors', async () => {
      mockDownloadService.resumeDownload.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to resume download'))
      );

      const res = await app.request('/api/v1/downloads/abc123def456/resume', {
        method: 'POST',
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to resume download');
    });
  });
});
