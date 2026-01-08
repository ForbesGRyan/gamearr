import { CronJob } from 'cron';
import { gameRepository } from '../repositories/GameRepository';
import { releaseRepository } from '../repositories/ReleaseRepository';
import { indexerService } from '../services/IndexerService';
import { downloadService } from '../services/DownloadService';
import { settingsService } from '../services/SettingsService';
import { logger } from '../utils/logger';
import type { Game } from '../db/schema';

/**
 * Search Scheduler Job
 * Runs every 15 minutes to search for wanted games and auto-grab best releases
 */
export class SearchScheduler {
  private job: CronJob | null = null;
  private isRunning = false;

  /**
   * Start the search scheduler
   */
  start() {
    if (this.job) {
      logger.warn('Search scheduler is already running');
      return;
    }

    logger.info('Starting search scheduler (runs every 15 minutes)');

    // Run every 15 minutes
    this.job = new CronJob('*/15 * * * *', async () => {
      await this.run();
    });

    this.job.start();
  }

  /**
   * Stop the search scheduler
   */
  stop() {
    if (this.job) {
      logger.info('Stopping search scheduler');
      this.job.stop();
      this.job = null;
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
      // Check if dry-run mode is enabled
      const isDryRun = await settingsService.getDryRun();

      logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Running automated search for wanted games...`);

      if (isDryRun) {
        logger.info('[DRY-RUN] Dry-run mode is ENABLED - downloads will be logged but not triggered');
      }

      // First, handle retry logic for failed downloads
      await this.handleFailedDownloads();

      // Get all monitored games with 'wanted' status
      const monitoredGames = await gameRepository.findMonitored();
      const wantedGames = monitoredGames.filter((game) => game.status === 'wanted');

      if (wantedGames.length === 0) {
        logger.info('No wanted games to search for');
        return;
      }

      logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Found ${wantedGames.length} wanted games, searching for releases...`);

      // Process each wanted game
      let successCount = 0;
      let failureCount = 0;

      for (const game of wantedGames) {
        try {
          const grabbed = await this.searchAndGrabGame(game);
          if (grabbed) {
            successCount++;
          }
        } catch (error) {
          logger.error(`Failed to process game ${game.title}:`, error);
          failureCount++;
        }

        // Small delay between searches to avoid hammering APIs
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      logger.info(
        `${isDryRun ? '[DRY-RUN] ' : ''}Search scheduler completed: ${successCount} ${isDryRun ? 'would be grabbed' : 'grabbed'}, ${failureCount} failed`
      );
    } catch (error) {
      logger.error('Search scheduler failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Search for releases for a game and auto-grab the best one
   */
  private async searchAndGrabGame(game: Game): Promise<boolean> {
    try {
      logger.info(`Searching for: ${game.title} (${game.year})`);

      // Search for releases
      const releases = await indexerService.searchForGame(game);

      if (releases.length === 0) {
        logger.info(`No releases found for ${game.title}`);
        return false;
      }

      // Find the best release that meets auto-grab criteria
      const bestRelease = releases.find((release) =>
        indexerService.shouldAutoGrab(release)
      );

      if (!bestRelease) {
        logger.info(
          `No releases meet auto-grab criteria for ${game.title} (best score: ${releases[0]?.score || 0})`
        );
        return false;
      }

      logger.info(
        `Auto-grabbing release for ${game.title}: ${bestRelease.title} (score: ${bestRelease.score})`
      );

      // Grab the release (throws on failure)
      await downloadService.grabRelease(game.id, bestRelease);
      logger.info(`Successfully grabbed ${bestRelease.title} for ${game.title}`);
      return true;
    } catch (error) {
      logger.error(`Error searching/grabbing ${game.title}:`, error);
      return false;
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
