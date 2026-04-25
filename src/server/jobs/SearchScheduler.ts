import { gameRepository } from '../repositories/GameRepository';
import { releaseRepository } from '../repositories/ReleaseRepository';
import { settingsService } from '../services/SettingsService';
import { logger } from '../utils/logger';
import { jobRegistry } from './JobRegistry';
import { taskQueue } from '../queue/TaskQueue';

/**
 * Search Scheduler Job
 * Runs at configurable intervals (default: 15 minutes) to search for wanted games and auto-grab best releases
 */
export class SearchScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentIntervalMinutes: number = 15;
  private isRunning = false;

  /**
   * Start the search scheduler
   */
  async start() {
    if (this.intervalId) {
      logger.warn('Search scheduler is already running');
      return;
    }

    // Get configured interval from settings
    this.currentIntervalMinutes = await settingsService.getSearchSchedulerInterval();

    logger.info(`Starting search scheduler (runs every ${this.currentIntervalMinutes} minutes)`);

    jobRegistry.register({
      name: 'search-scheduler',
      schedule: `every ${this.currentIntervalMinutes} minutes`,
      kind: 'interval',
      intervalMs: this.currentIntervalMinutes * 60 * 1000,
      runNow: () => this.run(),
    });

    // Run immediately on start, then at the configured interval
    jobRegistry
      .recordRun('search-scheduler', () => this.run())
      .catch((err) => logger.error('Initial search scheduler run failed:', err));

    this.intervalId = setInterval(async () => {
      // Check if interval has changed
      const newInterval = await settingsService.getSearchSchedulerInterval();
      if (newInterval !== this.currentIntervalMinutes) {
        logger.info(`Search scheduler interval changed from ${this.currentIntervalMinutes} to ${newInterval} minutes, restarting...`);
        this.stop();
        await this.start();
        return;
      }

      await jobRegistry.recordRun('search-scheduler', () => this.run());
    }, this.currentIntervalMinutes * 60 * 1000);
  }

  /**
   * Stop the search scheduler
   */
  stop() {
    if (this.intervalId) {
      logger.info('Stopping search scheduler');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Handle failed downloads by resetting games back to 'wanted' status
   * This allows the scheduler to search for alternative releases
   * Uses batch queries to avoid N+1 database queries
   */
  private async handleFailedDownloads() {
    try {
      const failedReleases = await releaseRepository.findByStatus('failed');

      if (failedReleases.length === 0) {
        return;
      }

      logger.info(`Found ${failedReleases.length} failed downloads, resetting to 'wanted' status...`);

      // Batch fetch all games for the failed releases (fixes N+1 query)
      const gameIds = [...new Set(failedReleases.map((r) => r.gameId))];
      const gamesMap = await gameRepository.findByIds(gameIds);

      // Collect games that need status update and releases to delete
      const gamesToReset: number[] = [];
      const releasesToDelete: number[] = [];

      for (const release of failedReleases) {
        const game = gamesMap.get(release.gameId);

        if (!game) {
          logger.warn(`Game not found for failed release ${release.id}, skipping`);
          releasesToDelete.push(release.id);
          continue;
        }

        // Only reset if the game is still being monitored
        if (game.monitored && game.status === 'downloading') {
          gamesToReset.push(game.id);
          logger.info(`Reset game ${game.title} to 'wanted' status after failed download`);
        }

        // Mark release for deletion
        releasesToDelete.push(release.id);
      }

      // Batch update game statuses
      if (gamesToReset.length > 0) {
        await gameRepository.batchUpdateStatus(gamesToReset, 'wanted');
      }

      // Batch delete failed releases
      if (releasesToDelete.length > 0) {
        await releaseRepository.batchDelete(releasesToDelete);
      }
    } catch (error) {
      logger.error('Failed to handle failed downloads:', error);
    }
  }

  /**
   * Run the search scheduler
   */
  private async run() {
    if (this.isRunning) {
      logger.debug('Search scheduler already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const isDryRun = await settingsService.getDryRun();
      logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Running automated search scan...`);
      if (isDryRun) {
        logger.info('[DRY-RUN] Dry-run mode is ENABLED - downloads will be logged but not triggered');
      }

      // First, handle retry logic for failed downloads (sweep, not per-unit).
      await this.handleFailedDownloads();

      const monitoredGames = await gameRepository.findMonitored();
      const wantedGames = monitoredGames.filter((game) => game.status === 'wanted');

      if (wantedGames.length === 0) {
        logger.info('No wanted games to search for');
        return;
      }

      let enqueued = 0;
      for (const game of wantedGames) {
        const t = taskQueue.enqueue(
          'search.game',
          { gameId: game.id },
          { dedupKey: `game:${game.id}`, priority: 0 }
        );
        if (t.attempts === 0 && t.status === 'pending') enqueued++;
      }
      if (enqueued > 0) {
        logger.info(`SearchScheduler enqueued ${enqueued} search.game task(s) (${wantedGames.length} wanted total)`);
      }
    } catch (error) {
      logger.error('Search scheduler scan failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for immediate search
   */
  async triggerSearch() {
    logger.info('Manually triggering search scheduler');
    await this.run();
  }
}

// Singleton instance
export const searchScheduler = new SearchScheduler();
