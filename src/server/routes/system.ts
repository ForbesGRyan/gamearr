import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { logger } from '../utils/logger';
import { APP_VERSION } from '../utils/version';
import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import { qbittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { settingsService } from '../services/SettingsService';
import { gameService } from '../services/GameService';
import { libraryService } from '../services/LibraryService';
import { isPathWithinBase } from '../utils/pathSecurity';
import { ErrorCode } from '../utils/errors';

const system = new Hono();

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unconfigured';
  message?: string;
  responseTime?: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: ServiceStatus[];
  stats?: {
    totalGames: number;
    wantedGames: number;
    downloadingGames: number;
    downloadedGames: number;
  };
}

// GET /api/v1/system/status - Basic health check (fast)
system.get('/status', async (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      version: APP_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/v1/system/health - Comprehensive health check with service status
system.get('/health', async (c) => {
  logger.info('GET /api/v1/system/health');

  const services: ServiceStatus[] = [];

  // Check Database
  const dbStatus = await checkDatabase();
  services.push(dbStatus);

  // Check IGDB (just config, not connectivity - to avoid rate limits)
  const igdbStatus = await checkIGDBConfig();
  services.push(igdbStatus);

  // Check Prowlarr
  const prowlarrStatus = await checkProwlarr();
  services.push(prowlarrStatus);

  // Check qBittorrent
  const qbittorrentStatus = await checkQBittorrent();
  services.push(qbittorrentStatus);

  // Get game stats
  const stats = await getGameStats();

  // Determine overall status
  const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length;
  const unconfiguredCount = services.filter((s) => s.status === 'unconfigured').length;

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0) {
    overallStatus = unhealthyCount >= 2 ? 'unhealthy' : 'degraded';
  } else if (unconfiguredCount > 0) {
    overallStatus = 'degraded';
  }

  const health: SystemHealth = {
    status: overallStatus,
    version: APP_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services,
    stats,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return c.json({ success: true, data: health }, statusCode);
});

// GET /api/v1/system/logs - Get recent logs
system.get('/logs', async (c) => {
  logger.info('GET /api/v1/system/logs');
  // TODO: Implement log retrieval
  return c.json({ success: true, data: [] });
});

// GET /api/v1/system/setup-status - Check if initial setup is complete
system.get('/setup-status', async (c) => {
  logger.info('GET /api/v1/system/setup-status');

  try {
    // Check each required component
    const hasLibrary = await libraryService.hasLibraries();

    const igdbClientId = await settingsService.getSetting('igdb_client_id');
    const igdbClientSecret = await settingsService.getSetting('igdb_client_secret');
    const hasIGDB = !!(igdbClientId && igdbClientSecret);

    const prowlarrUrl = await settingsService.getSetting('prowlarr_url');
    const prowlarrApiKey = await settingsService.getSetting('prowlarr_api_key');
    const hasProwlarr = !!(prowlarrUrl && prowlarrApiKey);

    const qbHost = await settingsService.getSetting('qbittorrent_host');
    const qbUsername = await settingsService.getSetting('qbittorrent_username');
    const qbPassword = await settingsService.getSetting('qbittorrent_password');
    const hasQBittorrent = !!(qbHost && qbUsername);

    // Check if setup was skipped
    const setupSkipped = await settingsService.getSetting('setup_skipped');

    const isComplete = setupSkipped === 'true' || (hasLibrary && hasIGDB && hasProwlarr && hasQBittorrent);

    return c.json({
      success: true,
      data: {
        isComplete,
        steps: {
          library: { configured: hasLibrary, required: true },
          igdb: { configured: hasIGDB, required: true },
          prowlarr: { configured: hasProwlarr, required: true },
          qbittorrent: { configured: hasQBittorrent, required: true },
        },
      },
    });
  } catch (error) {
    logger.error('Failed to check setup status:', error);
    return c.json({
      success: true,
      data: {
        isComplete: false,
        steps: {
          library: { configured: false, required: true },
          igdb: { configured: false, required: true },
          prowlarr: { configured: false, required: true },
          qbittorrent: { configured: false, required: true },
        },
      },
    });
  }
});

// POST /api/v1/system/reset-setup - Reset setup state (development only)
// Used by E2E tests to reset between test runs
system.post('/reset-setup', async (c) => {
  logger.info('POST /api/v1/system/reset-setup');

  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Attempted to reset setup in production mode');
    return c.json({
      success: false,
      error: 'Reset setup is only available in development mode',
    }, 403);
  }

  try {
    // Clear the setup_skipped setting by setting it to null/empty
    await settingsService.deleteSetting('setup_skipped');
    logger.info('Setup state has been reset');
    return c.json({ success: true });
  } catch (error) {
    logger.error('Failed to reset setup:', error);
    return c.json({ success: false, error: 'Failed to reset setup' }, 500);
  }
});

// POST /api/v1/system/skip-setup - Mark setup as skipped
// Security: Only allow skipping if setup hasn't been completed yet
system.post('/skip-setup', async (c) => {
  logger.info('POST /api/v1/system/skip-setup');

  try {
    // Security check: Don't allow skip if setup is already complete
    // This prevents unauthenticated users from modifying settings after initial setup
    const setupSkipped = await settingsService.getSetting('setup_skipped');
    const authEnabled = await settingsService.getSetting('auth_enabled');

    // If auth is enabled, this endpoint should have been blocked by auth middleware
    // But as defense-in-depth, reject here too
    if (authEnabled === 'true') {
      logger.warn('Attempted to skip setup after auth was enabled');
      return c.json({
        success: false,
        error: 'Cannot skip setup after authentication is enabled'
      }, 403);
    }

    // If setup was already skipped, just return success (idempotent)
    if (setupSkipped === 'true') {
      logger.info('Setup already skipped, returning success');
      return c.json({ success: true });
    }

    // Check if setup is already complete (all required services configured)
    const hasLibrary = await libraryService.hasLibraries();
    const igdbClientId = await settingsService.getSetting('igdb_client_id');
    const igdbClientSecret = await settingsService.getSetting('igdb_client_secret');
    const hasIGDB = !!(igdbClientId && igdbClientSecret);
    const prowlarrUrl = await settingsService.getSetting('prowlarr_url');
    const prowlarrApiKey = await settingsService.getSetting('prowlarr_api_key');
    const hasProwlarr = !!(prowlarrUrl && prowlarrApiKey);
    const qbHost = await settingsService.getSetting('qbittorrent_host');
    const qbUsername = await settingsService.getSetting('qbittorrent_username');
    const hasQBittorrent = !!(qbHost && qbUsername);

    // If setup is already complete, just return success
    if (hasLibrary && hasIGDB && hasProwlarr && hasQBittorrent) {
      logger.info('Setup already complete, returning success');
      return c.json({ success: true });
    }

    await settingsService.setSetting('setup_skipped', 'true');
    return c.json({ success: true });
  } catch (error) {
    logger.error('Failed to skip setup:', error);
    return c.json({ success: false, error: 'Failed to skip setup' }, 500);
  }
});

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await gameService.getGameCount();
    return {
      name: 'Database',
      status: 'healthy',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check IGDB configuration
 */
async function checkIGDBConfig(): Promise<ServiceStatus> {
  try {
    const clientId = await settingsService.getIGDBClientId();
    const clientSecret = await settingsService.getIGDBClientSecret();

    if (!clientId || !clientSecret) {
      return {
        name: 'IGDB',
        status: 'unconfigured',
        message: 'IGDB credentials not configured',
      };
    }

    return {
      name: 'IGDB',
      status: 'healthy',
      message: 'Configured',
    };
  } catch (error) {
    return {
      name: 'IGDB',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Prowlarr connectivity
 */
async function checkProwlarr(): Promise<ServiceStatus> {
  const start = Date.now();

  if (!prowlarrClient.isConfigured()) {
    return {
      name: 'Prowlarr',
      status: 'unconfigured',
      message: 'Prowlarr not configured',
    };
  }

  try {
    const connected = await prowlarrClient.testConnection();
    return {
      name: 'Prowlarr',
      status: connected ? 'healthy' : 'unhealthy',
      message: connected ? 'Connected' : 'Connection failed',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Prowlarr',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check qBittorrent connectivity
 */
async function checkQBittorrent(): Promise<ServiceStatus> {
  const start = Date.now();

  if (!qbittorrentClient.isConfigured()) {
    return {
      name: 'qBittorrent',
      status: 'unconfigured',
      message: 'qBittorrent not configured',
    };
  }

  try {
    const connected = await qbittorrentClient.testConnection();
    return {
      name: 'qBittorrent',
      status: connected ? 'healthy' : 'unhealthy',
      message: connected ? 'Connected' : 'Connection failed',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'qBittorrent',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Get game statistics
 */
async function getGameStats() {
  try {
    return await gameService.getGameStats();
  } catch (error) {
    logger.error('Failed to get game stats:', error);
    return undefined;
  }
}

// Schema for open folder request
const openFolderSchema = z.object({
  path: z.string().min(1),
});

// POST /api/v1/system/open-folder - Open a folder in the system file browser
system.post('/open-folder', zValidator('json', openFolderSchema), async (c) => {
  const { path } = c.req.valid('json');
  logger.info(`POST /api/v1/system/open-folder: ${path}`);

  try {
    // Check if path exists
    if (!existsSync(path)) {
      return c.json({
        success: false,
        error: 'Path does not exist',
        code: ErrorCode.NOT_FOUND,
      }, 404);
    }

    // Security: Validate path is within a configured library directory
    const libraries = await libraryService.getAllLibraries();
    const isWithinLibrary = libraries.some(library => isPathWithinBase(path, library.path));

    if (!isWithinLibrary) {
      logger.warn(`Path traversal attempt blocked in open-folder: ${path}`);
      return c.json({
        success: false,
        error: 'Access denied: path is outside configured library directories',
        code: ErrorCode.PATH_TRAVERSAL,
      }, 403);
    }

    // Check if it's a directory (if not, open parent directory)
    let folderPath = path;
    try {
      const stats = statSync(path);
      if (!stats.isDirectory()) {
        // It's a file, get the parent directory
        folderPath = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
      }
    } catch (error) {
      // If stat fails, try to open anyway - the path may still be accessible
      logger.debug(`Could not stat path ${path}, attempting to open anyway:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Determine the command based on OS
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === 'win32') {
      command = 'explorer';
      args = [folderPath];
    } else if (platform === 'darwin') {
      command = 'open';
      args = [folderPath];
    } else {
      // Linux and others
      command = 'xdg-open';
      args = [folderPath];
    }

    // Spawn the process detached so it doesn't block
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    logger.info(`Opened folder: ${folderPath}`);

    return c.json({
      success: true,
      data: { path: folderPath },
    });
  } catch (error) {
    logger.error('Failed to open folder:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open folder',
      code: ErrorCode.UNKNOWN,
    }, 500);
  }
});

export default system;
