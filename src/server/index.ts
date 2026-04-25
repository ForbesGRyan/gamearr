import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { logger } from './utils/logger';
import { APP_VERSION } from './utils/version';
import { AppError, toAppError, formatErrorResponse } from './utils/errors';
import { createEmbeddedStaticMiddleware } from './middleware/embeddedStatic';
import { frontendVFS, VFS_FILE_COUNT } from './generated/frontend-vfs';

// Import auth middleware
import { createAuthMiddleware, writeAccessMiddleware } from './middleware/auth';

// Import rate limiting middleware
import {
  generalRateLimiter,
  sensitiveRateLimiter,
  searchRateLimiter,
} from './middleware/rateLimit';

// Import CSRF protection middleware
import { csrfProtection } from './middleware/csrf';

// Import routes
import gamesRouter from './routes/games';
import searchRouter from './routes/search';
import downloadsRouter from './routes/downloads';
import indexersRouter from './routes/indexers';
import settingsRouter from './routes/settings';
import systemRouter from './routes/system';
import libraryRouter from './routes/library';
import librariesRouter from './routes/libraries';
import updatesRouter from './routes/updates';
import discoverRouter from './routes/discover';
import steamRouter from './routes/steam';
import gogRouter from './routes/gog';
import authRouter from './routes/auth';
import imagesRouter from './routes/images';
import notificationsRouter from './routes/notifications';
import tasksRouter from './routes/tasks';

// Initialize database
import './db';

// Import jobs
import { downloadMonitor } from './jobs/DownloadMonitor';
import { searchScheduler } from './jobs/SearchScheduler';
import { rssSync } from './jobs/RssSync';
import { metadataRefreshJob } from './jobs/MetadataRefreshJob';
import { updateCheckJob } from './jobs/UpdateCheckJob';
import { logRotationJob } from './jobs/LogRotationJob';
import { discoverCacheJob } from './jobs/DiscoverCacheJob';
import { applicationUpdateCheckJob } from './jobs/ApplicationUpdateCheckJob';
import { sessionCleanupJob } from './jobs/SessionCleanupJob';
import { CronJob } from 'cron';
import { taskRepository } from './queue/TaskRepository';
import { taskQueue } from './queue/TaskQueue';
import { handlerRegistry } from './queue/registry';
import { TaskWorker } from './queue/TaskWorker';
import { registerAllHandlers } from './queue/handlers';
import { runArchiveSweep } from './queue/TaskArchiver';

// Import integration clients for configuration
import { qbittorrentClient } from './integrations/qbittorrent/QBittorrentClient';
import { prowlarrClient } from './integrations/prowlarr/ProwlarrClient';
import { igdbClient } from './integrations/igdb/IGDBClient';
import { sabnzbdClient } from './integrations/sabnzbd/SabnzbdClient';
import { discordClient } from './integrations/discord/DiscordWebhookClient';
import { settingsService } from './services/SettingsService';
import { libraryService } from './services/LibraryService';
import { embeddingService } from './services/EmbeddingService';

// Single in-process queue worker. Started after handlers register.
const taskWorker = new TaskWorker({
  repo: taskRepository,
  queue: taskQueue,
  registry: handlerRegistry,
  workerId: `gamearr-${process.pid}`,
});

const app = new Hono();

// Middleware
app.use('*', honoLogger());

// CORS configuration - allow all origins (standard for self-hosted *arr apps)
// CSRF middleware provides protection for state-changing requests
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400, // 24 hours
}));

// CSRF protection - validates Origin header for state-changing requests
app.use('/api/*', csrfProtection());

// Auth middleware - protects API routes when authentication is enabled
// Skip auth for setup-related endpoints and auth endpoints that need to work without auth
const authMiddleware = createAuthMiddleware([
  '/api/v1/auth/status',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/system/setup-status',
  '/api/v1/system/skip-setup',
  '/api/v1/images',
]);
app.use('/api/*', authMiddleware);

// Write access middleware - blocks viewers from making changes
app.use('/api/*', writeAccessMiddleware);

// Rate limiting middleware
// Apply stricter limits to sensitive endpoints (auth, settings)
app.use('/api/v1/auth/*', sensitiveRateLimiter);
app.use('/api/v1/settings/*', sensitiveRateLimiter);
// Apply search-specific limits to search endpoints
app.use('/api/v1/search/*', searchRateLimiter);
app.use('/api/v1/discover/*', searchRateLimiter);
// Apply general limits to all other API endpoints
app.use('/api/*', generalRateLimiter);

// API routes
app.route('/api/v1/auth', authRouter);
app.route('/api/v1/games', gamesRouter);
app.route('/api/v1/search', searchRouter);
app.route('/api/v1/downloads', downloadsRouter);
app.route('/api/v1/indexers', indexersRouter);
app.route('/api/v1/settings', settingsRouter);
app.route('/api/v1/system', systemRouter);
app.route('/api/v1/library', libraryRouter);
app.route('/api/v1/libraries', librariesRouter);
app.route('/api/v1/updates', updatesRouter);
app.route('/api/v1/discover', discoverRouter);
app.route('/api/v1/steam', steamRouter);
app.route('/api/v1/gog', gogRouter);
app.route('/api/v1/images', imagesRouter);
app.route('/api/v1/notifications', notificationsRouter);
app.route('/api/v1/tasks', tasksRouter);

