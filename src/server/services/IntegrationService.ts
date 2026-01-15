/**
 * Integration Service
 * Manages HLTB and ProtonDB data syncing for games
 */

import { gameRepository } from '../repositories/GameRepository';
import { gameStoreRepository } from '../repositories/GameStoreRepository';
import { hltbClient, HLTBGameData, HLTBClient } from '../integrations/hltb/HLTBClient';
import { protonDBClient, ProtonDBGameData, ProtonDBClient, ProtonDBTier, TIER_CONFIG } from '../integrations/protondb/ProtonDBClient';
import type { Game } from '../db/schema';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

// Hours to minutes for storage
const hoursToMinutes = (hours: number | null): number | null => {
  return hours !== null ? Math.round(hours * 60) : null;
};

// Minutes to hours for display
const minutesToHours = (minutes: number | null): number | null => {
  return minutes !== null ? minutes / 60 : null;
};

export interface HLTBDisplayData {
  hltbId: string | null;
  main: number | null; // Hours
  mainExtra: number | null; // Hours
  completionist: number | null; // Hours
  mainFormatted: string;
  mainExtraFormatted: string;
  completionistFormatted: string;
  lastSync: Date | null;
}

export interface ProtonDBDisplayData {
  tier: ProtonDBTier | null;
  tierLabel: string;
  tierColor: string;
  tierDescription: string;
  score: number | null;
  isPlayable: boolean;
  lastSync: Date | null;
}

export interface GameIntegrationData {
  hltb: HLTBDisplayData;
  protonDb: ProtonDBDisplayData;
}

export class IntegrationService {
  /**
   * Get HLTB display data for a game
   */
  getHLTBDisplayData(game: Game): HLTBDisplayData {
    const main = minutesToHours(game.hltbMain);
    const mainExtra = minutesToHours(game.hltbMainExtra);
    const completionist = minutesToHours(game.hltbCompletionist);

    return {
      hltbId: game.hltbId,
      main,
      mainExtra,
      completionist,
      mainFormatted: HLTBClient.formatPlaytime(main),
      mainExtraFormatted: HLTBClient.formatPlaytime(mainExtra),
      completionistFormatted: HLTBClient.formatPlaytime(completionist),
      lastSync: game.hltbLastSync,
    };
  }

  /**
   * Get ProtonDB display data for a game
   */
  getProtonDBDisplayData(game: Game): ProtonDBDisplayData {
    const tier = (game.protonDbTier as ProtonDBTier) || null;
    const tierInfo = tier ? TIER_CONFIG[tier] : TIER_CONFIG.pending;

    return {
      tier,
      tierLabel: tierInfo.label,
      tierColor: tierInfo.color,
      tierDescription: tierInfo.description,
      score: game.protonDbScore,
      isPlayable: tier ? ProtonDBClient.isPlayable(tier) : false,
      lastSync: game.protonDbLastSync,
    };
  }

  /**
   * Get all integration data for a game
   */
  getIntegrationData(game: Game): GameIntegrationData {
    return {
      hltb: this.getHLTBDisplayData(game),
      protonDb: this.getProtonDBDisplayData(game),
    };
  }

  /**
   * Sync HLTB data for a game
   * Searches HLTB by title and updates the database
   */
  async syncHLTB(gameId: number): Promise<HLTBDisplayData> {
    const game = await gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game', gameId);
    }

    logger.info(`Syncing HLTB data for: ${game.title}`);

    let hltbData: HLTBGameData | null = null;

    // If we have a stored HLTB ID, fetch by ID first
    if (game.hltbId) {
      hltbData = await hltbClient.getDetail(game.hltbId);
    }

    // If no ID or fetch failed, search by title
    if (!hltbData) {
      hltbData = await hltbClient.findBestMatch(game.title);
    }

    // Update database
    const updates: Partial<Game> = {
      hltbLastSync: new Date(),
    };

    if (hltbData) {
      updates.hltbId = hltbData.hltbId;
      updates.hltbMain = hoursToMinutes(hltbData.gameplayMain);
      updates.hltbMainExtra = hoursToMinutes(hltbData.gameplayMainExtra);
      updates.hltbCompletionist = hoursToMinutes(hltbData.gameplayCompletionist);
      logger.info(`Found HLTB match for ${game.title}: ${hltbData.name} (Main: ${hltbData.gameplayMain}h)`);
    } else {
      logger.info(`No HLTB match found for: ${game.title}`);
    }

