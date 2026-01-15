import { applicationUpdateService, APP_UPDATE_SETTINGS } from '../services/ApplicationUpdateService';
import { settingsService } from '../services/SettingsService';
import { logger } from '../utils/logger';

/**
 * Background job to check for Gamearr application updates.
 * Runs periodically (configurable: daily/weekly/monthly) to check for new releases.
 */
export class ApplicationUpdateCheckJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Start the application update check job
   */
  async start(): Promise<void> {
    logger.info('Starting ApplicationUpdateCheckJob...');

    // Check if update checking is enabled
    const isEnabled = await applicationUpdateService.isEnabled();
    if (!isEnabled) {
      logger.info('Application update checking is disabled in settings');
      return;
    }

    // Get schedule from settings
    const schedule = await applicationUpdateService.getSchedule();
    const intervalMs = this.getIntervalMs(schedule);

    logger.info(`Application update check schedule: ${schedule} (every ${Math.round(intervalMs / 1000 / 60 / 60)} hours)`);

    // Run initial check after a delay (don't slow down startup)
    setTimeout(() => {
      this.checkForUpdates();
    }, 2 * 60 * 1000); // 2 minutes after startup

    // Then run on schedule
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('ApplicationUpdateCheckJob stopped');
    }
  }

  /**
   * Restart the job with new settings
   */
  async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  /**
   * Get interval in milliseconds based on schedule setting
   */
  private getIntervalMs(schedule: string): number {
    switch (schedule) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  /**
   * Run the update check
   */
  async checkForUpdates(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Application update check already running, skipping');
      return;
    }

    // Re-check if enabled (setting might have changed)
    const isEnabled = await applicationUpdateService.isEnabled();
    if (!isEnabled) {
      logger.debug('Application update checking is disabled, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const status = await applicationUpdateService.checkForUpdates();

      if (status.updateAvailable && !status.isDismissed) {
        logger.info(
          `New Gamearr version available: ${status.currentVersion} -> ${status.latestVersion}`
        );
      }
    } catch (error) {
      logger.error('ApplicationUpdateCheckJob error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger an update check (from API)
   */
  async triggerCheck(): Promise<{
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
  }> {
    logger.info('Manual application update check triggered');

    try {
      const status = await applicationUpdateService.checkForUpdates();
      return {
        currentVersion: status.currentVersion,
        latestVersion: status.latestVersion,
        updateAvailable: status.updateAvailable,
      };
    } catch (error) {
      logger.error('Manual application update check error:', error);
      throw error;
    }
  }
}

// Singleton instance
export const applicationUpdateCheckJob = new ApplicationUpdateCheckJob();
