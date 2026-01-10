import { gameRepository, type PaginationParams, type PaginatedResult } from '../repositories/GameRepository';
import { gameUpdateRepository } from '../repositories/GameUpdateRepository';
import { indexerService, type ScoredRelease } from './IndexerService';
import { downloadService } from './DownloadService';
import type { Game, GameUpdate, NewGameUpdate } from '../db/schema';
import { logger } from '../utils/logger';
import { parseVersion, compareVersions } from '../utils/version';
import { NotFoundError, ValidationError } from '../utils/errors';

export class UpdateService {
  /**
   * Quality ranking order (higher index = better quality)
   */
  private static readonly QUALITY_RANKING = ['Scene', 'Repack', 'DRM-Free', 'GOG'];

  /**
   * Track in-progress game checks to prevent duplicate concurrent checks
   * Map of gameId -> Promise of check result
   */
  private readonly activeGameChecks = new Map<number, Promise<GameUpdate[]>>();

  /**
   * Check if a release title indicates DLC or additional content
   */
  isDLC(releaseTitle: string, gameTitle: string): boolean {
    const dlcPatterns = [
      /\bDLC\b/i,
      /\bExpansion\b/i,
      /\bSeason Pass\b/i,
      /\bDeluxe Edition\b/i,
      /\bComplete Edition\b/i,
      /\bGOTY\b/i,
      /\bGame of the Year\b/i,
      /\bUltimate Edition\b/i,
      /\bGold Edition\b/i,
      /\bPremium Edition\b/i,
      /\bCollector'?s Edition\b/i,
      /\bDefinitive Edition\b/i,
      /\bLegendary Edition\b/i,
    ];

    // Check for explicit DLC patterns
    for (const pattern of dlcPatterns) {
      if (pattern.test(releaseTitle)) {
        return true;
      }
    }

    // Check if title contains game title + extra content indicator
    const gameTitleLower = gameTitle.toLowerCase();
    const releaseTitleLower = releaseTitle.toLowerCase();

    if (releaseTitleLower.includes(gameTitleLower)) {
      // Check for content after the game title
      const afterGameTitle = releaseTitleLower
        .substring(releaseTitleLower.indexOf(gameTitleLower) + gameTitleLower.length)
        .trim();

      // If there's significant content after the game title, might be DLC
      if (afterGameTitle.length > 5) {
        const contentIndicators = [
          /^\s*[-:]\s*\w+/,  // "Game Title - Something" or "Game Title: Something"
          /^\s*\+/,          // "Game Title + DLC"
          /^\s*and\b/i,      // "Game Title and Something"
          /^\s*with\b/i,     // "Game Title with Something"
        ];

        for (const indicator of contentIndicators) {
          if (indicator.test(afterGameTitle)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if new quality is better than current quality
   * Quality order: GOG > DRM-Free > Repack > Scene > null
   */
  isBetterQuality(newQuality: string | null, currentQuality: string | null): boolean {
    if (!newQuality) return false;
    if (!currentQuality) return true;

    const newRank = UpdateService.QUALITY_RANKING.indexOf(newQuality);
    const currentRank = UpdateService.QUALITY_RANKING.indexOf(currentQuality);

    // If quality not in ranking, treat as lowest
    const effectiveNewRank = newRank === -1 ? -1 : newRank;
    const effectiveCurrentRank = currentRank === -1 ? -1 : currentRank;

    return effectiveNewRank > effectiveCurrentRank;
  }

  /**
   * Check a single game for available updates
   * Only checks games with status='downloaded'
   * Uses deduplication to prevent concurrent checks for the same game
   */
  async checkGameForUpdates(gameId: number): Promise<GameUpdate[]> {
    // Check if there's already an in-progress check for this game
    const existingCheck = this.activeGameChecks.get(gameId);
    if (existingCheck) {
      logger.debug(`Game ${gameId} check already in progress, waiting for result`);
      return existingCheck;
    }

    // Create the check promise and store it
    const checkPromise = this.performGameUpdateCheck(gameId);
    this.activeGameChecks.set(gameId, checkPromise);

    try {
      return await checkPromise;
    } finally {
      // Clean up after the check completes (success or failure)
      this.activeGameChecks.delete(gameId);
    }
  }

  /**
   * Internal method that performs the actual update check for a game
   */
  private async performGameUpdateCheck(gameId: number): Promise<GameUpdate[]> {
    const game = await gameRepository.findById(gameId);

    if (!game) {
      throw new NotFoundError('Game', gameId);
    }

    if (game.status !== 'downloaded') {
      logger.debug(`Skipping update check for game ${game.title}: status is ${game.status}`);
      return [];
    }

    logger.info(`Checking for updates: ${game.title}`);

    // Search for releases matching the game
    const releases = await indexerService.searchForGame(game);

    // Pre-fetch all existing updates for this game to avoid N+1 queries
    const existingUpdates = await gameUpdateRepository.findByGameId(gameId);

    // Build lookup sets for fast O(1) existence checks
    const existingDownloadUrls = new Set<string>(
      existingUpdates
        .filter((u) => u.downloadUrl)
        .map((u) => u.downloadUrl as string)
    );
    const existingTitles = new Set<string>(
      existingUpdates.map((u) => u.title)
    );

    // Collect all new updates to batch insert
    const updatesToCreate: NewGameUpdate[] = [];

    for (const release of releases) {
      // Check if this release is already tracked using pre-fetched data
      if (release.downloadUrl && existingDownloadUrls.has(release.downloadUrl)) {
        continue;
      }

      if (existingTitles.has(release.title)) {
        continue;
      }

      // Determine update type
      const updateType = this.determineUpdateType(release, game);

      if (!updateType) {
        continue; // Not a relevant update
      }

      // Create the update record
      const version = parseVersion(release.title);

      const newUpdate: NewGameUpdate = {
        gameId,
        updateType,
        title: release.title,
        version,
        size: release.size,
        quality: release.quality || null,
        seeders: release.seeders,
        downloadUrl: release.downloadUrl,
        indexer: release.indexer,
        status: 'pending',
      };

      updatesToCreate.push(newUpdate);

      // Add to lookup sets to prevent duplicates within the same batch
      if (release.downloadUrl) {
        existingDownloadUrls.add(release.downloadUrl);
      }
      existingTitles.add(release.title);

      logger.info(
        `Found ${updateType} update for ${game.title}: ${release.title}`
      );
    }

    // Batch insert all new updates in a single query
    const createdUpdates = await gameUpdateRepository.createMany(updatesToCreate);

    // Update game's update tracking fields
    if (createdUpdates.length > 0) {
      const latestVersionUpdate = createdUpdates.find(
        (u) => u.updateType === 'version' && u.version
      );

      await gameRepository.update(gameId, {
        updateAvailable: true,
        lastUpdateCheck: new Date(),
        ...(latestVersionUpdate?.version && {
          latestVersion: latestVersionUpdate.version,
        }),
      });

      logger.info(
        `Found ${createdUpdates.length} updates for ${game.title}`
      );
    } else {
      await gameRepository.update(gameId, {
        lastUpdateCheck: new Date(),
      });
    }

    return createdUpdates;
  }

  /**
   * Determine the update type for a release
   * Returns null if the release is not a relevant update
   */
  private determineUpdateType(
    release: ScoredRelease,
    game: Game
  ): 'version' | 'dlc' | 'better_release' | null {
    // Check if it's DLC
    if (this.isDLC(release.title, game.title)) {
      return 'dlc';
    }

    // Check for version update
    const releaseVersion = parseVersion(release.title);
    if (releaseVersion && game.installedVersion) {
      const comparison = compareVersions(
        releaseVersion,
        game.installedVersion
      );
      if (comparison > 0) {
        return 'version';
      }
    } else if (releaseVersion && !game.installedVersion) {
      // If game has no installed version but release has one, consider it an update
      return 'version';
    }

    // Check for better quality release
    if (this.isBetterQuality(release.quality || null, game.installedQuality)) {
      return 'better_release';
    }

    // Not a relevant update
    return null;
  }

  /**
   * Check all downloaded games for updates
   * Respects updatePolicy setting on each game
   */
  async checkAllGamesForUpdates(): Promise<{ checked: number; updatesFound: number }> {
    logger.info('Starting update check for all downloaded games');

    const downloadedGames = await gameRepository.findByStatus('downloaded');

    // Filter out games with updatePolicy='ignore'
    const gamesToCheck = downloadedGames.filter(
      (game) => game.updatePolicy !== 'ignore'
    );

    let checked = 0;
    let updatesFound = 0;

    for (const game of gamesToCheck) {
      const updates = await this.checkGameForUpdates(game.id);
      checked++;
      updatesFound += updates.length;

      // Add a small delay between checks to avoid overwhelming the indexer
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info(
      `Update check complete: checked ${checked} games, found ${updatesFound} updates`
    );

    return { checked, updatesFound };
  }

  /**
   * Get pending updates, optionally filtered by game
   */
  async getPendingUpdates(gameId?: number): Promise<GameUpdate[]> {
    if (gameId) {
      return gameUpdateRepository.findPendingByGameId(gameId);
    }
    return gameUpdateRepository.findPending();
  }

  /**
   * Get all updates for a specific game
   */
  async getGameUpdates(gameId: number): Promise<GameUpdate[]> {
    return gameUpdateRepository.findByGameId(gameId);
  }

  /**
   * Get pending updates with pagination
   */
  async getPendingUpdatesPaginated(params: PaginationParams = {}): Promise<PaginatedResult<GameUpdate>> {
    return gameUpdateRepository.findPendingPaginated(params);
  }

  /**
   * Dismiss an update (mark as dismissed)
   */
  async dismissUpdate(updateId: number): Promise<void> {
    const update = await gameUpdateRepository.findById(updateId);

    if (!update) {
      throw new NotFoundError('Update', updateId);
    }

    await gameUpdateRepository.updateStatus(updateId, 'dismissed');
    logger.info(`Dismissed update: ${update.title}`);

    // Check if there are any remaining pending updates for this game
    const remainingUpdates = await gameUpdateRepository.findPendingByGameId(
      update.gameId
    );

    if (remainingUpdates.length === 0) {
      // No more pending updates, clear the flag
      await gameRepository.update(update.gameId, { updateAvailable: false });
    }
  }

  /**
   * Grab an update (trigger download)
   */
  async grabUpdate(updateId: number): Promise<void> {
    const update = await gameUpdateRepository.findById(updateId);

    if (!update) {
      throw new NotFoundError('Update', updateId);
    }

    if (!update.downloadUrl) {
      throw new ValidationError('Update has no download URL');
    }

    logger.info(`Grabbing update: ${update.title}`);

    // Create a ScoredRelease-like object for the download service
    const release: ScoredRelease = {
      guid: `update-${update.id}`,
      title: update.title,
      size: update.size || 0,
      seeders: update.seeders || 0,
      downloadUrl: update.downloadUrl,
      indexer: update.indexer || 'Unknown',
      quality: update.quality || undefined,
      publishedAt: new Date(update.detectedAt),
      score: 100,
      matchConfidence: 'high',
    };

    // This will throw on failure
    await downloadService.grabRelease(update.gameId, release);

    await gameUpdateRepository.updateStatus(updateId, 'grabbed');

    // Update installed version/quality if this is a version or better_release update
    if (update.updateType === 'version' && update.version) {
      await gameRepository.update(update.gameId, {
        installedVersion: update.version,
      });
    }

    if (update.updateType === 'better_release' && update.quality) {
      await gameRepository.update(update.gameId, {
        installedQuality: update.quality,
      });
    }

    // Check if there are any remaining pending updates
    const remainingUpdates = await gameUpdateRepository.findPendingByGameId(
      update.gameId
    );

    if (remainingUpdates.length === 0) {
      await gameRepository.update(update.gameId, { updateAvailable: false });
    }

    logger.info(`Successfully grabbed update: ${update.title}`);
  }
}

// Singleton instance
export const updateService = new UpdateService();
