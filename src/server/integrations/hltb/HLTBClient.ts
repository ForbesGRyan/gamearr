/**
 * HowLongToBeat API Client
 * Direct implementation with browser-like headers to avoid 403 errors
 */

import { logger } from '../../utils/logger';
import { RateLimiter } from '../../utils/http';

const HLTB_API_URL = 'https://howlongtobeat.com/api/search';
const HLTB_REFERER = 'https://howlongtobeat.com/';

// Rotate through common browser user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

interface HLTBSearchResult {
  game_id: number;
  game_name: string;
  game_name_date: number;
  game_alias: string;
  game_type: string;
  game_image: string;
  comp_lvl_combine: number;
  comp_lvl_sp: number;
  comp_lvl_co: number;
  comp_lvl_mp: number;
  comp_lvl_spd: number;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
  comp_all: number;
  comp_main_count: number;
  comp_plus_count: number;
  comp_100_count: number;
  comp_all_count: number;
  invested_co: number;
  invested_mp: number;
  invested_co_count: number;
  invested_mp_count: number;
  count_comp: number;
  count_speedrun: number;
  count_backlog: number;
  count_review: number;
  review_score: number;
  count_playing: number;
  count_retired: number;
  profile_dev: string;
  profile_popular: number;
  profile_steam: number;
  profile_platform: string;
  release_world: number;
}

interface HLTBApiResponse {
  color: string;
  title: string;
  category: string;
  count: number;
  pageCurrent: number;
  pageTotal: number;
  pageSize: number;
  data: HLTBSearchResult[];
}

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
  // Be conservative with rate limiting - HLTB doesn't have official API
  private readonly rateLimiter = new RateLimiter({ maxRequests: 1, windowMs: 3000 });
  private userAgentIndex = 0;

  private getRandomUserAgent(): string {
    const ua = USER_AGENTS[this.userAgentIndex];
    this.userAgentIndex = (this.userAgentIndex + 1) % USER_AGENTS.length;
    return ua;
  }

  /**
   * Convert seconds to hours
   */
  private secondsToHours(seconds: number): number | null {
    if (!seconds || seconds === 0) return null;
    return Math.round((seconds / 3600) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    return costs[s2.length];
  }

  /**
   * Search for a game by title
   */
  async search(title: string): Promise<HLTBGameData[]> {
    logger.debug(`Searching HLTB for: ${title}`);

    try {
      await this.rateLimiter.acquire();

      const searchTerms = title.split(' ').filter(t => t.length > 0);

      const payload = {
        searchType: 'games',
        searchTerms: searchTerms,
        searchPage: 1,
        size: 20,
        searchOptions: {
          games: {
            userId: 0,
            platform: '',
            sortCategory: 'popular',
            rangeCategory: 'main',
            rangeTime: { min: null, max: null },
            gameplay: { perspective: '', flow: '', genre: '' },
            rangeYear: { min: '', max: '' },
            modifier: '',
          },
          users: { sortCategory: 'postcount' },
          lists: { sortCategory: 'follows' },
          filter: '',
          sort: 0,
          randomizer: 0,
        },
      };

      const response = await fetch(HLTB_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.getRandomUserAgent(),
          'Origin': HLTB_REFERER,
          'Referer': HLTB_REFERER,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.warn(`HLTB API returned ${response.status}: ${response.statusText}`);
        return [];
      }

      const data = await response.json() as HLTBApiResponse;

      if (!data.data || data.data.length === 0) {
        logger.debug(`No HLTB results found for: ${title}`);
        return [];
      }

      logger.debug(`Found ${data.data.length} HLTB results for: ${title}`);

      return data.data.map((result) => ({
        hltbId: String(result.game_id),
        name: result.game_name,
        imageUrl: result.game_image
          ? `https://howlongtobeat.com/games/${result.game_image}`
          : '',
        gameplayMain: this.secondsToHours(result.comp_main),
        gameplayMainExtra: this.secondsToHours(result.comp_plus),
        gameplayCompletionist: this.secondsToHours(result.comp_100),
        similarity: this.calculateSimilarity(title, result.game_name),
      }));
    } catch (error) {
      logger.error(`HLTB search failed for "${title}":`, error);
      return []; // Return empty instead of throwing to avoid breaking the UI
    }
  }

  /**
   * Get detailed info for a game by HLTB ID
   */
  async getDetail(hltbId: string): Promise<HLTBGameData | null> {
    logger.debug(`Fetching HLTB detail for ID: ${hltbId}`);

    try {
      await this.rateLimiter.acquire();

      // Use the game page to get details
      const response = await fetch(`https://howlongtobeat.com/game/${hltbId}`, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        logger.debug(`HLTB game page returned ${response.status} for ID: ${hltbId}`);
        return null;
      }

      // For now, just return a minimal response - we'd need HTML parsing for full details
      // The search function usually provides enough data
      return null;
    } catch (error) {
      logger.error(`HLTB detail fetch failed for ID "${hltbId}":`, error);
      return null;
    }
  }

  /**
   * Search and find the best match for a game title
   * Returns the highest similarity match above threshold
   */
  async findBestMatch(title: string, minSimilarity: number = 0.5): Promise<HLTBGameData | null> {
    const results = await this.search(title);

    if (results.length === 0) {
      return null;
    }

    // Sort by similarity and get best match
    const sorted = [...results].sort((a, b) => b.similarity - a.similarity);
    const bestMatch = sorted[0];

    if (bestMatch.similarity < minSimilarity) {
      logger.debug(`Best HLTB match for "${title}" below threshold: ${bestMatch.similarity.toFixed(2)}`);
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
