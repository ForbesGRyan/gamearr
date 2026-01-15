/**
 * HowLongToBeat API Client
 * Uses the howlongtobeat npm package to fetch playtime estimates
 */

import { HowLongToBeatService, HowLongToBeatEntry } from 'howlongtobeat';
import { logger } from '../../utils/logger';
import { RateLimiter } from '../../utils/http';

export interface HLTBGameData {
  hltbId: string;
  name: string;
  imageUrl: string;
  gameplayMain: number | null; // Hours for main story
  gameplayMainExtra: number | null; // Hours for main + extras
  gameplayCompletionist: number | null; // Hours for completionist
  similarity: number;
}

export class HLTBClient {
  private service: HowLongToBeatService;

  // Be conservative with rate limiting - HLTB doesn't have official API
  private readonly rateLimiter = new RateLimiter({ maxRequests: 1, windowMs: 2000 });

  constructor() {
    this.service = new HowLongToBeatService();
  }

  /**
   * Search for a game by title
   */
  async search(title: string): Promise<HLTBGameData[]> {
    logger.debug(`Searching HLTB for: ${title}`);

    try {
      await this.rateLimiter.acquire();
      const results = await this.service.search(title);

      if (!results || results.length === 0) {
        logger.debug(`No HLTB results found for: ${title}`);
        return [];
      }

      logger.debug(`Found ${results.length} HLTB results for: ${title}`);

      return results.map((entry: HowLongToBeatEntry) => ({
        hltbId: entry.id,
        name: entry.name,
        imageUrl: entry.imageUrl,
        gameplayMain: entry.gameplayMain || null,
        gameplayMainExtra: entry.gameplayMainExtra || null,
        gameplayCompletionist: entry.gameplayCompletionist || null,
        similarity: entry.similarity,
      }));
    } catch (error) {
      logger.error(`HLTB search failed for "${title}":`, error);
      throw error;
    }
  }

  /**
   * Get detailed info for a game by HLTB ID
   */
  async getDetail(hltbId: string): Promise<HLTBGameData | null> {
    logger.debug(`Fetching HLTB detail for ID: ${hltbId}`);

    try {
      await this.rateLimiter.acquire();
      const entry = await this.service.detail(hltbId);

      if (!entry) {
        logger.debug(`No HLTB entry found for ID: ${hltbId}`);
        return null;
      }

      return {
        hltbId: entry.id,
        name: entry.name,
        imageUrl: entry.imageUrl,
        gameplayMain: entry.gameplayMain || null,
        gameplayMainExtra: entry.gameplayMainExtra || null,
        gameplayCompletionist: entry.gameplayCompletionist || null,
        similarity: 1,
      };
    } catch (error) {
      logger.error(`HLTB detail fetch failed for ID "${hltbId}":`, error);
      return null;
    }
  }

  /**
   * Search and find the best match for a game title
   * Returns the highest similarity match above threshold
   */
  async findBestMatch(title: string, minSimilarity: number = 0.6): Promise<HLTBGameData | null> {
    const results = await this.search(title);

    if (results.length === 0) {
      return null;
    }

    // Results are typically sorted by similarity, but let's be sure
    const bestMatch = results.reduce((best, current) =>
      current.similarity > best.similarity ? current : best
    );

    if (bestMatch.similarity < minSimilarity) {
      logger.debug(`Best HLTB match for "${title}" below threshold: ${bestMatch.similarity}`);
      return null;
    }

    logger.info(`Found HLTB match for "${title}": ${bestMatch.name} (${bestMatch.similarity.toFixed(2)})`);
    return bestMatch;
  }

  /**
   * Format playtime for display
   */
  static formatPlaytime(hours: number | null): string {
    if (hours === null || hours === 0) {
      return '--';
    }
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours % 1 === 0) {
      return `${hours}h`;
    }
    return `${hours.toFixed(1)}h`;
  }
}

// Singleton instance
export const hltbClient = new HLTBClient();
