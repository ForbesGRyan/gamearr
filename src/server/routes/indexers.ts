import { Hono } from 'hono';
import { indexerService } from '../services/IndexerService';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';

const indexers = new Hono();

// GET /api/v1/indexers - List indexers from Prowlarr
indexers.get('/', async (c) => {
  logger.info('GET /api/v1/indexers');

  try {
    const indexerList = await indexerService.getIndexers();
    return c.json({ success: true, data: indexerList });
  } catch (error) {
    logger.error('Failed to fetch indexers:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/indexers - Add indexer
indexers.post('/', async (c) => {
  logger.info('POST /api/v1/indexers');
  // TODO: Implement in Phase 3
  return c.json({ success: true, message: 'Not implemented yet' }, 501);
});

// PUT /api/v1/indexers/:id - Update indexer
indexers.put('/:id', async (c) => {
  const id = c.req.param('id');
  logger.info(`PUT /api/v1/indexers/${id}`);
  // TODO: Implement in Phase 3
  return c.json({ success: true, message: 'Not implemented yet' }, 501);
});

// DELETE /api/v1/indexers/:id - Delete indexer
indexers.delete('/:id', async (c) => {
  const id = c.req.param('id');
  logger.info(`DELETE /api/v1/indexers/${id}`);
  // TODO: Implement in Phase 3
  return c.json({ success: true, message: 'Not implemented yet' }, 501);
});

// GET /api/v1/indexers/test - Test Prowlarr connection
indexers.get('/test', async (c) => {
  logger.info('GET /api/v1/indexers/test');

  try {
    const connected = await indexerService.testConnection();
    return c.json({ success: true, data: connected });
  } catch (error) {
    logger.error('Prowlarr connection test failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/indexers/torrents - Get top torrents from indexers
indexers.get('/torrents', async (c) => {
  const query = c.req.query('query') || 'game';
  const limitParam = c.req.query('limit');
  const maxAgeParam = c.req.query('maxAge');

  // Parse and validate numeric params with defaults
  const limit = limitParam ? parseInt(limitParam) : 50;
  const maxAgeDays = maxAgeParam ? parseInt(maxAgeParam) : 30;

  // Validate params
  if (limitParam && (isNaN(limit) || limit < 1)) {
    return c.json({ success: false, error: 'Invalid limit parameter', code: ErrorCode.VALIDATION_ERROR }, 400);
  }
  if (maxAgeParam && (isNaN(maxAgeDays) || maxAgeDays < 1)) {
    return c.json({ success: false, error: 'Invalid maxAge parameter', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  logger.info(`GET /api/v1/indexers/torrents - query: ${query}, limit: ${limit}, maxAge: ${maxAgeDays} days`);

  try {
    const releases = await indexerService.manualSearch(query);

    // Filter by age
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

    const filtered = releases.filter(release => {
      const publishDate = new Date(release.publishedAt);
      return publishDate >= cutoffDate;
    });

    // Sort by seeders descending
    const sorted = filtered.sort((a, b) => b.seeders - a.seeders);

    // Return top N results
    return c.json({
      success: true,
      data: sorted.slice(0, limit)
    });
  } catch (error) {
    logger.error('Failed to fetch torrents:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default indexers;
