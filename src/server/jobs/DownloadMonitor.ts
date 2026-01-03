import { CronJob } from 'cron';
import { downloadService } from '../services/DownloadService';
import { logger } from '../utils/logger';

/**
 * Download Monitor Job
 * Runs every 30 seconds to sync download status from qBittorrent
 */
export class DownloadMonitor {
  private job: CronJob | null = null;
  private isRunning = false;

  /**
   * Start the download monitor
   */
  start() {
    if (this.job) {
      logger.warn('Download monitor is already running');
      return;
    }

    logger.info('Starting download monitor (runs every 30 seconds)');

    // Run every 30 seconds
    this.job = new CronJob('*/30 * * * * *', async () => {
      await this.sync();
    });

    this.job.start();
  }

  /**
   * Stop the download monitor
   */
  stop() {
    if (this.job) {
      logger.info('Stopping download monitor');
      this.job.stop();
      this.job = null;
    }
  }

  /**
   * Sync download status
   */
  private async sync() {
    if (this.isRunning) {
      logger.debug('Download sync already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      await downloadService.syncDownloadStatus();
    } catch (error) {
      logger.error('Download monitor sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual sync trigger
   */
  async triggerSync() {
    logger.info('Manually triggering download sync');
    await this.sync();
  }
}

// Singleton instance
export const downloadMonitor = new DownloadMonitor();
