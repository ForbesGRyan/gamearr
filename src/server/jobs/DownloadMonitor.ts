import { CronJob } from 'cron';
import { downloadService } from '../services/DownloadService';
import { logger } from '../utils/logger';
import { QBittorrentError, ErrorCode } from '../utils/errors';

/**
 * Download Monitor Job
 * Runs every 30 seconds to sync download status from qBittorrent
 */
export class DownloadMonitor {
  private job: CronJob | null = null;
  private isRunning = false;

  // Connection state tracking to avoid log spam
  private isConnected = true;
  private lastErrorTime: number = 0;
  private consecutiveFailures = 0;

  // Only log "still offline" warning every 5 minutes
  private static readonly OFFLINE_LOG_INTERVAL_MS = 5 * 60 * 1000;

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

      // Connection restored
      if (!this.isConnected) {
        logger.info('qBittorrent connection restored');
        this.isConnected = true;
        this.consecutiveFailures = 0;
      }
    } catch (error) {
      this.handleSyncError(error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Handle sync errors with smart logging to avoid spam
   */
  private handleSyncError(error: unknown) {
    this.consecutiveFailures++;
    const now = Date.now();

    // Check if this is a connection error
    const isConnectionError =
      error instanceof QBittorrentError &&
      (error.code === ErrorCode.QBITTORRENT_CONNECTION_FAILED ||
       error.code === ErrorCode.QBITTORRENT_NOT_CONFIGURED);

    if (isConnectionError) {
      if (this.isConnected) {
        // First failure - log the error
        logger.warn('qBittorrent is offline or unreachable. Downloads will not be monitored until connection is restored.');
        this.isConnected = false;
        this.lastErrorTime = now;
      } else if (now - this.lastErrorTime > DownloadMonitor.OFFLINE_LOG_INTERVAL_MS) {
        // Periodic reminder that it's still offline
        logger.debug(`qBittorrent still offline (${this.consecutiveFailures} consecutive failures)`);
        this.lastErrorTime = now;
      }
      // Otherwise, stay silent to avoid log spam
    } else {
      // Non-connection errors should always be logged
      logger.error('Download monitor sync failed:', error);
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
