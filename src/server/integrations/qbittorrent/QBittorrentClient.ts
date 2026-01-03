import type {
  QBittorrentAuthConfig,
  QBittorrentTorrent,
  AddTorrentOptions,
  TorrentInfo,
} from './types';
import { logger } from '../../utils/logger';

export class QBittorrentClient {
  private host: string;
  private username: string;
  private password: string;
  private cookie: string | null = null;

  constructor(config?: QBittorrentAuthConfig) {
    this.host = config?.host || process.env.QBITTORRENT_HOST || 'http://localhost:8080';
    this.username = config?.username || process.env.QBITTORRENT_USERNAME || 'admin';
    this.password = config?.password || process.env.QBITTORRENT_PASSWORD || 'adminadmin';

    // Remove trailing slash from host
    this.host = this.host.replace(/\/$/, '');
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!this.host && !!this.username && !!this.password;
  }

  /**
   * Authenticate with qBittorrent
   */
  private async authenticate(): Promise<void> {
    if (this.cookie) {
      // Already authenticated
      return;
    }

    if (!this.isConfigured()) {
      throw new Error('qBittorrent credentials not configured');
    }

    logger.info('Authenticating with qBittorrent...');

    try {
      const params = new URLSearchParams();
      params.append('username', this.username);
      params.append('password', this.password);

      const response = await fetch(`${this.host}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`qBittorrent auth failed: ${response.statusText}`);
      }

      const result = await response.text();
      if (result !== 'Ok.') {
        throw new Error('qBittorrent authentication failed');
      }

      // Extract cookie from response
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.cookie = setCookie.split(';')[0];
      }

      logger.info('qBittorrent authentication successful');
    } catch (error) {
      logger.error('qBittorrent authentication failed:', error);
      throw error;
    }
  }

  /**
   * Make an authenticated request to qBittorrent API
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    await this.authenticate();

    const url = `${this.host}/api/v2/${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Cookie: this.cookie || '',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`qBittorrent API error (${response.status}): ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }

      return response.text() as T;
    } catch (error) {
      logger.error('qBittorrent request failed:', error);
      throw error;
    }
  }

  /**
   * Add a torrent by URL or magnet link
   */
  async addTorrent(url: string, options?: Partial<AddTorrentOptions>): Promise<string> {
    logger.info(`Adding torrent to qBittorrent: ${url.substring(0, 50)}...`);

    const params = new URLSearchParams();
    params.append('urls', url);

    // Add optional parameters
    if (options?.savepath) params.append('savepath', options.savepath);
    if (options?.category) params.append('category', options.category);
    if (options?.tags) params.append('tags', options.tags);
    if (options?.paused) params.append('paused', options.paused);
    if (options?.skip_checking) params.append('skip_checking', options.skip_checking);
    if (options?.rename) params.append('rename', options.rename);

    try {
      const result = await this.request<string>('torrents/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      logger.info('Torrent added successfully');
      return result;
    } catch (error) {
      logger.error('Failed to add torrent:', error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const categories = await this.request<Record<string, any>>('torrents/categories');
      // Return category names as an array
      return Object.keys(categories);
    } catch (error) {
      logger.error('Failed to get categories:', error);
      throw error;
    }
  }

  /**
   * Get all torrents
   */
  async getTorrents(filter?: string): Promise<TorrentInfo[]> {
    try {
      let endpoint = 'torrents/info';
      if (filter) {
        endpoint += `?filter=${filter}`;
      }

      const torrents = await this.request<QBittorrentTorrent[]>(endpoint);

      return torrents.map((torrent) => this.mapToTorrentInfo(torrent));
    } catch (error) {
      logger.error('Failed to get torrents:', error);
      throw error;
    }
  }

  /**
   * Get torrent by hash
   */
  async getTorrent(hash: string): Promise<TorrentInfo | null> {
    try {
      const torrents = await this.request<QBittorrentTorrent[]>(
        `torrents/info?hashes=${hash}`
      );

      if (torrents.length === 0) {
        return null;
      }

      return this.mapToTorrentInfo(torrents[0]);
    } catch (error) {
      logger.error('Failed to get torrent:', error);
      throw error;
    }
  }

  /**
   * Delete torrents
   */
  async deleteTorrents(hashes: string[], deleteFiles: boolean = false): Promise<void> {
    logger.info(`Deleting torrents: ${hashes.join(', ')}`);

    const params = new URLSearchParams();
    params.append('hashes', hashes.join('|'));
    params.append('deleteFiles', deleteFiles.toString());

    try {
      await this.request('torrents/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      logger.info('Torrents deleted successfully');
    } catch (error) {
      logger.error('Failed to delete torrents:', error);
      throw error;
    }
  }

  /**
   * Pause torrents
   */
  async pauseTorrents(hashes: string[]): Promise<void> {
    const params = new URLSearchParams();
    params.append('hashes', hashes.join('|'));

    await this.request('torrents/pause', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  }

  /**
   * Resume torrents
   */
  async resumeTorrents(hashes: string[]): Promise<void> {
    const params = new URLSearchParams();
    params.append('hashes', hashes.join('|'));

    await this.request('torrents/resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  }

  /**
   * Test connection to qBittorrent
   */
  async testConnection(): Promise<boolean> {
    try {
      const version = await this.request<string>('app/version');
      logger.info(`Connected to qBittorrent v${version}`);
      return true;
    } catch (error) {
      logger.error('qBittorrent connection test failed:', error);
      return false;
    }
  }

  /**
   * Get qBittorrent version
   */
  async getVersion(): Promise<string> {
    return this.request<string>('app/version');
  }

  /**
   * Map qBittorrent torrent to our TorrentInfo format
   */
  private mapToTorrentInfo(torrent: QBittorrentTorrent): TorrentInfo {
    return {
      hash: torrent.hash,
      name: torrent.name,
      size: torrent.size,
      progress: torrent.progress,
      downloadSpeed: torrent.dlspeed,
      uploadSpeed: torrent.upspeed,
      eta: torrent.eta,
      state: torrent.state as any,
      category: torrent.category,
      savePath: torrent.save_path,
      addedOn: new Date(torrent.added_on * 1000),
      completionOn: torrent.completion_on > 0 ? new Date(torrent.completion_on * 1000) : undefined,
    };
  }
}

// Singleton instance
export const qbittorrentClient = new QBittorrentClient();
