/**
 * GOG Galaxy API Client
 * Uses GOG's embed API with OAuth2 refresh tokens
 * Users can get their refresh token from GOG Galaxy's local database
 */

import { logger } from '../../utils/logger';
import { GogError, ErrorCode } from '../../utils/errors';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

interface GogTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  session_id: string;
  refresh_token: string;
  user_id: string;
}

interface GogProduct {
  id: number;
  title: string;
  image: string;
  url: string;
  worksOn: {
    Windows: boolean;
    Mac: boolean;
    Linux: boolean;
  };
  category: string;
  rating: number;
  isComingSoon: boolean;
  isMovie: boolean;
  isGame: boolean;
  slug: string;
}

interface GogOwnedGamesResponse {
  totalProducts: number;
  products: GogProduct[];
  totalPages: number;
  page: number;
}

interface GogUserData {
  userId: string;
  username: string;
  galaxyUserId: string;
  email: string;
  avatar: string;
}

export interface GogGame {
  id: number;
  title: string;
  imageUrl: string;
  slug: string;
  isGame: boolean;
}

// GOG Galaxy OAuth2 credentials (public, used by Galaxy client)
const GOG_CLIENT_ID = '46899977096215655';
const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
const GOG_REDIRECT_URI = 'https://embed.gog.com/on_login_success?origin=client';

export class GogClient {
  private refreshToken: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // GOG API rate limit (be conservative)
  private readonly rateLimiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

  constructor(refreshToken?: string) {
    this.refreshToken = refreshToken || process.env.GOG_REFRESH_TOKEN || '';
  }

  /**
   * Get the GOG OAuth authorization URL
   */
  static getAuthUrl(callbackUrl: string): string {
    const params = new URLSearchParams({
      client_id: GOG_CLIENT_ID,
      redirect_uri: callbackUrl,
      response_type: 'code',
      layout: 'client2',
    });
    return `https://auth.gog.com/auth?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens
   */
  static async exchangeCode(code: string, callbackUrl: string): Promise<{ refreshToken: string; accessToken: string; expiresIn: number }> {
    logger.info('Exchanging GOG authorization code for tokens...');

    const params = new URLSearchParams({
      client_id: GOG_CLIENT_ID,
      client_secret: GOG_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
    });

    const response = await fetch(`https://auth.gog.com/token?${params.toString()}`);

    if (!response.ok) {
      const text = await response.text();
      logger.error('GOG token exchange failed:', response.status, text);
      throw new GogError(`Token exchange failed: ${response.status} ${response.statusText}`, ErrorCode.GOG_AUTH_FAILED);
    }

    const data = await response.json() as GogTokenResponse;
    logger.info('GOG token exchange successful');

    return {
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!this.refreshToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new GogError('GOG refresh token is required', ErrorCode.GOG_NOT_CONFIGURED);
    }

    logger.info('Refreshing GOG access token...');

    const url = 'https://auth.gog.com/token';
    const params = new URLSearchParams({
      client_id: GOG_CLIENT_ID,
      client_secret: GOG_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    });

    try {
      await this.rateLimiter.acquire();
      const response = await fetchWithRetry(`${url}?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new GogError('Refresh token is invalid or expired', ErrorCode.GOG_TOKEN_EXPIRED);
        }
        throw new GogError(`Token refresh failed: ${response.status} ${response.statusText}`, ErrorCode.GOG_AUTH_FAILED);
      }

      const data = await response.json() as GogTokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000); // Expire 1 min early

      // Update refresh token if a new one was provided
      if (data.refresh_token && data.refresh_token !== this.refreshToken) {
        this.refreshToken = data.refresh_token;
        logger.info('GOG refresh token was updated');
      }

      logger.info('GOG access token refreshed successfully');
    } catch (error) {
      if (error instanceof GogError) {
        throw error;
      }
      logger.error('Failed to refresh GOG token:', error);
      throw new GogError(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.GOG_AUTH_FAILED
      );
    }
  }

  /**
   * Get a valid access token, refreshing if needed
   */
  private async getAccessToken(): Promise<string> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      await this.refreshAccessToken();
    }
    return this.accessToken!;
  }

  /**
   * Test connection by fetching user data
   */
  async testConnection(): Promise<{ success: boolean; username?: string; error?: string }> {
    logger.info('Testing GOG connection...');

    try {
      if (!this.isConfigured()) {
        return { success: false, error: 'GOG refresh token is required' };
      }

      const token = await this.getAccessToken();
      const url = 'https://embed.gog.com/userData.json';

      await this.rateLimiter.acquire();
      const response = await fetchWithRetry(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        logger.warn(`GOG connection test failed: HTTP ${response.status}`);
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json() as GogUserData;
      logger.info(`GOG connection successful: ${data.username}`);
      return {
        success: true,
        username: data.username,
      };
    } catch (error) {
      logger.error('GOG connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all owned games from GOG
   */
  async getOwnedGames(): Promise<GogGame[]> {
    if (!this.isConfigured()) {
      throw new GogError('GOG refresh token is required', ErrorCode.GOG_NOT_CONFIGURED);
    }

    logger.info('Fetching owned games from GOG...');

    const token = await this.getAccessToken();
    const allGames: GogGame[] = [];
    let page = 1;
    let totalPages = 1;

    try {
      do {
        const url = `https://embed.gog.com/account/getFilteredProducts?mediaType=1&page=${page}`;

        await this.rateLimiter.acquire();
        const response = await fetchWithRetry(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new GogError(`Authentication failed: ${response.statusText}`, ErrorCode.GOG_AUTH_FAILED);
          }
          throw new GogError(`API error: ${response.status} ${response.statusText}`, ErrorCode.GOG_ERROR);
        }

        const data = await response.json() as GogOwnedGamesResponse;
        totalPages = data.totalPages;

        // Filter to only games (not movies or DLC)
        const games = data.products
          .filter((product) => product.isGame)
          .map((product) => ({
            id: product.id,
            title: product.title,
            imageUrl: product.image ? `https:${product.image}_392.jpg` : '',
            slug: product.slug,
            isGame: product.isGame,
          }));

        allGames.push(...games);
        logger.debug(`Fetched page ${page}/${totalPages}, got ${games.length} games`);
        page++;
      } while (page <= totalPages);

      logger.info(`Found ${allGames.length} games in GOG library`);
      return allGames;
    } catch (error) {
      if (error instanceof GogError) {
        throw error;
      }
      logger.error('Failed to fetch GOG games:', error);
      throw new GogError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.GOG_ERROR
      );
    }
  }

  /**
   * Get GOG store page URL for a game
   */
  static getStoreUrl(slug: string): string {
    return `https://www.gog.com/game/${slug}`;
  }

  /**
   * Get GOG cover image URL for a game
   */
  static getCoverImageUrl(imageBase: string, size: '196' | '392' | '800' = '392'): string {
    if (!imageBase) return '';
    // GOG image URLs come without protocol
    const base = imageBase.startsWith('//') ? `https:${imageBase}` : imageBase;
    return `${base}_${size}.jpg`;
  }
}

// Singleton instance
export const gogClient = new GogClient();
