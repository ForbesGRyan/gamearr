import { CronJob } from 'cron';
import { downloadService } from '../services/DownloadService';
import { logger } from '../utils/logger';
import { QBittorrentError, SabnzbdError, ErrorCode } from '../utils/errors';

interface ClientState {
  connected: boolean;
  lastErrorTime: number;
  consecutiveFailures: number;
}

/**
 * Download Monitor Job
 * Runs every 30 seconds to sync download status from qBittorrent and SABnzbd
 */
export class DownloadMonitor {
  private job: CronJob | null = null;
  private isRunning = false;

  // Connection state tracking per client to avoid log spam
  private clientState: Record<'qbittorrent' | 'sabnzbd', ClientState> = {
    qbittorrent: { connected: true, lastErrorTime: 0, consecutiveFailures: 0 },
    sabnzbd: { connected: true, lastErrorTime: 0, consecutiveFailures: 0 },
  };

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
   * Sync download status from both clients independently
   */
  private async sync() {
    if (this.isRunning) {
      logger.debug('Download sync already in progress, skipping');
      return;
    }

    this.isRunning = true;
    try {
      // Sync both clients concurrently — they are independent
      const results = await Promise.allSettled([
        downloadService.syncDownloadStatus(),
        downloadService.syncUsenetDownloadStatus(),
      ]);

      // Handle qBittorrent result
      if (results[0].status === 'fulfilled') {
        this.handleClientSuccess('qbittorrent');
      } else {
        this.handleClientError('qbittorrent', results[0].reason, QBittorrentError, [
          ErrorCode.QBITTORRENT_CONNECTION_FAILED,
          ErrorCode.QBITTORRENT_NOT_CONFIGURED,
        ]);
      }

      // Handle SABnzbd result
      if (results[1].status === 'fulfilled') {
        this.handleClientSuccess('sabnzbd');
      } else {
        this.handleClientError('sabnzbd', results[1].reason, SabnzbdError, [
          ErrorCode.SABNZBD_CONNECTION_FAILED,
          ErrorCode.SABNZBD_NOT_CONFIGURED,
        ]);
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Handle successful sync for a client
   */
  private handleClientSuccess(client: 'qbittorrent' | 'sabnzbd') {
    const state = this.clientState[client];
    if (!state.connected) {
      const label = client === 'qbittorrent' ? 'qBittorrent' : 'SABnzbd';
      logger.info(`${label} connection restored`);
      state.connected = true;
      state.consecutiveFailures = 0;
    }
  }

  /**
   * Handle sync errors for a client
   */
  private handleClientError(
    client: 'qbittorrent' | 'sabnzbd',
    error: unknown,
    errorClass: typeof QBittorrentError | typeof SabnzbdError,
    connectionErrorCodes: ErrorCode[]
  ) {
    const state = this.clientState[client];
    state.consecutiveFailures++;
    const now = Date.now();
    const label = client === 'qbittorrent' ? 'qBittorrent' : 'SABnzbd';
    const syncType = client === 'qbittorrent' ? 'torrent' : 'usenet';

    const isConnectionError =
      error instanceof errorClass &&
      connectionErrorCodes.includes(error.code);

    if (isConnectionError) {
      if (state.connected) {
        logger.warn(`${label} is offline or unreachable. ${syncType === 'torrent' ? 'Torrent' : 'Usenet'} downloads will not be monitored until connection is restored.`);
        state.connected = false;
        state.lastErrorTime = now;
      } else if (now - state.lastErrorTime > DownloadMonitor.OFFLINE_LOG_INTERVAL_MS) {
        logger.debug(`${label} still offline (${state.consecutiveFailures} consecutive failures)`);
        state.lastErrorTime = now;
      }
    } else {
      logger.error(`Download monitor ${syncType} sync failed:`, error);
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
