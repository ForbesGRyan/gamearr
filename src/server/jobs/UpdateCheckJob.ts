import { updateService } from '../services/UpdateService';
import { settingsService } from '../services/SettingsService';
import { gameRepository } from '../repositories/GameRepository';
import { logger } from '../utils/logger';
import { jobRegistry } from './JobRegistry';
import { taskQueue } from '../queue/TaskQueue';

/**
 * Background job to check for game updates.
 * Runs periodically (configurable: daily/weekly) to check downloaded games for:
 * - Version updates
 * - DLC releases
 * - Better quality releases
 *
 * Uses a proper async lock to prevent race conditions between scheduled and manual checks.
 */
export class UpdateCheckJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private runningPromise: Promise<{ checked: number; updatesFound: number }> | null = null;
  private readonly lockTimeout = 30 * 60 * 1000; // 30 minute timeout for stuck locks

  /**
   * Start the update check job
   * Default: runs every 24 hours (can be configured via settings)
   */
  async start() {
    logger.info('Starting UpdateCheckJob...');

    // Check if update checking is enabled (stored as JSON string "true"/"false")
    const enabledSetting = await settingsService.getSetting('update_check_enabled');
    const isEnabled = enabledSetting === null || enabledSetting === 'true'; // Default to enabled if not set
    if (!isEnabled) {
      logger.info('Update checking is disabled in settings');
      return;
    }

    // Get schedule from settings (default: daily = 24 hours)
    const schedule = await settingsService.getSetting('update_check_schedule') || 'daily';
    const intervalMs = this.getIntervalMs(schedule);

    logger.info(`Update check schedule: ${schedule} (every ${intervalMs / 1000 / 60 / 60} hours)`);

    jobRegistry.register({
      name: 'game-update-check',
      schedule: `${schedule}`,
      kind: 'interval',
      intervalMs: intervalMs,
      runNow: () => this.runScheduledScan(),
    });

    // Run initial check after a short delay (don't slow down startup)
    setTimeout(() => {
      void jobRegistry.recordRun('game-update-check', () => this.runScheduledScan());
    }, 60 * 1000); // 1 minute after startup

    // Then run on schedule
    this.intervalId = setInterval(() => {
      void jobRegistry.recordRun('game-update-check', () => this.runScheduledScan());
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
   * Acquire the lock for update checking.
   * Returns the existing promise if a check is already running.
   * This ensures that concurrent calls don't start duplicate checks.
   */
  private async acquireLock(): Promise<{ acquired: boolean; existingPromise?: Promise<{ checked: number; updatesFound: number }> }> {
    if (this.isRunning && this.runningPromise) {
      logger.debug('UpdateCheckJob already running, returning existing promise');
      return { acquired: false, existingPromise: this.runningPromise };
    }
    this.isRunning = true;
    return { acquired: true };
  }

  /**
   * Release the lock after update checking completes
   */
  private releaseLock(): void {
    this.isRunning = false;
    this.runningPromise = null;
  }

  /**
   * Scheduled scan: enqueues one update.check-game task per eligible game.
   * Per-game work is done in the queue worker.
   */
  private async runScheduledScan(): Promise<void> {
    if (this.isRunning) {
      logger.debug('UpdateCheckJob scan already in progress, skipping');
      return;
    }
    this.isRunning = true;
    try {
      const enabledSetting = await settingsService.getSetting('update_check_enabled');
      const isEnabled = enabledSetting === null || enabledSetting === 'true';
      if (!isEnabled) {
        logger.debug('Update checking is disabled, skipping');
        return;
      }

      const downloadedGames = await gameRepository.findByStatus('downloaded');
      const eligible = downloadedGames.filter((g) => g.updatePolicy !== 'ignore');
      if (eligible.length === 0) {
        logger.debug('No eligible games for update check');
        return;
      }

      let enqueued = 0;
      for (const g of eligible) {
        const t = taskQueue.enqueue(
          'update.check-game',
          { gameId: g.id },
          { dedupKey: `game:${g.id}`, priority: 0 }
        );
        if (t.attempts === 0 && t.status === 'pending') enqueued++;
      }
      if (enqueued > 0) {
        logger.info(`UpdateCheckJob enqueued ${enqueued} update.check-game task(s) (${eligible.length} eligible)`);
      }
    } catch (error) {
      logger.error('UpdateCheckJob scan error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Inline check for all eligible games. Used by manual API trigger so the
   * caller can return a count to the user.
   */
  async checkForUpdates(): Promise<void> {
    const lock = await this.acquireLock();

    if (!lock.acquired) {
      logger.debug('UpdateCheckJob already running, skipping scheduled check');
      return;
    }

    // Re-check if enabled (setting might have changed, stored as JSON string "true"/"false")
    const enabledSetting = await settingsService.getSetting('update_check_enabled');
    const isEnabled = enabledSetting === null || enabledSetting === 'true';
    if (!isEnabled) {
      logger.debug('Update checking is disabled, skipping');
      this.releaseLock();
      return;
    }

    logger.info('Starting update check for all games...');

    // Create the promise and store it so concurrent callers can await it
    this.runningPromise = (async () => {
      try {
        const result = await updateService.checkAllGamesForUpdates();

        logger.info(
          `Update check complete: checked ${result.checked} games, found ${result.updatesFound} updates`
        );
        return result;
      } catch (error) {
        logger.error('UpdateCheckJob error:', error);
        return { checked: 0, updatesFound: 0 };
      }
    })();

    try {
      await this.runningPromise;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Manually trigger an update check (from API)
   * If a check is already running, returns the result of that check.
   */
  async triggerCheck(): Promise<{ checked: number; updatesFound: number }> {
    const lock = await this.acquireLock();

    if (!lock.acquired && lock.existingPromise) {
      logger.info('Manual trigger: joining existing update check');
      return lock.existingPromise;
    }

    logger.info('Manual update check triggered');

    // Create the promise and store it so concurrent callers can await it
    this.runningPromise = (async () => {
      try {
        const result = await updateService.checkAllGamesForUpdates();
        logger.info(
          `Manual update check complete: checked ${result.checked} games, found ${result.updatesFound} updates`
        );
        return result;
      } catch (error) {
        logger.error('Manual update check error:', error);
        throw error;
      }
    })();

    try {
      return await this.runningPromise;
    } finally {
      this.releaseLock();
    }
  }
}

// Singleton instance
export const updateCheckJob = new UpdateCheckJob();
