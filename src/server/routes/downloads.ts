import { Hono } from 'hono';
import { downloadService } from '../services/DownloadService';
import { settingsService } from '../services/SettingsService';
import { qbittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';

const downloads = new Hono();

// GET /api/v1/downloads - Get current downloads
downloads.get('/', async (c) => {
  const includeCompleted = c.req.query('includeCompleted') === 'true';
  logger.info(`GET /api/v1/downloads (includeCompleted: ${includeCompleted})`);

  try {
    const activeDownloads = await downloadService.getActiveDownloads(includeCompleted);
    return c.json({ success: true, data: activeDownloads });
  } catch (error) {
    logger.error('Failed to get downloads:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/downloads/test - Test qBittorrent connection
// NOTE: Must be defined BEFORE /:hash route to avoid "test" being treated as a hash
downloads.get('/test', async (c) => {
  logger.info('GET /api/v1/downloads/test');

  try {
    // Reload settings and reconfigure client before testing
    const qbHost = await settingsService.getSetting('qbittorrent_host');
    const qbUsername = await settingsService.getSetting('qbittorrent_username');
    const qbPassword = await settingsService.getSetting('qbittorrent_password');

    if (qbHost) {
      qbittorrentClient.configure({
        host: qbHost,
        username: qbUsername || '',
        password: qbPassword || '',
      });
    }

    const connected = await downloadService.testConnection();
    return c.json({ success: true, data: connected });
  } catch (error) {
    logger.error('qBittorrent connection test failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// DELETE /api/v1/downloads/orphaned - Remove orphaned torrents (game tags where game no longer exists)
// NOTE: Must be defined BEFORE /:hash route to avoid "orphaned" being treated as a hash
downloads.delete('/orphaned', async (c) => {
  const deleteFiles = c.req.query('deleteFiles') === 'true';
  logger.info(`DELETE /api/v1/downloads/orphaned (deleteFiles: ${deleteFiles})`);

  try {
    const result = await downloadService.removeOrphanedTorrents(deleteFiles);
    return c.json({
      success: true,
      data: {
        removed: result.removed,
        orphans: result.orphans,
      },
      message: result.removed > 0
        ? `Removed ${result.removed} orphaned torrent(s)`
        : 'No orphaned torrents found',
    });
  } catch (error) {
    logger.error('Failed to remove orphaned torrents:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/downloads/:hash - Get download by hash
downloads.get('/:hash', async (c) => {
  const hash = c.req.param('hash');
  logger.info(`GET /api/v1/downloads/${hash}`);

  try {
    const download = await downloadService.getDownload(hash);

    if (!download) {
      return c.json({ success: false, error: 'Download not found', code: ErrorCode.NOT_FOUND }, 404);
    }

    return c.json({ success: true, data: download });
  } catch (error) {
    logger.error('Failed to get download:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// DELETE /api/v1/downloads/:hash - Cancel download
downloads.delete('/:hash', async (c) => {
  const hash = c.req.param('hash');
  const deleteFiles = c.req.query('deleteFiles') === 'true';

  logger.info(`DELETE /api/v1/downloads/${hash}`);

  try {
    await downloadService.cancelDownload(hash, deleteFiles);
    return c.json({ success: true, message: 'Download cancelled successfully' });
  } catch (error) {
    logger.error('Failed to cancel download:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/downloads/:hash/pause - Pause download
downloads.post('/:hash/pause', async (c) => {
  const hash = c.req.param('hash');
  logger.info(`POST /api/v1/downloads/${hash}/pause`);

  try {
    await downloadService.pauseDownload(hash);
    return c.json({ success: true, message: 'Download paused successfully' });
  } catch (error) {
    logger.error('Failed to pause download:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/downloads/:hash/resume - Resume download
downloads.post('/:hash/resume', async (c) => {
  const hash = c.req.param('hash');
  logger.info(`POST /api/v1/downloads/${hash}/resume`);

  try {
    await downloadService.resumeDownload(hash);
    return c.json({ success: true, message: 'Download resumed successfully' });
  } catch (error) {
    logger.error('Failed to resume download:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default downloads;
