import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { logger } from './utils/logger';

// Import routes
import gamesRouter from './routes/games';
import searchRouter from './routes/search';
import downloadsRouter from './routes/downloads';
import indexersRouter from './routes/indexers';
import settingsRouter from './routes/settings';
import systemRouter from './routes/system';
import libraryRouter from './routes/library';

// Initialize database
import './db';

// Import jobs
import { downloadMonitor } from './jobs/DownloadMonitor';

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

// Serve static frontend files (will add in Phase 1)
app.use('/*', serveStatic({ root: './dist' }));

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error('Unhandled error:', err);
  return c.json({ success: false, error: err.message }, 500);
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
logger.info('✅ Background jobs started');

export default {
  port,
  fetch: app.fetch,
};
