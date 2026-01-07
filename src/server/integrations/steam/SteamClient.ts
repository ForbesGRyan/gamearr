/**
 * Steam Web API Client
 * https://developer.valvesoftware.com/wiki/Steam_Web_API
 */

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

  constructor(apiKey: string, steamId: string) {
    this.apiKey = apiKey;
    this.steamId = steamId;
  }

  /**
   * Test connection by fetching player summary
   */
  async testConnection(): Promise<{ success: boolean; playerName?: string; error?: string }> {
    try {
      const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${this.apiKey}&steamids=${this.steamId}`;
      const response = await fetch(url);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json() as GetPlayerSummariesResponse;

      if (!data.response?.players?.length) {
        return { success: false, error: 'Steam ID not found or profile is private' };
      }

      return {
        success: true,
        playerName: data.response.players[0].personaname
      };
    } catch (error) {
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
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${this.apiKey}&steamid=${this.steamId}&include_appinfo=1&include_played_free_games=1&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Steam API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GetOwnedGamesResponse;

    if (!data.response?.games) {
      return [];
    }

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
