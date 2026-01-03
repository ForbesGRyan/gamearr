import { Hono } from 'hono';
import { downloadService } from '../services/DownloadService';
import { logger } from '../utils/logger';

const downloads = new Hono();

// GET /api/v1/downloads - Get current downloads
downloads.get('/', async (c) => {
  logger.info('GET /api/v1/downloads');

  try {
    const activeDownloads = await downloadService.getActiveDownloads();
    return c.json({ success: true, data: activeDownloads });
  } catch (error) {
    logger.error('Failed to get downloads:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// GET /api/v1/downloads/:hash - Get download by hash
downloads.get('/:hash', async (c) => {
  const hash = c.req.param('hash');
  logger.info(`GET /api/v1/downloads/${hash}`);

  try {
    const download = await downloadService.getDownload(hash);

    if (!download) {
      return c.json({ success: false, error: 'Download not found' }, 404);
    }

    return c.json({ success: true, data: download });
  } catch (error) {
    logger.error('Failed to get download:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// DELETE /api/v1/downloads/:hash - Cancel download
downloads.delete('/:hash', async (c) => {
  const hash = c.req.param('hash');
  const deleteFiles = c.req.query('deleteFiles') === 'true';

  logger.info(`DELETE /api/v1/downloads/${hash}`);

  try {
    await downloadService.cancelDownload(hash, deleteFiles);
    return c.json({ success: true, message: 'Download cancelled successfully' });
  } catch (error) {
    logger.error('Failed to cancel download:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/downloads/:hash/pause - Pause download
downloads.post('/:hash/pause', async (c) => {
  const hash = c.req.param('hash');
  logger.info(`POST /api/v1/downloads/${hash}/pause`);

  try {
    await downloadService.pauseDownload(hash);
    return c.json({ success: true, message: 'Download paused successfully' });
  } catch (error) {
    logger.error('Failed to pause download:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// POST /api/v1/downloads/:hash/resume - Resume download
downloads.post('/:hash/resume', async (c) => {
  const hash = c.req.param('hash');
  logger.info(`POST /api/v1/downloads/${hash}/resume`);

  try {
    await downloadService.resumeDownload(hash);
    return c.json({ success: true, message: 'Download resumed successfully' });
  } catch (error) {
    logger.error('Failed to resume download:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default downloads;
