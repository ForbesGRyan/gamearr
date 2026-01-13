import { cacheService } from '../services/CacheService';
import { settingsService } from '../services/SettingsService';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import { logger } from '../utils/logger';

/**
 * Discover Cache Job
 * Periodically refreshes cached trending games and top torrents data
 */
export class DiscoverCacheJob {
  private trendingIntervalId: ReturnType<typeof setInterval> | null = null;
  private torrentsIntervalId: ReturnType<typeof setInterval> | null = null;
  private isRefreshingTrending = false;
  private isRefreshingTorrents = false;
  private currentTrendingInterval = 15;
  private currentTorrentsInterval = 5;

  /**
   * Start the discover cache job
   */
  async start() {
    if (this.trendingIntervalId || this.torrentsIntervalId) {
      logger.warn('Discover cache job is already running');
      return;
    }

    // Get configured intervals
    this.currentTrendingInterval = await settingsService.getTrendingGamesCacheInterval();
    this.currentTorrentsInterval = await settingsService.getTopTorrentsCacheInterval();

    logger.info(`Starting discover cache job (trending: ${this.currentTrendingInterval}m, torrents: ${this.currentTorrentsInterval}m)`);

    // Initial refresh with delay to let other services initialize
    setTimeout(() => {
      this.refreshTrendingGames().catch(err => logger.error('Initial trending games refresh failed:', err));
      this.refreshTopTorrents().catch(err => logger.error('Initial top torrents refresh failed:', err));
    }, 5000);

    // Set up trending games interval
    this.trendingIntervalId = setInterval(async () => {
      // Check if interval changed
      const newInterval = await settingsService.getTrendingGamesCacheInterval();
      if (newInterval !== this.currentTrendingInterval) {
        logger.info(`Trending games interval changed from ${this.currentTrendingInterval} to ${newInterval} minutes`);
        this.currentTrendingInterval = newInterval;
        this.restartTrendingInterval();
        return;
      }
      await this.refreshTrendingGames();
    }, this.currentTrendingInterval * 60 * 1000);

    // Set up top torrents interval
    this.torrentsIntervalId = setInterval(async () => {
      // Check if interval changed
      const newInterval = await settingsService.getTopTorrentsCacheInterval();
      if (newInterval !== this.currentTorrentsInterval) {
        logger.info(`Top torrents interval changed from ${this.currentTorrentsInterval} to ${newInterval} minutes`);
        this.currentTorrentsInterval = newInterval;
        this.restartTorrentsInterval();
        return;
      }
      await this.refreshTopTorrents();
    }, this.currentTorrentsInterval * 60 * 1000);
  }

  /**
   * Stop the discover cache job
   */
  stop() {
    if (this.trendingIntervalId) {
      clearInterval(this.trendingIntervalId);
      this.trendingIntervalId = null;
    }
    if (this.torrentsIntervalId) {
      clearInterval(this.torrentsIntervalId);
      this.torrentsIntervalId = null;
    }
    logger.info('Stopped discover cache job');
  }

  /**
   * Restart trending games interval (when settings change)
   */
  private restartTrendingInterval() {
    if (this.trendingIntervalId) {
      clearInterval(this.trendingIntervalId);
    }
    this.trendingIntervalId = setInterval(async () => {
      const newInterval = await settingsService.getTrendingGamesCacheInterval();
      if (newInterval !== this.currentTrendingInterval) {
        this.currentTrendingInterval = newInterval;
        this.restartTrendingInterval();
        return;
      }
      await this.refreshTrendingGames();
    }, this.currentTrendingInterval * 60 * 1000);
  }

  /**
   * Restart torrents interval (when settings change)
   */
  private restartTorrentsInterval() {
    if (this.torrentsIntervalId) {
      clearInterval(this.torrentsIntervalId);
    }
    this.torrentsIntervalId = setInterval(async () => {
      const newInterval = await settingsService.getTopTorrentsCacheInterval();
      if (newInterval !== this.currentTorrentsInterval) {
        this.currentTorrentsInterval = newInterval;
        this.restartTorrentsInterval();
        return;
      }
      await this.refreshTopTorrents();
    }, this.currentTorrentsInterval * 60 * 1000);
  }

  /**
   * Refresh trending games for all configured popularity types
   */
  private async refreshTrendingGames() {
    if (this.isRefreshingTrending) {
      logger.debug('Trending games refresh already in progress, skipping');
      return;
    }

    if (!igdbClient.isConfigured()) {
      logger.debug('IGDB not configured, skipping trending games refresh');
      return;
    }

    this.isRefreshingTrending = true;

    try {
      // First refresh popularity types
      await cacheService.refreshPopularityTypes();

      // Refresh each configured popularity type
      const typesToCache = cacheService.getPopularityTypesToCache();
      for (const typeId of typesToCache) {
        try {
          await cacheService.refreshTrendingGames(typeId, 50);
          // Small delay between API calls to be respectful
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Failed to refresh trending games type ${typeId}:`, error);
          // Continue with other types
        }
      }

      logger.info(`Trending games cache refreshed for ${typesToCache.length} popularity types`);
    } catch (error) {
      logger.error('Trending games refresh failed:', error);
    } finally {
      this.isRefreshingTrending = false;
    }
  }

  /**
   * Refresh top torrents cache
   */
  private async refreshTopTorrents() {
    if (this.isRefreshingTorrents) {
      logger.debug('Top torrents refresh already in progress, skipping');
      return;
    }

    if (!prowlarrClient.isConfigured()) {
      logger.debug('Prowlarr not configured, skipping top torrents refresh');
      return;
    }

    this.isRefreshingTorrents = true;

    try {
      await cacheService.refreshTopTorrents();
      logger.info('Top torrents cache refreshed');
    } catch (error) {
      logger.error('Top torrents refresh failed:', error);
    } finally {
      this.isRefreshingTorrents = false;
    }
  }

  /**
   * Manual trigger for trending games refresh
   */
  async triggerTrendingRefresh() {
    logger.info('Manually triggering trending games refresh');
    await this.refreshTrendingGames();
  }

  /**
   * Manual trigger for top torrents refresh
   */
  async triggerTorrentsRefresh() {
    logger.info('Manually triggering top torrents refresh');
    await this.refreshTopTorrents();
  }
}

// Singleton instance
export const discoverCacheJob = new DiscoverCacheJob();
