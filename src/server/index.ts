import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { logger } from './utils/logger';
import { AppError, toAppError, formatErrorResponse } from './utils/errors';

// Import routes
import gamesRouter from './routes/games';
import searchRouter from './routes/search';
import downloadsRouter from './routes/downloads';
import indexersRouter from './routes/indexers';
import settingsRouter from './routes/settings';
import systemRouter from './routes/system';
import libraryRouter from './routes/library';
import updatesRouter from './routes/updates';
import discoverRouter from './routes/discover';
import steamRouter from './routes/steam';

// Initialize database
import './db';

// Import jobs
import { downloadMonitor } from './jobs/DownloadMonitor';
import { searchScheduler } from './jobs/SearchScheduler';
import { rssSync } from './jobs/RssSync';
import { metadataRefreshJob } from './jobs/MetadataRefreshJob';
import { updateCheckJob } from './jobs/UpdateCheckJob';

const app = new Hono();

// Middleware
app.use('*', honoLogger());
app.use('/api/*', cors());

// API routes
app.route('/api/v1/games', gamesRouter);
app.route('/api/v1/search', searchRouter);
app.route('/api/v1/downloads', downloadsRouter);
app.route('/api/v1/indexers', indexersRouter);
app.route('/api/v1/settings', settingsRouter);
app.route('/api/v1/system', systemRouter);
app.route('/api/v1/library', libraryRouter);
app.route('/api/v1/updates', updatesRouter);
app.route('/api/v1/discover', discoverRouter);
app.route('/api/v1/steam', steamRouter);

// Serve static frontend files (will add in Phase 1)
app.use('/*', serveStatic({ root: './dist' }));

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

  return c.json(formatErrorResponse(appError), appError.statusCode);
});

const port = process.env.PORT || 7878;

logger.info(`🎮 Gamearr v0.1.0 starting...`);
logger.info(`📡 Server running at http://localhost:${port}`);

// Debug: Check if IGDB credentials are loaded
if (process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET) {
  logger.info(`✅ IGDB credentials loaded (Client ID: ${process.env.IGDB_CLIENT_ID.substring(0, 8)}...)`);
} else {
  logger.warn('⚠️  IGDB credentials not found in environment variables');
}

// Start background jobs
downloadMonitor.start();
searchScheduler.start();
rssSync.start();
metadataRefreshJob.start();
updateCheckJob.start();
logger.info('✅ Background jobs started (DownloadMonitor, SearchScheduler, RssSync, MetadataRefreshJob, UpdateCheckJob)');

export default {
  port,
  fetch: app.fetch,
};
