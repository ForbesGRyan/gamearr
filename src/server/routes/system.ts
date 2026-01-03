import { Hono } from 'hono';
import { logger } from '../utils/logger';

const system = new Hono();

// GET /api/v1/system/status - Health check
system.get('/status', async (c) => {
  logger.info('GET /api/v1/system/status');
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      version: '0.1.0',
      uptime: process.uptime(),
    },
  });
});

// GET /api/v1/system/logs - Get recent logs
system.get('/logs', async (c) => {
  logger.info('GET /api/v1/system/logs');
  // TODO: Implement in Phase 7
  return c.json({ success: true, data: [] });
});

export default system;
