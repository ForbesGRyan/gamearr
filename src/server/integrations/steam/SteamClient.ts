/**
 * Steam Web API Client
 * https://developer.valvesoftware.com/wiki/Steam_Web_API
 */

import { logger } from '../../utils/logger';
import { SteamError, ErrorCode } from '../../utils/errors';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  has_community_visible_stats: boolean;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  rtime_last_played?: number;
}

interface GetOwnedGamesResponse {
  response: {
    game_count: number;
    games: SteamOwnedGame[];
  };
}

interface PlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
}

interface GetPlayerSummariesResponse {
  response: {
    players: PlayerSummary[];
  };
}

export interface SteamGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  iconUrl: string;
  lastPlayed?: Date;
}

export class SteamClient {
  private apiKey: string;
  private steamId: string;

  // Steam Web API rate limit (100,000 calls per day ~ 1.15 per second, be conservative)
  private readonly rateLimiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });

  constructor(apiKey?: string, steamId?: string) {
    this.apiKey = apiKey || process.env.STEAM_API_KEY || '';
    this.steamId = steamId || process.env.STEAM_ID || '';
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.steamId;
  }

  /**
   * Test connection by fetching player summary
   */
  async testConnection(): Promise<{ success: boolean; playerName?: string; error?: string }> {
    logger.info('Testing Steam API connection...');

    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'Steam API key and Steam ID are required' };
      }

      const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${this.apiKey}&steamids=${this.steamId}`;
      await this.rateLimiter.acquire();
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        logger.warn(`Steam connection test failed: HTTP ${response.status}`);
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json() as GetPlayerSummariesResponse;

      if (!data.response?.players?.length) {
        logger.warn('Steam connection test failed: Steam ID not found or profile is private');
        return { success: false, error: 'Steam ID not found or profile is private' };
      }

      logger.info(`Steam connection successful: ${data.response.players[0].personaname}`);
      return {
        success: true,
        playerName: data.response.players[0].personaname
      };
    } catch (error) {
      logger.error('Steam connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all owned games for the configured Steam ID
   */
  async getOwnedGames(): Promise<SteamGame[]> {
    if (!this.isConfigured()) {
      throw new SteamError('Steam API key and Steam ID are required', ErrorCode.STEAM_NOT_CONFIGURED);
    }

    logger.info('Fetching owned games from Steam...');

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${this.apiKey}&steamid=${this.steamId}&include_appinfo=1&include_played_free_games=1&format=json`;

    try {
      await this.rateLimiter.acquire();
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new SteamError(`Authentication failed: ${response.statusText}`, ErrorCode.STEAM_AUTH_FAILED);
        }
        throw new SteamError(`API error: ${response.status} ${response.statusText}`, ErrorCode.STEAM_ERROR);
      }

      const data = await response.json() as GetOwnedGamesResponse;

      if (!data.response?.games) {
        logger.info('No games found in Steam library (may be private)');
        return [];
      }

      logger.info(`Found ${data.response.games.length} games in Steam library`);

      return data.response.games.map((game) => ({
        appId: game.appid,
        name: game.name,
        playtimeMinutes: game.playtime_forever,
        iconUrl: game.img_icon_url
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
          : '',
        lastPlayed: game.rtime_last_played
          ? new Date(game.rtime_last_played * 1000)
          : undefined,
      }));
    } catch (error) {
      if (error instanceof SteamError) {
        throw error;
      }
      logger.error('Failed to fetch Steam games:', error);
      throw new SteamError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STEAM_ERROR
      );
    }
  }

  /**
   * Get Steam store page URL for a game
   */
  static getStoreUrl(appId: number): string {
    return `https://store.steampowered.com/app/${appId}`;
  }

  /**
   * Get Steam header image URL for a game
   */
  static getHeaderImageUrl(appId: number): string {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
  }

  /**
   * Get Steam library hero image URL for a game
   */
  static getLibraryHeroUrl(appId: number): string {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`;
  }
}

// Singleton instance
export const steamClient = new SteamClient();
