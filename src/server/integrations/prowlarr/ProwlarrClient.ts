import type {
  ProwlarrSearchParams,
  ProwlarrRssParams,
  ProwlarrRelease,
  ProwlarrIndexer,
  ReleaseSearchResult,
} from './types';
import { logger } from '../../utils/logger';
import { ProwlarrError, ErrorCode } from '../../utils/errors';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

export class ProwlarrClient {
  private baseUrl: string;
  private apiKey: string;
  private configured: boolean = false;

  // Conservative rate limit for Prowlarr (10 requests per second)
  private readonly rateLimiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.PROWLARR_URL || '';
    this.apiKey = apiKey || process.env.PROWLARR_API_KEY || '';

    // Remove trailing slash from base URL
    if (this.baseUrl) {
      this.baseUrl = this.baseUrl.replace(/\/$/, '');
      this.configured = !!(this.baseUrl && this.apiKey);
    }
  }

  /**
   * Configure the client with new credentials
   */
  configure(config: { url: string; apiKey: string }): void {
    this.baseUrl = config.url?.replace(/\/$/, '') || '';
    this.apiKey = config.apiKey || '';
    this.configured = !!(this.baseUrl && this.apiKey);

    if (this.configured) {
      logger.info(`Prowlarr client configured: ${this.baseUrl}`);
    }
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Make a request to Prowlarr API with rate limiting and retry logic
   */
  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    if (!this.isConfigured()) {
      throw new ProwlarrError(
        'Not configured. Please add your Prowlarr URL and API key in settings.',
        ErrorCode.PROWLARR_NOT_CONFIGURED
      );
    }

    const url = new URL(`${this.baseUrl}/api/v1/${endpoint}`);

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    try {
      // Respect rate limit before making request
      await this.rateLimiter.acquire();

      const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProwlarrError(
          `API error (${response.status}): ${errorText}`,
          ErrorCode.PROWLARR_ERROR
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof ProwlarrError) {
        throw error;
      }
      logger.error('Prowlarr request failed:', error);
      throw new ProwlarrError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.PROWLARR_CONNECTION_FAILED
      );
    }
  }

  /**
   * Search for releases
   */
  async searchReleases(params: ProwlarrSearchParams): Promise<ReleaseSearchResult[]> {
    const { query, indexerIds, categories, limit = 100, offset = 0, type = 'search' } = params;

    logger.info(`Searching Prowlarr for: ${query}`);

    try {
      const searchParams: Record<string, string> = {
        query,
        type,
        limit: limit.toString(),
        offset: offset.toString(),
      };

      // Add indexer IDs if specified
      if (indexerIds && indexerIds.length > 0) {
        searchParams.indexerIds = indexerIds.join(',');
      }

      // Add categories if specified
      if (categories && categories.length > 0) {
        categories.forEach((cat, index) => {
          searchParams[`categories[${index}]`] = cat.toString();
        });
      }

      const results = await this.request<ProwlarrRelease[]>('search', searchParams);

      return results.map((release) => this.mapToSearchResult(release));
    } catch (error) {
      logger.error('Prowlarr search failed:', error);
      throw error;
    }
  }

  /**
   * Get recent releases via RSS/newznab feed
   * This fetches the latest releases without a specific search query
   */
  async getRssReleases(params: ProwlarrRssParams = {}): Promise<ReleaseSearchResult[]> {
    const { indexerIds, categories, limit = 100 } = params;

    logger.info('Fetching RSS releases from Prowlarr');

    try {
      const searchParams: Record<string, string> = {
        query: '', // Empty query to get recent releases
        type: 'search',
        limit: limit.toString(),
        offset: '0',
      };

      // Add indexer IDs if specified
      if (indexerIds && indexerIds.length > 0) {
        searchParams.indexerIds = indexerIds.join(',');
      }

      // Add categories if specified
      if (categories && categories.length > 0) {
        categories.forEach((cat, index) => {
          searchParams[`categories[${index}]`] = cat.toString();
        });
      }

      const results = await this.request<ProwlarrRelease[]>('search', searchParams);

      logger.info(`Fetched ${results.length} RSS releases from Prowlarr`);

      return results.map((release) => this.mapToSearchResult(release));
    } catch (error) {
      logger.error('Prowlarr RSS fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get all configured indexers
   */
  async getIndexers(): Promise<ProwlarrIndexer[]> {
    logger.info('Fetching Prowlarr indexers');

    try {
      const indexers = await this.request<ProwlarrIndexer[]>('indexer');
      return indexers.filter((indexer) => indexer.enable);
    } catch (error) {
      logger.error('Failed to fetch Prowlarr indexers:', error);
      throw error;
    }
  }

  /**
   * Test connection to Prowlarr
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request<{ status: string }>('system/status');
      return true;
    } catch (error) {
      logger.error('Prowlarr connection test failed:', error);
      return false;
    }
  }

  /**
   * Map Prowlarr release to our search result format
   */
  private mapToSearchResult(release: ProwlarrRelease): ReleaseSearchResult {
    return {
      guid: release.guid,
      title: release.title,
      indexer: release.indexer,
      size: release.size,
      seeders: release.seeders || 0,
      downloadUrl: release.downloadUrl || release.magnetUrl || '',
      publishedAt: new Date(release.publishDate),
      quality: this.extractQuality(release.title),
    };
  }

  /**
   * Extract quality information from release title
   */
  private extractQuality(title: string): string | undefined {
    const titleLower = title.toLowerCase();

    // Check for common quality indicators
    if (titleLower.includes('gog')) return 'GOG';
    if (titleLower.includes('steam')) return 'Steam';
    if (titleLower.includes('drm free') || titleLower.includes('drm-free')) return 'DRM-Free';
    if (titleLower.includes('repack')) return 'Repack';
    if (titleLower.includes('scene')) return 'Scene';

    return undefined;
  }
}

// Singleton instance
export const prowlarrClient = new ProwlarrClient();
