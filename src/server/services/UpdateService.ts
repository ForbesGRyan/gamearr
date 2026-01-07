import { gameRepository } from '../repositories/GameRepository';
import { gameUpdateRepository } from '../repositories/GameUpdateRepository';
import { indexerService, type ScoredRelease } from './IndexerService';
import { downloadService } from './DownloadService';
import type { Game, GameUpdate, NewGameUpdate } from '../db/schema';
import { logger } from '../utils/logger';

export class UpdateService {
  /**
   * Quality ranking order (higher index = better quality)
   */
  private static readonly QUALITY_RANKING = ['Scene', 'Repack', 'DRM-Free', 'GOG'];

  /**
   * Parse version from release title
   * Returns null if no version pattern is found
   */
  parseVersion(releaseTitle: string): string | null {
    const patterns = [
      /v(\d+(?:\.\d+)*)/i,           // v1.2.3 or v1.2
      /version[.\s]?(\d+(?:\.\d+)*)/i, // version 1.2.3 or version.1.2
      /(\d+\.\d+\.\d+)/,              // 1.2.3 (semantic versioning)
      /build[.\s]?(\d+)/i,           // build 123 or build.123
      /update[.\s]?(\d+)/i,          // update 5 or update.5
    ];

    for (const pattern of patterns) {
      const match = releaseTitle.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Compare two version strings
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
    const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);

    // Pad shorter array with zeros
    const maxLength = Math.max(partsA.length, partsB.length);
    while (partsA.length < maxLength) partsA.push(0);
    while (partsB.length < maxLength) partsB.push(0);

    for (let i = 0; i < maxLength; i++) {
      if (partsA[i] < partsB[i]) return -1;
      if (partsA[i] > partsB[i]) return 1;
    }

    return 0;
  }

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
   */
  async checkGameForUpdates(gameId: number): Promise<GameUpdate[]> {
    const game = await gameRepository.findById(gameId);

    if (!game) {
      logger.warn(`Game not found for update check: ${gameId}`);
      return [];
    }

    if (game.status !== 'downloaded') {
      logger.debug(`Skipping update check for game ${game.title}: status is ${game.status}`);
      return [];
    }

    logger.info(`Checking for updates: ${game.title}`);

    try {
      // Search for releases matching the game
      const releases = await indexerService.searchForGame(game);

      const createdUpdates: GameUpdate[] = [];

      for (const release of releases) {
        // Check if this release is already tracked
        const existingByUrl = release.downloadUrl
          ? await gameUpdateRepository.findByDownloadUrl(release.downloadUrl)
          : null;

        if (existingByUrl) {
          continue;
        }

        const existingByTitle = await gameUpdateRepository.findByTitleAndGameId(
          release.title,
          gameId
        );

        if (existingByTitle) {
          continue;
        }

        // Determine update type
        const updateType = this.determineUpdateType(release, game);

        if (!updateType) {
          continue; // Not a relevant update
        }

        // Create the update record
        const version = this.parseVersion(release.title);

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

        const created = await gameUpdateRepository.create(newUpdate);
        createdUpdates.push(created);

        logger.info(
          `Found ${updateType} update for ${game.title}: ${release.title}`
        );
      }

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
    } catch (error) {
      logger.error(`Failed to check updates for ${game.title}:`, error);
      return [];
    }
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
    const releaseVersion = this.parseVersion(release.title);
    if (releaseVersion && game.installedVersion) {
      const comparison = this.compareVersions(
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
   * Dismiss an update (mark as dismissed)
   */
  async dismissUpdate(updateId: number): Promise<void> {
    const update = await gameUpdateRepository.findById(updateId);

    if (!update) {
      throw new Error('Update not found');
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
      throw new Error('Update not found');
    }

    if (!update.downloadUrl) {
      throw new Error('Update has no download URL');
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

    const result = await downloadService.grabRelease(update.gameId, release);

    if (result.success) {
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
    } else {
      throw new Error(result.message || 'Failed to grab update');
    }
  }
}

// Singleton instance
export const updateService = new UpdateService();
