import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import { settingsService } from './SettingsService';
import type { ReleaseSearchResult } from '../integrations/prowlarr/types';
import type { Game } from '../db/schema';
import { logger } from '../utils/logger';

export interface ScoredRelease extends ReleaseSearchResult {
  score: number;
  matchConfidence: 'high' | 'medium' | 'low';
}

export class IndexerService {

  /**
   * Search for releases matching a game
   */
  async searchForGame(game: Game): Promise<ScoredRelease[]> {
    if (!prowlarrClient.isConfigured()) {
      throw new Error('Prowlarr is not configured. Please add your Prowlarr URL and API key in settings.');
    }

    logger.info(`Searching for releases: ${game.title} (${game.year})`);

    // Build search query
    const searchQuery = this.buildSearchQuery(game);

    // Get configured categories
    const categories = await settingsService.getProwlarrCategories();

    // Search Prowlarr with configured category filters
    const releases = await prowlarrClient.searchReleases({
      query: searchQuery,
      categories,
      limit: 50,
    });

    // Score and filter releases
    const scoredReleases = releases
      .map((release) => this.scoreRelease(release, game))
      .filter((release) => release.score > 0) // Filter out obvious bad matches
      .sort((a, b) => b.score - a.score); // Sort by score descending

    logger.info(`Found ${scoredReleases.length} potential releases for ${game.title}`);

    return scoredReleases;
  }

  /**
   * Manual search with custom query
   */
  async manualSearch(query: string): Promise<ReleaseSearchResult[]> {
    if (!prowlarrClient.isConfigured()) {
      throw new Error('Prowlarr is not configured. Please add your Prowlarr URL and API key in settings.');
    }

    logger.info(`Manual search: ${query}`);

    // Normalize query for better torrent matching
    const normalizedQuery = this.normalizeSearchQuery(query);
    logger.info(`Normalized search query: ${normalizedQuery}`);

    // Get configured categories
    const categories = await settingsService.getProwlarrCategories();

    // Search with configured category filters
    return prowlarrClient.searchReleases({
      query: normalizedQuery,
      categories,
      limit: 100,
    });
  }

  /**
   * Get available indexers
   */
  async getIndexers() {
    if (!prowlarrClient.isConfigured()) {
      throw new Error('Prowlarr is not configured');
    }

    return prowlarrClient.getIndexers();
  }

  /**
   * Test Prowlarr connection
   */
  async testConnection(): Promise<boolean> {
    return prowlarrClient.testConnection();
  }

  /**
   * Normalize search query for better torrent matching
   */
  private normalizeSearchQuery(query: string): string {
    // Remove apostrophes as torrent releases often drop them
    query = query.replace(/'/g, '');

    // Convert Roman numerals to Arabic numbers (torrent releases use numbers)
    // Use word boundaries to avoid replacing Roman numerals within words
    const romanToArabic: { [key: string]: string } = {
      ' VIII': ' 8',
      ' VII': ' 7',
      ' VI': ' 6',
      ' V': ' 5',
      ' IV': ' 4',
      ' III': ' 3',
      ' II': ' 2',
      ' I': ' 1',
      ' IX': ' 9',
      ' X': ' 10',
    };

    // Replace Roman numerals (checking longer ones first to avoid partial matches)
    for (const [roman, arabic] of Object.entries(romanToArabic)) {
      query = query.replace(new RegExp(roman + '(?:\\s|$)', 'g'), arabic + ' ');
    }

    return query.trim();
  }

  /**
   * Build search query from game info
   */
  private buildSearchQuery(game: Game): string {
    // Use only the game title for broader search results
    return this.normalizeSearchQuery(game.title);
  }

  /**
   * Score a release based on quality and matching
   */
  private scoreRelease(release: ReleaseSearchResult, game: Game): ScoredRelease {
    let score = 100; // Base score
    let matchConfidence: 'high' | 'medium' | 'low' = 'medium';

    const releaseTitleLower = release.title.toLowerCase();
    const gameTitleLower = game.title.toLowerCase();

    // Title matching
    if (releaseTitleLower.includes(gameTitleLower)) {
      score += 50;
      matchConfidence = 'high';
    } else {
      // Check for partial matches
      const gameWords = gameTitleLower.split(/\s+/);
      const matchedWords = gameWords.filter((word) =>
        word.length > 3 && releaseTitleLower.includes(word)
      );

      if (matchedWords.length / gameWords.length > 0.5) {
        score += 25;
      } else {
        score -= 50;
        matchConfidence = 'low';
      }
    }

    // Year matching
    if (game.year && releaseTitleLower.includes(game.year.toString())) {
      score += 20;
    }

    // Quality preferences (from product plan)
    if (release.quality === 'GOG') {
      score += 50;
    } else if (release.quality === 'DRM-Free') {
      score += 40;
    } else if (release.quality === 'Repack') {
      score += 20;
    } else if (release.quality === 'Scene') {
      score += 10;
    }

    // Seeders penalty
    if (release.seeders < 5) {
      score -= 30;
    } else if (release.seeders >= 20) {
      score += 10;
    }

    // Age penalty (releases older than 2 years from publish date)
    const ageInYears = (Date.now() - release.publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (ageInYears > 2) {
      score -= 20;
    }

    // Suspicious size penalty (less than 100MB or more than 200GB)
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
      score,
      matchConfidence,
    };
  }

  /**
   * Check if a release should be auto-grabbed
   */
  shouldAutoGrab(release: ScoredRelease): boolean {
    // Auto-grab criteria from product plan:
    // score >= 100 && seeders >= 5
    return release.score >= 100 && release.seeders >= 5;
  }
}

// Singleton instance
export const indexerService = new IndexerService();
