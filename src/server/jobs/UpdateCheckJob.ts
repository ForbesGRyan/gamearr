import { updateService } from '../services/UpdateService';
import { settingsService } from '../services/SettingsService';
import { logger } from '../utils/logger';

/**
 * Background job to check for game updates.
 * Runs periodically (configurable: daily/weekly) to check downloaded games for:
 * - Version updates
 * - DLC releases
 * - Better quality releases
 */
export class UpdateCheckJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Start the update check job
   * Default: runs every 24 hours (can be configured via settings)
   */
  async start() {
    logger.info('Starting UpdateCheckJob...');

    // Check if update checking is enabled
    const enabled = await settingsService.getSetting('update_check_enabled');
    if (enabled === false) {
      logger.info('Update checking is disabled in settings');
      return;
    }

    // Get schedule from settings (default: daily = 24 hours)
    const schedule = await settingsService.getSetting('update_check_schedule') || 'daily';
    const intervalMs = this.getIntervalMs(schedule);

    logger.info(`Update check schedule: ${schedule} (every ${intervalMs / 1000 / 60 / 60} hours)`);

    // Run initial check after a short delay (don't slow down startup)
    setTimeout(() => {
      this.checkForUpdates();
    }, 60 * 1000); // 1 minute after startup

    // Then run on schedule
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);
  }

  /**
   * Stop the job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('UpdateCheckJob stopped');
    }
  }

  /**
   * Get interval in milliseconds based on schedule setting
   */
  private getIntervalMs(schedule: string): number {
    switch (schedule) {
      case 'hourly':
        return 60 * 60 * 1000; // 1 hour (mainly for testing)
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  /**
   * Run update check for all eligible games
   */
  async checkForUpdates() {
    if (this.isRunning) {
      logger.debug('UpdateCheckJob already running, skipping');
      return;
    }

    // Re-check if enabled (setting might have changed)
    const enabled = await settingsService.getSetting('update_check_enabled');
    if (enabled === false) {
      logger.debug('Update checking is disabled, skipping');
      return;
    }

    this.isRunning = true;
    logger.info('Starting update check for all games...');

    try {
      const result = await updateService.checkAllGamesForUpdates();

      logger.info(
        `Update check complete: checked ${result.checked} games, found ${result.updatesFound} updates`
      );
    } catch (error) {
      logger.error('UpdateCheckJob error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger an update check (from API)
   */
  async triggerCheck(): Promise<{ checked: number; updatesFound: number }> {
    if (this.isRunning) {
      throw new Error('Update check already in progress');
    }

    this.isRunning = true;
    logger.info('Manual update check triggered');

    try {
      const result = await updateService.checkAllGamesForUpdates();
      logger.info(
        `Manual update check complete: checked ${result.checked} games, found ${result.updatesFound} updates`
      );
      return result;
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton instance
export const updateCheckJob = new UpdateCheckJob();
