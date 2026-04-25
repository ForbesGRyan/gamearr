import { gameRepository } from '../repositories/GameRepository';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { taskQueue } from '../queue/TaskQueue';
import { logger } from '../utils/logger';

/**
 * Background job: scans for games missing metadata and enqueues a metadata.refresh
 * task for each. Actual IGDB work runs in the queue worker.
 */
export class MetadataRefreshJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  start(intervalMs: number = 5 * 60 * 1000) {
    logger.info('Starting MetadataRefreshJob (enqueue mode)...');
    void this.scan();
    this.intervalId = setInterval(() => {
      void this.scan();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('MetadataRefreshJob stopped');
    }
  }

  private async scan() {
    if (this.isRunning) {
      logger.debug('MetadataRefreshJob scan already in progress, skipping');
      return;
    }
    if (!igdbClient.isConfigured()) {
      logger.debug('IGDB not configured, skipping metadata scan');
      return;
    }

    this.isRunning = true;
    try {
      const allGames = await gameRepository.findAll();
      const needs = allGames.filter((g) => g.summary === null && g.igdbId);
      if (needs.length === 0) {
        logger.debug('No games need metadata refresh');
        return;
      }

      let enqueued = 0;
      for (const g of needs) {
        const t = taskQueue.enqueue(
          'metadata.refresh',
          { gameId: g.id },
          { dedupKey: `game:${g.id}`, priority: 0 }
        );
        // enqueue returns existing row on dedup hit; only count when we actually inserted
        if (t.attempts === 0 && t.status === 'pending') enqueued++;
      }
      if (enqueued > 0) {
        logger.info(`MetadataRefreshJob enqueued ${enqueued} metadata.refresh task(s)`);
      }
    } catch (err) {
      logger.error('MetadataRefreshJob scan error:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const metadataRefreshJob = new MetadataRefreshJob();
