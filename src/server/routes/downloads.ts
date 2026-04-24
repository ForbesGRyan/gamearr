import { Hono } from 'hono';
import { downloadService } from '../services/DownloadService';
import { settingsService } from '../services/SettingsService';
import { qbittorrentClient, QBittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { sabnzbdClient, SabnzbdClient } from '../integrations/sabnzbd/SabnzbdClient';
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/downloads/pause-all - Pause all downloads
// NOTE: Must be defined BEFORE /:hash route to avoid being treated as a hash
downloads.post('/pause-all', async (c) => {
  logger.info('POST /api/v1/downloads/pause-all');

  try {
    await downloadService.pauseAllDownloads();
    return c.json({ success: true, message: 'All downloads paused successfully' });
  } catch (error) {
    logger.error('Failed to pause all downloads:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/downloads/resume-all - Resume all downloads
downloads.post('/resume-all', async (c) => {
  logger.info('POST /api/v1/downloads/resume-all');

  try {
    await downloadService.resumeAllDownloads();
    return c.json({ success: true, message: 'All downloads resumed successfully' });
  } catch (error) {
    logger.error('Failed to resume all downloads:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/downloads/test - Test qBittorrent connection
// Optional body: { host, username, password } to test unsaved credentials via
// a transient client. Empty body falls back to the configured singleton.
// NOTE: Must be defined BEFORE /:hash route to avoid "test" being treated as a hash.
downloads.post('/test', async (c) => {
  logger.info('POST /api/v1/downloads/test');

  try {
    let body: { host?: string; username?: string; password?: string } | null = null;
    try {
      const raw = await c.req.text();
      if (raw) body = JSON.parse(raw);
    } catch {
      body = null;
    }

    if (body && body.host) {
      const transient = new QBittorrentClient({
        host: body.host,
        username: body.username ?? '',
        password: body.password ?? '',
      });
      const connected = await transient.testConnection();
      return c.json({ success: true, data: connected });
    }

    // Reload saved settings and reconfigure singleton before testing
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/downloads/test-sabnzbd - Test SABnzbd connection
// Optional body: { host, apiKey } to test unsaved credentials via a transient
// client. Empty body falls back to the configured singleton.
// NOTE: Must be defined BEFORE /:hash route.
downloads.post('/test-sabnzbd', async (c) => {
  logger.info('POST /api/v1/downloads/test-sabnzbd');

  try {
    let body: { host?: string; apiKey?: string } | null = null;
    try {
      const raw = await c.req.text();
      if (raw) body = JSON.parse(raw);
    } catch {
      body = null;
    }

    if (body && body.host && body.apiKey) {
      const transient = new SabnzbdClient({ host: body.host, apiKey: body.apiKey });
      const connected = await transient.testConnection();
      return c.json({ success: true, data: connected });
    }

    const sabHost = await settingsService.getSetting('sabnzbd_host');
    const sabApiKey = await settingsService.getSetting('sabnzbd_api_key');

    if (sabHost && sabApiKey) {
      sabnzbdClient.configure({ host: sabHost, apiKey: sabApiKey });
    }

    const connected = await downloadService.testSabnzbdConnection();
    return c.json({ success: true, data: connected });
  } catch (error) {
    logger.error('SABnzbd connection test failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
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
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// Validate and parse the 'client' query parameter
function parseClientParam(raw: string | undefined): 'qbittorrent' | 'sabnzbd' | undefined {
  if (raw === 'qbittorrent' || raw === 'sabnzbd') return raw;
  return undefined;
}

// DELETE /api/v1/downloads/:hash - Cancel download
downloads.delete('/:hash', async (c) => {
  const hash = c.req.param('hash');
  const deleteFiles = c.req.query('deleteFiles') === 'true';
  const client = parseClientParam(c.req.query('client'));

  logger.info(`DELETE /api/v1/downloads/${hash} (client: ${client || 'auto'})`);

  try {
    await downloadService.cancelDownload(hash, deleteFiles, client);
    return c.json({ success: true, message: 'Download cancelled successfully' });
  } catch (error) {
    logger.error('Failed to cancel download:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/downloads/:hash/pause - Pause download
downloads.post('/:hash/pause', async (c) => {
  const hash = c.req.param('hash');
  const client = parseClientParam(c.req.query('client'));
  logger.info(`POST /api/v1/downloads/${hash}/pause`);

  try {
    await downloadService.pauseDownload(hash, client);
    return c.json({ success: true, message: 'Download paused successfully' });
  } catch (error) {
    logger.error('Failed to pause download:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/downloads/:hash/resume - Resume download
downloads.post('/:hash/resume', async (c) => {
  const hash = c.req.param('hash');
  const client = parseClientParam(c.req.query('client'));
  logger.info(`POST /api/v1/downloads/${hash}/resume`);

  try {
    await downloadService.resumeDownload(hash, client);
    return c.json({ success: true, message: 'Download resumed successfully' });
  } catch (error) {
    logger.error('Failed to resume download:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

export default downloads;
