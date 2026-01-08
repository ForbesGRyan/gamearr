import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { logger } from './utils/logger';
import { APP_VERSION } from './utils/version';
import { AppError, toAppError, formatErrorResponse } from './utils/errors';

// Import auth middleware
import { createAuthMiddleware } from './middleware/auth';

// Import rate limiting middleware
import {
  generalRateLimiter,
  sensitiveRateLimiter,
  searchRateLimiter,
} from './middleware/rateLimit';

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
import authRouter from './routes/auth';

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

// CORS configuration - restrict to known origins in production
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : process.env.NODE_ENV === 'production'
    ? [] // No external origins in production by default (same-origin only)
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];

app.use('/api/*', cors({
  origin: (origin) => {
    // Allow same-origin requests (no Origin header)
    if (!origin) return null;
    // Allow configured origins
    if (corsOrigins.length === 0) return null; // Same-origin only
    if (corsOrigins.includes(origin)) return origin;
    return null; // Deny other origins
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400, // 24 hours
}));

// Auth middleware - protects API routes when authentication is enabled
// Skip auth for: /api/v1/auth/status (needed to check if auth is enabled)
const authMiddleware = createAuthMiddleware(['/api/v1/auth/status']);
app.use('/api/*', authMiddleware);

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

logger.info(`🎮 Gamearr v${APP_VERSION} starting...`);
logger.info(`📡 Server running at http://localhost:${port}`);

// Check if IGDB credentials are loaded (without logging sensitive data)
if (process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET) {
  logger.info('IGDB credentials loaded from environment');
} else {
  logger.warn('IGDB credentials not found in environment variables');
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
