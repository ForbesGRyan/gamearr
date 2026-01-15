/**
 * ProtonDB API Client
 * Fetches Linux/Steam Deck compatibility ratings for games
 * https://www.protondb.com/
 */

import { logger } from '../../utils/logger';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

// ProtonDB tier ratings from best to worst
export type ProtonDBTier = 'native' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked' | 'pending';

export interface ProtonDBSummary {
  tier: ProtonDBTier;
  trendingTier: ProtonDBTier;
  bestReportedTier: ProtonDBTier;
  score: number;
  confidence: string;
  total: number;
}

export interface ProtonDBGameData {
  steamAppId: number;
  tier: ProtonDBTier;
  trendingTier: ProtonDBTier;
  score: number;
  confidence: string;
  totalReports: number;
}

// Tier display configuration
export const TIER_CONFIG: Record<ProtonDBTier, { label: string; color: string; description: string }> = {
  native: {
    label: 'Native',
    color: '#4ade80', // green-400
    description: 'Runs natively on Linux',
  },
  platinum: {
    label: 'Platinum',
    color: '#a78bfa', // violet-400
    description: 'Runs perfectly out of the box',
  },
  gold: {
    label: 'Gold',
    color: '#fbbf24', // amber-400
    description: 'Runs perfectly after tweaks',
  },
  silver: {
    label: 'Silver',
    color: '#94a3b8', // slate-400
    description: 'Runs with minor issues',
  },
  bronze: {
    label: 'Bronze',
    color: '#f97316', // orange-500
    description: 'Runs but has significant issues',
  },
  borked: {
    label: 'Borked',
    color: '#ef4444', // red-500
    description: 'Does not run or is unplayable',
  },
  pending: {
    label: 'Pending',
    color: '#6b7280', // gray-500
    description: 'No reports yet',
  },
};

export class ProtonDBClient {
  private readonly baseUrl = 'https://www.protondb.com/api/v1/reports/summaries';

  // Be conservative with rate limiting
  private readonly rateLimiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

  /**
   * Get ProtonDB summary for a Steam app ID
   */
  async getSummary(steamAppId: number): Promise<ProtonDBGameData | null> {
    logger.debug(`Fetching ProtonDB summary for Steam app ID: ${steamAppId}`);

    try {
      await this.rateLimiter.acquire();
      const url = `${this.baseUrl}/${steamAppId}.json`;
      const response = await fetchWithRetry(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 404) {
        logger.debug(`No ProtonDB data found for Steam app ID: ${steamAppId}`);
        return null;
      }

      if (!response.ok) {
        logger.warn(`ProtonDB request failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json() as ProtonDBSummary;

      return {
        steamAppId,
        tier: this.normalizeTier(data.tier),
        trendingTier: this.normalizeTier(data.trendingTier),
        score: data.score || 0,
        confidence: data.confidence || 'low',
        totalReports: data.total || 0,
      };
    } catch (error) {
      logger.error(`ProtonDB fetch failed for Steam app ID ${steamAppId}:`, error);
      return null;
    }
  }

  /**
   * Normalize tier string to valid ProtonDBTier
   */
  private normalizeTier(tier: string | undefined): ProtonDBTier {
    if (!tier) return 'pending';
    const normalized = tier.toLowerCase() as ProtonDBTier;
    if (TIER_CONFIG[normalized]) {
      return normalized;
    }
    return 'pending';
  }

  /**
   * Test if ProtonDB is accessible
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Test with a known game (Half-Life 2 - Steam ID 220)
      const result = await this.getSummary(220);
      if (result) {
        logger.info('ProtonDB connection successful');
        return { success: true };
      }
      return { success: false, error: 'No data returned' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get tier display info
   */
  static getTierInfo(tier: ProtonDBTier) {
    return TIER_CONFIG[tier] || TIER_CONFIG.pending;
  }

  /**
   * Check if a tier is considered playable
   */
  static isPlayable(tier: ProtonDBTier): boolean {
    return ['native', 'platinum', 'gold', 'silver'].includes(tier);
  }

  /**
   * Get tier sort priority (higher = better)
   */
  static getTierPriority(tier: ProtonDBTier): number {
    const priorities: Record<ProtonDBTier, number> = {
      native: 6,
      platinum: 5,
      gold: 4,
      silver: 3,
      bronze: 2,
      borked: 1,
      pending: 0,
    };
    return priorities[tier] || 0;
  }
}

// Singleton instance
export const protonDBClient = new ProtonDBClient();
