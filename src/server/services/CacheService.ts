import { cacheRepository } from '../repositories/CacheRepository';
import { settingsService } from './SettingsService';
import { gameService } from './GameService';
import { indexerService } from './IndexerService';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { logger } from '../utils/logger';
import type { PopularGame, PopularityType } from '../integrations/igdb/types';
import type { ReleaseSearchResult } from '../integrations/prowlarr/types';

// Default popularity types to cache (most commonly used)
const DEFAULT_POPULARITY_TYPES_TO_CACHE = [1, 2, 3, 4, 5];

export class CacheService {
  /**
   * Get cached trending games for a popularity type
   * Returns null if cache miss - caller should fetch directly
   */
  async getTrendingGames(popularityType: number): Promise<PopularGame[] | null> {
    const cacheKey = `trending_games_${popularityType}`;
    const cached = await cacheRepository.get(cacheKey);

    if (cached) {
      try {
        const data = JSON.parse(cached.data) as PopularGame[];
        // Add inLibrary flag based on current library state
        const libraryIgdbIds = await gameService.getAllIgdbIds();
        return data.map(pg => ({
          ...pg,
          inLibrary: libraryIgdbIds.has(pg.game.igdbId),
        }));
      } catch (error) {
        logger.error(`Failed to parse trending games cache for type ${popularityType}:`, error);
      }
    }

    return null;
  }

  /**
   * Refresh trending games cache for a specific popularity type
   */
  async refreshTrendingGames(popularityType: number, limit: number = 50): Promise<PopularGame[]> {
    const ttl = await settingsService.getTrendingGamesCacheInterval();

    try {
      logger.info(`Refreshing trending games cache (type: ${popularityType})`);
      const games = await igdbClient.getPopularGames(popularityType, limit);

      await cacheRepository.set({
        cacheKey: `trending_games_${popularityType}`,
        cacheType: 'trending_games',
        data: games,
        ttlMinutes: ttl,
      });

      return games;
    } catch (error) {
      logger.error(`Failed to refresh trending games cache for type ${popularityType}:`, error);
      // Return stale data if available
      const stale = await cacheRepository.getStale(`trending_games_${popularityType}`);
      if (stale) {
        return JSON.parse(stale.data);
      }
      throw error;
    }
  }

  /**
   * Get cached top torrents
   */
  async getTopTorrents(): Promise<ReleaseSearchResult[] | null> {
    const cached = await cacheRepository.get('top_torrents');

    if (cached) {
      try {
        return JSON.parse(cached.data) as ReleaseSearchResult[];
      } catch (error) {
        logger.error('Failed to parse top torrents cache:', error);
      }
    }

    return null;
  }

  /**
   * Refresh top torrents cache
   */
  async refreshTopTorrents(): Promise<ReleaseSearchResult[]> {
    const ttl = await settingsService.getTopTorrentsCacheInterval();

    try {
      logger.info('Refreshing top torrents cache');
      const releases = await indexerService.manualSearch('game');

      // Sort by seeders and limit to top 50
      const sorted = releases
        .sort((a, b) => b.seeders - a.seeders)
        .slice(0, 50);

      await cacheRepository.set({
        cacheKey: 'top_torrents',
        cacheType: 'top_torrents',
        data: sorted,
        ttlMinutes: ttl,
      });

      return sorted;
    } catch (error) {
      logger.error('Failed to refresh top torrents cache:', error);
      // Return stale data if available
      const stale = await cacheRepository.getStale('top_torrents');
      if (stale) {
        return JSON.parse(stale.data);
      }
      throw error;
    }
  }

  /**
   * Get cached popularity types
   */
  async getPopularityTypes(): Promise<PopularityType[] | null> {
    const cached = await cacheRepository.get('popularity_types');

    if (cached) {
      try {
        return JSON.parse(cached.data) as PopularityType[];
      } catch (error) {
        logger.error('Failed to parse popularity types cache:', error);
      }
    }

    return null;
  }

  /**
   * Refresh popularity types cache (longer TTL since this rarely changes)
   */
  async refreshPopularityTypes(): Promise<PopularityType[]> {
    try {
      logger.info('Refreshing popularity types cache');
      const types = await igdbClient.getPopularityTypes();

      await cacheRepository.set({
        cacheKey: 'popularity_types',
        cacheType: 'popularity_types',
        data: types,
        ttlMinutes: 60 * 24, // 24 hours TTL for popularity types
      });

      return types;
    } catch (error) {
      logger.error('Failed to refresh popularity types cache:', error);
      const stale = await cacheRepository.getStale('popularity_types');
      if (stale) {
        return JSON.parse(stale.data);
      }
      throw error;
    }
  }

  /**
   * Get list of popularity types to cache
   */
  getPopularityTypesToCache(): number[] {
    return DEFAULT_POPULARITY_TYPES_TO_CACHE;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<void> {
    await cacheRepository.deleteExpired();
  }
}

// Singleton instance
export const cacheService = new CacheService();
