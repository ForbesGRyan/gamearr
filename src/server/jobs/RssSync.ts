import { CronJob } from 'cron';
import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import { gameRepository } from '../repositories/GameRepository';
import { indexerService, type ScoredRelease } from '../services/IndexerService';
import { downloadService } from '../services/DownloadService';
import { settingsService } from '../services/SettingsService';
import { logger } from '../utils/logger';
import type { Game } from '../db/schema';
import type { ReleaseSearchResult } from '../integrations/prowlarr/types';

/**
 * RSS Sync Job
 * Runs every 15 minutes to fetch new releases from indexers and match against wanted games
 *
 * This is different from SearchScheduler:
 * - SearchScheduler: Actively searches for each wanted game by name
 * - RssSync: Passively pulls all new releases and matches against wanted games
 */
export class RssSync {
  private job: CronJob | null = null;
  private isRunning = false;
  private processedGuids: Set<string> = new Set();
  private readonly MAX_PROCESSED_GUIDS = 1000;

  /**
   * Start the RSS sync job
   */
  start() {
    if (this.job) {
      logger.warn('RSS sync is already running');
      return;
    }

    logger.info('Starting RSS sync (runs every 15 minutes)');

    // Run every 15 minutes
    this.job = new CronJob('*/15 * * * *', async () => {
      await this.sync();
    });

    this.job.start();
  }

  /**
   * Stop the RSS sync job
   */
  stop() {
    if (this.job) {
      logger.info('Stopping RSS sync');
      this.job.stop();
      this.job = null;
    }
  }

