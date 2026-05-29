import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { downloadService } from '../services/DownloadService';
import { settingsService } from '../services/SettingsService';
import { QBittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { SabnzbdClient } from '../integrations/sabnzbd/SabnzbdClient';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';

// Credentials for testing form values. Empty username/password are accepted
// as-is (legitimate for qBittorrent setups using IP whitelisting or no auth).
const qbTestSchema = z.object({
  host: z.string().min(1),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
});

const sabTestSchema = z.object({
  host: z.string().min(1),
  apiKey: z.string().min(1),
});

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
// With a body: tests exactly those credentials, used as-is (empty
// username/password are valid). Without a body: tests the saved settings.
// NOTE: Must be defined BEFORE /:hash route to avoid "test" being treated as a hash
downloads.post('/test', async (c) => {
  logger.info('POST /api/v1/downloads/test');

  try {
    let body: unknown = null;
    try {
      body = await c.req.json();
    } catch {
      // No JSON body — fall back to saved settings
    }

    let host: string | undefined;
    let username: string;
    let password: string;

    const hasBody = body != null && typeof body === 'object' && Object.keys(body).length > 0;
    if (hasBody) {
      const parsed = qbTestSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
          code: ErrorCode.VALIDATION_ERROR,
        }, 400);
      }
      host = parsed.data.host;
      username = parsed.data.username;
      password = parsed.data.password;
    } else {
      host = (await settingsService.getSetting('qbittorrent_host')) || undefined;
      username = (await settingsService.getSetting('qbittorrent_username')) ?? '';
      password = (await settingsService.getSetting('qbittorrent_password')) ?? '';
    }

    if (!host) {
      return c.json({ success: false, error: 'Host is required' }, 400);
    }

    // Use a throwaway client so the singleton isn't mutated by untrusted form values.
    // Call getVersion() directly (rather than testConnection() which swallows the
    // error to a bool) so we can surface the real reason to the user.
    const testClient = new QBittorrentClient({ host, username, password });
    try {
      const version = await testClient.getVersion();
      logger.info(`qBittorrent connection test succeeded (v${version})`);
      return c.json({ success: true, data: true });
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : 'Unknown error';
      logger.warn(`qBittorrent connection test failed: ${message}`);
      // Return success:false so the frontend's unwrap() throws with the real
      // message in err.message instead of the generic "Connection failed".
      return c.json({ success: false, error: message });
    }
  } catch (error) {
    logger.error('qBittorrent connection test errored:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

// POST /api/v1/downloads/test-sabnzbd - Test SABnzbd connection
// Accepts credentials in body to test form values without persisting them.
// NOTE: Must be defined BEFORE /:hash route
downloads.post('/test-sabnzbd', async (c) => {
  logger.info('POST /api/v1/downloads/test-sabnzbd');

  try {
    let host: string | null | undefined;
    let apiKey: string | null | undefined;

    let body: unknown = null;
    try {
      body = await c.req.json();
    } catch {
      // No JSON body - fall back to saved settings
    }

    const parsed = body ? sabTestSchema.safeParse(body) : null;

    if (parsed?.success) {
      host = parsed.data.host;
      apiKey = parsed.data.apiKey;
    } else {
      host = await settingsService.getSetting('sabnzbd_host');
      apiKey = await settingsService.getSetting('sabnzbd_api_key');
    }

    if (!host || !apiKey) {
      return c.json({ success: true, data: false, error: 'Host and API key are required' });
    }

    const testClient = new SabnzbdClient({ host, apiKey });
    const connected = await testClient.testConnection();
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
