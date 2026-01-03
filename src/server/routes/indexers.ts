import { Hono } from 'hono';
import { indexerService } from '../services/IndexerService';
import { logger } from '../utils/logger';

const indexers = new Hono();

// GET /api/v1/indexers - List indexers from Prowlarr
indexers.get('/', async (c) => {
  logger.info('GET /api/v1/indexers');

  try {
    const indexerList = await indexerService.getIndexers();
    return c.json({ success: true, data: indexerList });
  } catch (error) {
    logger.error('Failed to fetch indexers:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
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

export default indexers;