// Serve static frontend files
// Use embedded VFS in production (single binary), fall back to filesystem in development
if (VFS_FILE_COUNT > 0) {
  logger.info(`📦 Serving frontend from embedded VFS (${VFS_FILE_COUNT} files)`);
  app.use('/*', createEmbeddedStaticMiddleware(frontendVFS));
} else {
  logger.info('📁 Serving frontend from ./dist (development mode)');
  app.use('/*', serveStatic({ root: './dist' }));
}

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  const appError = toAppError(err);

  // Log error with appropriate level
  if (appError.statusCode >= 500) {
    logger.error(`[${appError.code}] ${appError.message}`, err);
  } else {
    logger.warn(`[${appError.code}] ${appError.message}`);
  }

  return c.json(formatErrorResponse(appError), appError.statusCode as any);
});

const port = process.env.PORT || 8484;

logger.info(`🎮 Gamearr v${APP_VERSION} starting...`);
logger.info(`📡 Server running at http://localhost:${port}`);

/**
 * Initialize integration clients from database settings
 */
async function initializeClients() {
  try {
    // Load qBittorrent settings
    const qbHost = await settingsService.getSetting('qbittorrent_host');
    const qbUsername = await settingsService.getSetting('qbittorrent_username');
    const qbPassword = await settingsService.getSetting('qbittorrent_password');

    // Allow empty password - some qBittorrent setups don't require one
    if (qbHost && qbUsername !== null) {
      qbittorrentClient.configure({
        host: qbHost,
        username: qbUsername || '',
        password: qbPassword || '',
      });
    } else if (process.env.QBITTORRENT_HOST) {
      logger.info('qBittorrent credentials loaded from environment');
    } else {
      logger.warn('qBittorrent not configured - add settings in Settings > Downloads');
    }

    // Load Prowlarr settings
    const prowlarrUrl = await settingsService.getSetting('prowlarr_url');
    const prowlarrApiKey = await settingsService.getSetting('prowlarr_api_key');

    if (prowlarrUrl && prowlarrApiKey) {
      prowlarrClient.configure({
        url: prowlarrUrl,
        apiKey: prowlarrApiKey,
      });
    } else if (process.env.PROWLARR_URL) {
      logger.info('Prowlarr credentials loaded from environment');
    } else {
      logger.warn('Prowlarr not configured - add settings in Settings > Indexers');
    }

    // Load IGDB settings
    const igdbClientId = await settingsService.getSetting('igdb_client_id');
    const igdbClientSecret = await settingsService.getSetting('igdb_client_secret');

    if (igdbClientId && igdbClientSecret) {
      igdbClient.configure({
        clientId: igdbClientId,
        clientSecret: igdbClientSecret,
      });
    } else if (process.env.IGDB_CLIENT_ID) {
      logger.info('IGDB credentials loaded from environment');
    } else {
      logger.warn('IGDB not configured - add settings in Settings > Metadata');
    }

    // Load SABnzbd settings
    const sabHost = await settingsService.getSetting('sabnzbd_host');
    const sabApiKey = await settingsService.getSetting('sabnzbd_api_key');

    if (sabHost && sabApiKey) {
      sabnzbdClient.configure({ host: sabHost, apiKey: sabApiKey });
    } else if (process.env.SABNZBD_HOST) {
      logger.info('SABnzbd credentials loaded from environment');
    } else {
      logger.info('SABnzbd not configured - add settings in Settings > Downloads (optional)');
    }

    // Load Discord webhook settings
    const discordWebhookUrl = await settingsService.getSetting('discord_webhook_url');

    if (discordWebhookUrl) {
      discordClient.configure({ webhookUrl: discordWebhookUrl });
      logger.info('Discord webhook configured');
    } else if (process.env.DISCORD_WEBHOOK_URL) {
      logger.info('Discord webhook loaded from environment');
    }
  } catch (error) {
    logger.error('Failed to initialize clients from database:', error);
  }
}

// Initialize clients and start jobs
initializeClients().then(async () => {
  // Run migrations
  try {
    const migratedLibrary = await libraryService.migrateFromSingleLibrary();
    if (migratedLibrary) {
      logger.info(`✅ Migrated library_path to libraries table: ${migratedLibrary.name}`);
    }
  } catch (error) {
    logger.error('Failed to migrate library_path:', error);
  }

  // Start background jobs
  downloadMonitor.start();
  searchScheduler.start();
  rssSync.start();
  metadataRefreshJob.start();
  updateCheckJob.start();
  logRotationJob.start();
  discoverCacheJob.start();
  applicationUpdateCheckJob.start();
  sessionCleanupJob.start();
  logger.info('✅ Background jobs started');

  // Register task handlers and start the queue worker.
  registerAllHandlers();
  taskWorker.start();
  logger.info('✅ Task queue worker started');

  // Daily archive sweep at 03:15 local time.
  new CronJob('0 15 3 * * *', () => {
    try {
      runArchiveSweep();
    } catch (err) {
      logger.error('Task archive sweep failed:', err);
    }
  }).start();

  // Warm the embedding model so the first search doesn't pay the load cost.
  // Fire-and-forget; failures are logged inside the service and degrade to
  // non-semantic search.
  embeddingService.initialize().catch((err) => {
    logger.warn('Embedding model warm-up failed:', err);
  });
});

Bun.serve({
  port: Number(port),
  fetch: app.fetch,
  // Default is 10s, which is too short for slow first-time operations such as
  // the embedding model download (~30s cold) or large IGDB result parses.
  idleTimeout: 120,
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down...`);
  try {
    await taskWorker.stop(10_000);
    logger.info('Task worker stopped');
  } catch (err) {
    logger.error('Error stopping task worker:', err);
  }
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