  /**
   * Main sync logic
   */
  private async sync() {
    if (this.isRunning) {
      logger.debug('RSS sync already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // Check if Prowlarr is configured
      if (!prowlarrClient.isConfigured()) {
        logger.debug('Prowlarr not configured, skipping RSS sync');
        return;
      }

      // Check if dry-run mode is enabled
      const isDryRun = await settingsService.getDryRun();

      logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Starting RSS sync...`);

      // Get all monitored games with 'wanted' status
      const monitoredGames = await gameRepository.findMonitored();
      const wantedGames = monitoredGames.filter((game) => game.status === 'wanted');

      if (wantedGames.length === 0) {
        logger.info('No wanted games, skipping RSS sync');
        return;
      }

      logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Found ${wantedGames.length} wanted games`);

      // Get configured categories for filtering
      const categories = await settingsService.getProwlarrCategories();

      // Fetch RSS releases from Prowlarr
      const releases = await prowlarrClient.getRssReleases({
        categories,
        limit: 100,
      });

      if (releases.length === 0) {
        logger.info('No new releases from RSS feed');
        return;
      }

      // Filter out already processed releases
      const newReleases = releases.filter((r) => !this.processedGuids.has(r.guid));

      logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Processing ${newReleases.length} new releases (${releases.length - newReleases.length} already seen)`);

      // Match releases against wanted games
      let matchCount = 0;
      let grabCount = 0;

      for (const release of newReleases) {
        // Mark as processed
        this.markAsProcessed(release.guid);

        // Try to match against each wanted game
        const match = this.findBestMatch(release, wantedGames);

        if (match) {
          matchCount++;

          const { game, scoredRelease } = match;

          // Check if it meets auto-grab criteria
          if (indexerService.shouldAutoGrab(scoredRelease)) {
            logger.info(
              `${isDryRun ? '[DRY-RUN] ' : ''}RSS match found: ${release.title} -> ${game.title} (score: ${scoredRelease.score})`
            );

            // Grab the release
            const result = await downloadService.grabRelease(game.id, scoredRelease);

            if (result.success) {
              grabCount++;
              logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Auto-grabbed: ${release.title}`);

              // Remove from wanted games to avoid duplicate grabs
              const gameIndex = wantedGames.findIndex((g) => g.id === game.id);
              if (gameIndex !== -1) {
                wantedGames.splice(gameIndex, 1);
              }
            }
          } else {
            logger.debug(
              `RSS match below auto-grab threshold: ${release.title} -> ${game.title} (score: ${scoredRelease.score})`
            );
          }
        }
      }

      logger.info(
        `${isDryRun ? '[DRY-RUN] ' : ''}RSS sync completed: ${matchCount} matches found, ${grabCount} ${isDryRun ? 'would be grabbed' : 'grabbed'}`
      );
    } catch (error) {
      logger.error('RSS sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Find the best matching game for a release
   */
  private findBestMatch(
    release: ReleaseSearchResult,
    wantedGames: Game[]
  ): { game: Game; scoredRelease: ScoredRelease } | null {
    let bestMatch: { game: Game; scoredRelease: ScoredRelease } | null = null;
    let bestScore = 0;

    for (const game of wantedGames) {
      const scoredRelease = this.scoreReleaseForGame(release, game);

      // Only consider matches with positive scores and high confidence
      if (scoredRelease.score > bestScore && scoredRelease.matchConfidence !== 'low') {
        bestScore = scoredRelease.score;
        bestMatch = { game, scoredRelease };
      }
    }

    return bestMatch;
  }

  /**
   * Score a release for a specific game
   * This replicates the logic from IndexerService.scoreRelease but works with raw releases
   */
  private scoreReleaseForGame(release: ReleaseSearchResult, game: Game): ScoredRelease {
    let score = 100; // Base score
    let matchConfidence: 'high' | 'medium' | 'low' = 'medium';

    const releaseTitleLower = release.title.toLowerCase();
    const gameTitleLower = game.title.toLowerCase();

    // Normalize game title for matching (remove special characters, handle common patterns)
    const normalizedGameTitle = this.normalizeTitle(gameTitleLower);
    const normalizedReleaseTitle = this.normalizeTitle(releaseTitleLower);

    // Title matching - check if game title is contained in release title
    if (normalizedReleaseTitle.includes(normalizedGameTitle)) {
      score += 50;
      matchConfidence = 'high';
    } else {
      // Check for partial word matches
      const gameWords = normalizedGameTitle.split(/\s+/).filter((w) => w.length > 2);
      const matchedWords = gameWords.filter((word) => normalizedReleaseTitle.includes(word));

      if (gameWords.length > 0 && matchedWords.length / gameWords.length >= 0.8) {
        score += 30;
        matchConfidence = 'high';
      } else if (gameWords.length > 0 && matchedWords.length / gameWords.length >= 0.5) {
        score += 15;
      } else {
        score -= 60;
        matchConfidence = 'low';
      }
    }

    // Year matching bonus
    if (game.year && releaseTitleLower.includes(game.year.toString())) {
      score += 20;
    }

    // Quality preferences
    const quality = this.extractQuality(release.title);
    if (quality === 'GOG') {
      score += 50;
    } else if (quality === 'DRM-Free') {
      score += 40;
    } else if (quality === 'Repack') {
      score += 20;
    } else if (quality === 'Scene') {
      score += 10;
    }

    // Seeders penalty/bonus
    if (release.seeders < 5) {
      score -= 30;
    } else if (release.seeders >= 20) {
      score += 10;
    }

    // Age penalty
    const ageInYears = (Date.now() - release.publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (ageInYears > 2) {
      score -= 20;
    }

    // Size check
    const sizeInGB = release.size / (1024 * 1024 * 1024);
    if (sizeInGB < 0.1 || sizeInGB > 200) {
      score -= 50;
    }

    // Adjust confidence based on final score
    if (score >= 150) {
      matchConfidence = 'high';
    } else if (score < 80) {
      matchConfidence = 'low';
    }

    return {
      ...release,
      quality,
      score,
      matchConfidence,
    };
  }

  /**
   * Normalize a title for matching
   */
  private normalizeTitle(title: string): string {
    return title
      .replace(/['']/g, '') // Remove apostrophes
      .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract quality from release title
   */
  private extractQuality(title: string): string | undefined {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('gog')) return 'GOG';
    if (titleLower.includes('drm free') || titleLower.includes('drm-free')) return 'DRM-Free';
    if (titleLower.includes('repack')) return 'Repack';
    if (titleLower.includes('scene')) return 'Scene';

    return undefined;
  }

  /**
   * Mark a release GUID as processed
   */
  private markAsProcessed(guid: string) {
    this.processedGuids.add(guid);

    // Clean up old entries to prevent memory growth
    if (this.processedGuids.size > this.MAX_PROCESSED_GUIDS) {
      const entries = Array.from(this.processedGuids);
      const toRemove = entries.slice(0, entries.length - this.MAX_PROCESSED_GUIDS);
      toRemove.forEach((g) => this.processedGuids.delete(g));
    }
  }

  /**
   * Manual sync trigger
   */
  async triggerSync() {
    logger.info('Manually triggering RSS sync');
    await this.sync();
  }

  /**
   * Clear processed GUIDs cache (useful for testing)
   */
  clearProcessedCache() {
    this.processedGuids.clear();
    logger.info('Cleared RSS processed cache');
  }
}

// Singleton instance
export const rssSync = new RssSync();
