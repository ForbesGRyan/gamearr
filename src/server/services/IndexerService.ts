import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import { settingsService } from './SettingsService';
import type { ReleaseSearchResult } from '../integrations/prowlarr/types';
import type { Game } from '../db/schema';
import { logger } from '../utils/logger';
import { NotConfiguredError } from '../utils/errors';

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
      throw new NotConfiguredError('Prowlarr');
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
      throw new NotConfiguredError('Prowlarr');
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
      throw new NotConfiguredError('Prowlarr');
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
   * Platform indicators for release title detection
   */
  private static readonly PLATFORM_INDICATORS: { [key: string]: RegExp[] } = {
    // PC platforms
    'PC': [/\bPC\b/i, /\bWindows\b/i, /\bWin\b/i, /\bGOG\b/i, /\bSteam\b/i],
    'PC (Windows)': [/\bPC\b/i, /\bWindows\b/i, /\bWin\b/i, /\bGOG\b/i, /\bSteam\b/i],
    'Mac': [/\bMac\b/i, /\bmacOS\b/i, /\bOSX\b/i],
    'Linux': [/\bLinux\b/i],
    // PlayStation
    'PlayStation 4': [/\bPS4\b/i, /\bPlayStation\s*4\b/i],
    'PlayStation 5': [/\bPS5\b/i, /\bPlayStation\s*5\b/i],
    'PlayStation VR': [/\bPSVR\b/i, /\bPS\s*VR\b/i],
    'PlayStation VR2': [/\bPSVR2?\b/i, /\bPS\s*VR\s*2\b/i],
    // Xbox
    'Xbox One': [/\bXbox\s*One\b/i, /\bXB1\b/i, /\bXBOX1\b/i],
    'Xbox Series X|S': [/\bXbox\s*Series\b/i, /\bXSX\b/i, /\bXSS\b/i],
    // Nintendo
    'Nintendo Switch': [/\bSwitch\b/i, /\bNSW\b/i, /\bNintendo\s*Switch\b/i],
  };

  /**
   * Detect platform from release title
   * Returns the detected platform or null if none found
   */
  private detectReleasePlatform(releaseTitle: string): string | null {
    for (const [platform, patterns] of Object.entries(IndexerService.PLATFORM_INDICATORS)) {
      for (const pattern of patterns) {
        if (pattern.test(releaseTitle)) {
          return platform;
        }
      }
    }
    return null;
  }

  /**
   * Check if two platforms are compatible (same platform family)
   */
  private isPlatformMatch(gamePlatform: string, releasePlatform: string): boolean {
    // Normalize platforms for comparison
    const normalize = (p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, '');

    const normalizedGame = normalize(gamePlatform);
    const normalizedRelease = normalize(releasePlatform);

    // Direct match
    if (normalizedGame === normalizedRelease) {
      return true;
    }

    // PC family (PC, Windows, Mac, Linux are often bundled)
    const pcPlatforms = ['pc', 'pcwindows', 'windows', 'mac', 'linux'];
    if (pcPlatforms.some(p => normalizedGame.includes(p)) &&
        pcPlatforms.some(p => normalizedRelease.includes(p))) {
      return true;
    }

    // PlayStation family
    const psPlatforms = ['playstation', 'ps4', 'ps5', 'psvr'];
    if (psPlatforms.some(p => normalizedGame.includes(p)) &&
        psPlatforms.some(p => normalizedRelease.includes(p))) {
      return true;
    }

    // Xbox family
    const xboxPlatforms = ['xbox', 'xb1', 'xsx', 'xss'];
    if (xboxPlatforms.some(p => normalizedGame.includes(p)) &&
        xboxPlatforms.some(p => normalizedRelease.includes(p))) {
      return true;
    }

    // Nintendo family
    const nintendoPlatforms = ['switch', 'nsw', 'nintendo'];
    if (nintendoPlatforms.some(p => normalizedGame.includes(p)) &&
        nintendoPlatforms.some(p => normalizedRelease.includes(p))) {
      return true;
    }

    return false;
  }

  /**
   * Score a release based on quality and matching
   */
  private scoreRelease(release: ReleaseSearchResult, game: Game): ScoredRelease {
    let score = 100; // Base score
    let matchConfidence: 'high' | 'medium' | 'low' = 'medium';

    const releaseTitleLower = release.title.toLowerCase();
    const gameTitleLower = game.title.toLowerCase();

    // Platform matching - heavily penalize wrong platform releases
    const detectedPlatform = this.detectReleasePlatform(release.title);
    if (detectedPlatform && game.platform) {
      if (!this.isPlatformMatch(game.platform, detectedPlatform)) {
        // Wrong platform - heavy penalty to filter it out
        score -= 200;
        matchConfidence = 'low';
        logger.debug(`Platform mismatch for "${release.title}": detected ${detectedPlatform}, game is ${game.platform}`);
      } else {
        // Correct platform - small bonus
        score += 10;
      }
    }

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
   * Uses configurable thresholds from settings
   */
  async shouldAutoGrab(release: ScoredRelease): Promise<boolean> {
    const minScore = await settingsService.getAutoGrabMinScore();
    const minSeeders = await settingsService.getAutoGrabMinSeeders();

    return release.score >= minScore && release.seeders >= minSeeders;
  }

  /**
   * Get current auto-grab criteria for display
   */
  async getAutoGrabCriteria(): Promise<{ minScore: number; minSeeders: number }> {
    const minScore = await settingsService.getAutoGrabMinScore();
    const minSeeders = await settingsService.getAutoGrabMinSeeders();
    return { minScore, minSeeders };
  }
}

// Singleton instance
export const indexerService = new IndexerService();
