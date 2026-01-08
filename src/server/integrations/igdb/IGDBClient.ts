import type {
  IGDBGame,
  IGDBAuthResponse,
  IGDBSearchParams,
  GameSearchResult,
  PopularityType,
  PopularityPrimitive,
  PopularGame,
  MultiplayerInfo,
} from './types';
import { logger } from '../../utils/logger';
import { IGDBError, ErrorCode } from '../../utils/errors';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

export class IGDBClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private configured: boolean = false;

  private readonly authUrl = 'https://id.twitch.tv/oauth2/token';
  private readonly apiUrl = 'https://api.igdb.com/v4';

  // IGDB rate limit is 4 requests per second
  private readonly rateLimiter = new RateLimiter({ maxRequests: 4, windowMs: 1000 });

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId || process.env.IGDB_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.IGDB_CLIENT_SECRET || '';
    this.configured = !!(this.clientId && this.clientSecret);
  }

  /**
   * Configure the client with new credentials
   */
  configure(config: { clientId: string; clientSecret: string }): void {
    // Invalidate token if credentials changed
    if (this.clientId !== config.clientId || this.clientSecret !== config.clientSecret) {
      this.accessToken = null;
      this.tokenExpiry = 0;
    }

    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.configured = !!(this.clientId && this.clientSecret);

    if (this.configured) {
      logger.info('IGDB client configured');
    }
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Test connection to IGDB by authenticating and making a simple API call
   */
  async testConnection(): Promise<boolean> {
    try {
      // First ensure we can authenticate
      await this.authenticate();

      // Then make a simple API call to verify the connection works
      // Search for a well-known game (The Witcher 3) to confirm API access
      const query = `fields id, name; where id = 1942; limit 1;`;
      const results = await this.request<IGDBGame[]>('games', query);

      logger.info('IGDB connection test successful');
      return results.length > 0;
    } catch (error) {
      logger.error('IGDB connection test failed:', error);
      return false;
    }
  }

  /**
   * Authenticate with IGDB and get access token
   */
  private async authenticate(): Promise<void> {
    if (!this.isConfigured()) {
      throw new IGDBError('IGDB credentials not configured', ErrorCode.IGDB_AUTH_FAILED);
    }

    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    logger.info('Authenticating with IGDB...');

    try {
      // Auth requests don't count against IGDB rate limit, but use retry for reliability
      const response = await fetchWithRetry(
        `${this.authUrl}?client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new IGDBError(`Authentication failed: ${response.statusText}`, ErrorCode.IGDB_AUTH_FAILED);
      }

      const data: IGDBAuthResponse = await response.json();
      this.accessToken = data.access_token;
      // Set expiry 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      logger.info('IGDB authentication successful');
    } catch (error) {
      if (error instanceof IGDBError) {
        throw error;
      }
      logger.error('IGDB authentication failed:', error);
      throw new IGDBError(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.IGDB_AUTH_FAILED
      );
    }
  }

  /**
   * Make a request to IGDB API with rate limiting and retry logic
   */
  private async request<T>(endpoint: string, body: string): Promise<T> {
    await this.authenticate();

    // Respect rate limit before making request
    await this.rateLimiter.acquire();

    const response = await fetchWithRetry(`${this.apiUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!response.ok) {
      // Invalidate token on auth errors
      if (response.status === 401 || response.status === 403) {
        this.accessToken = null;
        throw new IGDBError(`Authentication expired: ${response.statusText}`, ErrorCode.IGDB_AUTH_FAILED);
      }
      if (response.status === 429) {
        throw new IGDBError('Rate limit exceeded', ErrorCode.IGDB_RATE_LIMITED);
      }
      throw new IGDBError(`API error: ${response.statusText}`, ErrorCode.IGDB_ERROR);
    }

    return response.json();
  }

  /**
   * Batch search for multiple games using multiquery (up to 10 at a time)
   * Returns a map of search term -> results
   * Optional onProgress callback receives (currentBatch, totalBatches, batchNames)
   * Uses parallel requests (up to 4 concurrent) for faster processing
   */
  async searchGamesBatch(
    names: string[],
    limit: number = 5,
    onProgress?: (current: number, total: number, batchNames: string[]) => void
  ): Promise<Map<string, GameSearchResult[]>> {
    if (names.length === 0) {
      return new Map();
    }

    // IGDB multiquery supports max 10 queries per request
    // IGDB rate limit is 4 requests per second, so we'll run up to 4 in parallel
    const batchSize = 10;
    const parallelLimit = 4;
    const totalBatches = Math.ceil(names.length / batchSize);
    const results = new Map<string, GameSearchResult[]>();

    // Create all batch definitions
    const batches: { names: string[]; batchNum: number }[] = [];
    for (let i = 0; i < names.length; i += batchSize) {
      batches.push({
        names: names.slice(i, i + batchSize),
        batchNum: Math.floor(i / batchSize) + 1,
      });
    }

    // Process batches in parallel groups
    let completedBatches = 0;
    for (let i = 0; i < batches.length; i += parallelLimit) {
      const parallelBatches = batches.slice(i, i + parallelLimit);

      logger.info(`Processing ${parallelBatches.length} batches in parallel (${i + 1}-${Math.min(i + parallelLimit, batches.length)} of ${totalBatches})`);

      // Report progress
      if (onProgress) {
        const allNames = parallelBatches.flatMap(b => b.names);
        onProgress(completedBatches + 1, totalBatches, allNames.slice(0, 10));
      }

      // Execute batches in parallel
      const batchPromises = parallelBatches.map(async (batch) => {
        const queries = this.buildBatchQuery(batch.names, limit);

        try {
          const response = await this.requestMultiquery(queries);
          return { batch, response, error: null };
        } catch (error) {
          logger.error(`IGDB batch ${batch.batchNum} failed:`, error);
          return { batch, response: null, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Process results
      for (const { batch, response } of batchResults) {
        if (response) {
          for (const item of response) {
            const idx = parseInt(item.name, 10);
            const originalName = batch.names[idx];
            if (originalName && item.result) {
              const mapped = item.result.map((game: IGDBGame) => this.mapToSearchResult(game));
              results.set(originalName, mapped);
            }
          }
        }

        // Fill in empty results for any names that didn't return
        for (const name of batch.names) {
          if (!results.has(name)) {
            results.set(name, []);
          }
        }

        completedBatches++;
      }

      // Report progress after parallel group completes
      if (onProgress && completedBatches < totalBatches) {
        onProgress(completedBatches, totalBatches, []);
      }
    }

    return results;
  }

  /**
   * Build the multiquery body for a batch of game names
   */
  private buildBatchQuery(names: string[], limit: number): string {
    return names
      .map((name, idx) => {
        // Clean up game name for pattern matching:
        // - Remove trademark/copyright symbols that Steam includes
        // - Escape quotes and special regex chars
        const escapedName = name
          .replace(/[™®©]/g, '')  // Remove trademark symbols
          .replace(/"/g, '\\"')    // Escape quotes
          .replace(/[*?]/g, '')    // Remove regex wildcards
          .trim();
        return `query games "${idx}" {
          fields name, cover.image_id, first_release_date, summary, platforms,
                 genres.name, total_rating, game_modes.name,
                 involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
                 similar_games.name, similar_games.cover.image_id, game_type,
                 multiplayer_modes.*, themes.name;
          where name ~ *"${escapedName}"* & game_type = 0 & platforms = (6);
          limit ${limit};
        };`;
      })
      .join('\n');
  }

  /**
   * Make a multiquery request to IGDB API with rate limiting and retry logic
   */
  private async requestMultiquery(body: string): Promise<Array<{ name: string; result: IGDBGame[] }>> {
    await this.authenticate();

    // Respect rate limit before making request
    await this.rateLimiter.acquire();

    const response = await fetchWithRetry(`${this.apiUrl}/multiquery`, {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      // Invalidate token on auth errors
      if (response.status === 401 || response.status === 403) {
        this.accessToken = null;
        throw new IGDBError(`Authentication expired: ${response.statusText}`, ErrorCode.IGDB_AUTH_FAILED);
      }
      if (response.status === 429) {
        throw new IGDBError('Rate limit exceeded', ErrorCode.IGDB_RATE_LIMITED);
      }
      throw new IGDBError(`Multiquery error: ${response.statusText} - ${text}`, ErrorCode.IGDB_ERROR);
    }

    return response.json();
  }

  /**
   * Search for games by name
   */
  async searchGames(params: IGDBSearchParams): Promise<GameSearchResult[]> {
    const { search, limit = 10, offset = 0 } = params;

    logger.info(`Searching IGDB for: ${search}`);

    // Get all matching games with expanded metadata
    const query = `
      search "${search}";
      fields name, cover.image_id, first_release_date, summary, platforms,
             genres.name, total_rating, game_modes.name,
             involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
             similar_games.name, similar_games.cover.image_id, game_type,
             multiplayer_modes.*, themes.name;
      where game_type = 0;
      limit ${limit};
    `;

    const results = await this.request<IGDBGame[]>('games', query);

    // Filter for PC games (platform ID 6) and main games only
    // Platform 6 = PC (Windows)
    // Category: 0 = main game, 1 = DLC, 2 = expansion, 3 = bundle, etc.
    const filteredGames = results.filter(game => {
      // IGDB returns platforms as array of IDs (numbers) when not expanded
      const hasPC = game.platforms && (game.platforms as number[]).includes(6);

      return hasPC;
    });

    const mapped = filteredGames.map((game) => this.mapToSearchResult(game));

    return mapped;
  }

  /**
   * Get game details by IGDB ID
   */
  async getGame(igdbId: number): Promise<GameSearchResult | null> {
    logger.info(`Fetching game from IGDB: ${igdbId}`);

    const query = `
      fields name, cover.url, cover.image_id, first_release_date, platforms.name, summary,
             genres.name, total_rating, game_modes.name,
             involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
             similar_games.name, similar_games.cover.image_id,
             multiplayer_modes.*, themes.name;
      where id = ${igdbId};
    `;

    const results = await this.request<IGDBGame[]>('games', query);

    if (results.length === 0) {
      return null;
    }

    return this.mapToSearchResult(results[0]);
  }

  /**
   * Map IGDB game to our search result format
   */
  private mapToSearchResult(game: IGDBGame): GameSearchResult {
    const year = game.first_release_date
      ? new Date(game.first_release_date * 1000).getFullYear()
      : undefined;

    // Convert IGDB cover URL to high-res
    let coverUrl: string | undefined;
    if (game.cover?.image_id) {
      coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`;
    }

    // Platforms are returned as IDs, just use PC since we filtered for it
    const platforms = ['PC'];

    // Extract genres
    const genres = game.genres?.map(g => g.name) || undefined;

    // Extract themes
    const themes = game.themes?.map(t => t.name) || undefined;

    // Extract game modes
    const gameModes = game.game_modes?.map(m => m.name) || undefined;

    // Extract developer and publisher from involved_companies
    let developer: string | undefined;
    let publisher: string | undefined;
    if (game.involved_companies) {
      const devCompany = game.involved_companies.find(ic => ic.developer);
      const pubCompany = game.involved_companies.find(ic => ic.publisher);
      developer = devCompany?.company?.name;
      publisher = pubCompany?.company?.name;
    }

    // Extract similar games with cover URLs
    const similarGames = game.similar_games?.slice(0, 6).map(sg => ({
      igdbId: sg.id,
      name: sg.name,
      coverUrl: sg.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${sg.cover.image_id}.jpg`
        : undefined,
    })) || undefined;

    // Round total rating to integer
    const totalRating = game.total_rating ? Math.round(game.total_rating) : undefined;

    // Parse multiplayer modes (aggregate across all platforms, prioritizing PC - platform 6)
    let multiplayer: MultiplayerInfo | undefined;
    if (game.multiplayer_modes && game.multiplayer_modes.length > 0) {
      // Prefer PC multiplayer mode if available, otherwise use first
      const pcMode = game.multiplayer_modes.find(m => m.platform === 6);
      const modes = pcMode ? [pcMode] : game.multiplayer_modes;

      multiplayer = {
        hasOnlineCoop: modes.some(m => m.onlinecoop),
        hasOfflineCoop: modes.some(m => m.offlinecoop),
        hasLanCoop: modes.some(m => m.lancoop),
        hasSplitscreen: modes.some(m => m.splitscreen || m.splitscreenonline),
        hasCampaignCoop: modes.some(m => m.campaigncoop),
        hasDropIn: modes.some(m => m.dropin),
        maxOnlinePlayers: Math.max(...modes.map(m => m.onlinemax || m.onlinecoopmax || 0).filter(n => n > 0), 0) || undefined,
        maxOfflinePlayers: Math.max(...modes.map(m => m.offlinemax || m.offlinecoopmax || 0).filter(n => n > 0), 0) || undefined,
      };

      // Only include if there's actually multiplayer support
      const hasAnyMultiplayer = multiplayer.hasOnlineCoop || multiplayer.hasOfflineCoop ||
        multiplayer.hasLanCoop || multiplayer.hasSplitscreen ||
        multiplayer.maxOnlinePlayers || multiplayer.maxOfflinePlayers;
      if (!hasAnyMultiplayer) {
        multiplayer = undefined;
      }
    }

    return {
      igdbId: game.id,
      title: game.name,
      year,
      coverUrl,
      summary: game.summary,
      platforms,
      genres,
      themes,
      totalRating,
      developer,
      publisher,
      gameModes,
      similarGames,
      multiplayer,
    };
  }

  /**
   * Get available popularity types
   */
  async getPopularityTypes(): Promise<PopularityType[]> {
    logger.info('Fetching IGDB popularity types');

    const query = `fields id, name, popularity_source, updated_at; sort id asc;`;
    const results = await this.request<PopularityType[]>('popularity_types', query);
    return results;
  }

  /**
   * Get popular games by popularity type
   */
  async getPopularGames(popularityType: number, limit: number = 20): Promise<PopularGame[]> {
    logger.info(`Fetching popular games (type: ${popularityType}, limit: ${limit})`);

    // First, get popularity primitives for the specified type
    const primitivesQuery = `
      fields game_id, value, popularity_type;
      sort value desc;
      limit ${limit};
      where popularity_type = ${popularityType};
    `;
    const primitives = await this.request<PopularityPrimitive[]>('popularity_primitives', primitivesQuery);

    if (primitives.length === 0) {
      return [];
    }

    // Extract game IDs
    const gameIds = primitives.map(p => p.game_id);

    // Fetch game details for all IDs in a single query
    const gamesQuery = `
      fields name, cover.image_id, first_release_date, summary, platforms,
             genres.name, total_rating, game_modes.name,
             involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
             similar_games.name, similar_games.cover.image_id,
             multiplayer_modes.*, themes.name;
      where id = (${gameIds.join(',')});
      limit ${limit};
    `;
    const games = await this.request<IGDBGame[]>('games', gamesQuery);

    // Create a map of game ID to game data
    const gameMap = new Map(games.map(g => [g.id, g]));

    // Combine popularity data with game details, maintaining rank order
    const popularGames: PopularGame[] = primitives
      .map((primitive, index) => {
        const game = gameMap.get(primitive.game_id);
        if (!game) return null;

        return {
          game: this.mapToSearchResult(game),
          popularityValue: primitive.value,
          popularityType: primitive.popularity_type,
          rank: index + 1,
        };
      })
      .filter((pg): pg is PopularGame => pg !== null);

    return popularGames;
  }
}

// Singleton instance
export const igdbClient = new IGDBClient();