    const updatedGame = await gameRepository.update(gameId, updates);
    if (!updatedGame) {
      throw new NotFoundError('Game', gameId);
    }

    return this.getHLTBDisplayData(updatedGame);
  }

  /**
   * Sync ProtonDB data for a game
   * Requires Steam app ID (from gameStores)
   */
  async syncProtonDB(gameId: number): Promise<ProtonDBDisplayData> {
    const game = await gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game', gameId);
    }

    logger.info(`Syncing ProtonDB data for: ${game.title}`);

    // Get Steam app ID from game stores
    const stores = await gameStoreRepository.getStoreInfoForGame(gameId);
    const steamStore = stores.find(s => s.slug === 'steam');

    const updates: Partial<Game> = {
      protonDbLastSync: new Date(),
    };

    if (!steamStore?.storeGameId) {
      logger.info(`No Steam ID found for ${game.title}, skipping ProtonDB sync`);
      // Still update lastSync to avoid repeated attempts
      const updatedGame = await gameRepository.update(gameId, updates);
      return this.getProtonDBDisplayData(updatedGame || game);
    }

    const steamAppId = parseInt(steamStore.storeGameId);
    if (isNaN(steamAppId)) {
      logger.warn(`Invalid Steam app ID for ${game.title}: ${steamStore.storeGameId}`);
      const updatedGame = await gameRepository.update(gameId, updates);
      return this.getProtonDBDisplayData(updatedGame || game);
    }

    const protonData = await protonDBClient.getSummary(steamAppId);

    if (protonData) {
      updates.protonDbTier = protonData.tier;
      updates.protonDbScore = Math.round(protonData.score);
      logger.info(`Found ProtonDB data for ${game.title}: ${protonData.tier} (score: ${protonData.score})`);
    } else {
      logger.info(`No ProtonDB data found for: ${game.title}`);
    }

    const updatedGame = await gameRepository.update(gameId, updates);
    if (!updatedGame) {
      throw new NotFoundError('Game', gameId);
    }

    return this.getProtonDBDisplayData(updatedGame);
  }

  /**
   * Sync both HLTB and ProtonDB data for a game
   */
  async syncAll(gameId: number): Promise<GameIntegrationData> {
    const [hltb, protonDb] = await Promise.all([
      this.syncHLTB(gameId),
      this.syncProtonDB(gameId),
    ]);

    return { hltb, protonDb };
  }

  /**
   * Batch sync HLTB data for multiple games
   * Returns count of successful syncs
   */
  async batchSyncHLTB(gameIds: number[]): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    for (const gameId of gameIds) {
      try {
        await this.syncHLTB(gameId);
        synced++;
      } catch (error) {
        logger.error(`Failed to sync HLTB for game ${gameId}:`, error);
        failed++;
      }
      // Small delay to be respectful of HLTB
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { synced, failed };
  }

  /**
   * Batch sync ProtonDB data for multiple games
   * Only syncs games that have Steam app IDs
   */
  async batchSyncProtonDB(gameIds: number[]): Promise<{ synced: number; skipped: number; failed: number }> {
    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const gameId of gameIds) {
      try {
        const game = await gameRepository.findById(gameId);
        if (!game) {
          skipped++;
          continue;
        }

        const stores = await gameStoreRepository.getStoreInfoForGame(gameId);
        const steamStore = stores.find(s => s.slug === 'steam');

        if (!steamStore?.storeGameId) {
          skipped++;
          continue;
        }

        await this.syncProtonDB(gameId);
        synced++;
      } catch (error) {
        logger.error(`Failed to sync ProtonDB for game ${gameId}:`, error);
        failed++;
      }
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return { synced, skipped, failed };
  }

  /**
   * Check if HLTB data needs refresh (older than 7 days)
   */
  needsHLTBRefresh(game: Game): boolean {
    if (!game.hltbLastSync) return true;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return game.hltbLastSync < sevenDaysAgo;
  }

  /**
   * Check if ProtonDB data needs refresh (older than 7 days)
   */
  needsProtonDBRefresh(game: Game): boolean {
    if (!game.protonDbLastSync) return true;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return game.protonDbLastSync < sevenDaysAgo;
  }
}

// Singleton instance
export const integrationService = new IntegrationService();
