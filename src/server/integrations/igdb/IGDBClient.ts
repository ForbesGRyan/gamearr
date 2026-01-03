import type {
  IGDBGame,
  IGDBAuthResponse,
  IGDBSearchParams,
  GameSearchResult,
} from './types';
import { logger } from '../../utils/logger';

export class IGDBClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private readonly authUrl = 'https://id.twitch.tv/oauth2/token';
  private readonly apiUrl = 'https://api.igdb.com/v4';

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId || process.env.IGDB_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.IGDB_CLIENT_SECRET || '';
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  /**
   * Authenticate with IGDB and get access token
   */
  private async authenticate(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('IGDB credentials not configured');
    }

    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    logger.info('Authenticating with IGDB...');

    try {
      const response = await fetch(
        `${this.authUrl}?client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error(`IGDB auth failed: ${response.statusText}`);
      }

      const data: IGDBAuthResponse = await response.json();
      this.accessToken = data.access_token;
      // Set expiry 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      logger.info('IGDB authentication successful');
    } catch (error) {
      logger.error('IGDB authentication failed:', error);
      throw error;
    }
  }

  /**
   * Make a request to IGDB API
   */
  private async request<T>(endpoint: string, body: string): Promise<T> {
    await this.authenticate();

    const response = await fetch(`${this.apiUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for games by name
   */
  async searchGames(params: IGDBSearchParams): Promise<GameSearchResult[]> {
    const { search, limit = 10, offset = 0 } = params;

    logger.info(`Searching IGDB for: ${search}`);

    try {
      // Get all matching games, filter client-side for better results
      const query = `search "${search}"; fields name, cover.image_id, first_release_date, summary, platforms, game_type; where game_type = 0; limit ${limit};`;

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
    } catch (error) {
      logger.error('IGDB search failed:', error);
      throw error;
    }
  }

  /**
   * Get game details by IGDB ID
   */
  async getGame(igdbId: number): Promise<GameSearchResult | null> {
    logger.info(`Fetching game from IGDB: ${igdbId}`);

    try {
      const query = `
        fields name, cover.url, cover.image_id, first_release_date, platforms.name, summary;
        where id = ${igdbId};
      `;

      const results = await this.request<IGDBGame[]>('games', query);

      if (results.length === 0) {
        return null;
      }

      return this.mapToSearchResult(results[0]);
    } catch (error) {
      logger.error('IGDB get game failed:', error);
      throw error;
    }
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

    return {
      igdbId: game.id,
      title: game.name,
      year,
      coverUrl,
      summary: game.summary,
      platforms,
    };
  }
}

// Singleton instance
export const igdbClient = new IGDBClient();
