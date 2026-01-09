import type {
  QBittorrentAuthConfig,
  QBittorrentTorrent,
  AddTorrentOptions,
  TorrentInfo,
  TorrentState,
} from './types';
import { logger } from '../../utils/logger';
import { QBittorrentError, ErrorCode } from '../../utils/errors';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

// Interface for qBittorrent category from the API
interface QBittorrentCategory {
  name: string;
  savePath: string;
}

export class QBittorrentClient {
  private host: string;
  private username: string;
  private password: string;
  private cookie: string | null = null;
  private configured: boolean = false;

  // Conservative rate limit for qBittorrent (10 requests per second)
  private readonly rateLimiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

  constructor(config?: QBittorrentAuthConfig) {
    this.host = config?.host || process.env.QBITTORRENT_HOST || '';
    this.username = config?.username || process.env.QBITTORRENT_USERNAME || '';
    this.password = config?.password || process.env.QBITTORRENT_PASSWORD || '';

    // Remove trailing slash from host
    if (this.host) {
      this.host = this.host.replace(/\/$/, '');
      this.configured = true;
    }
  }

  /**
   * Configure the client with new credentials (called when settings are loaded/updated)
   */
  configure(config: QBittorrentAuthConfig): void {
    const newHost = config.host?.replace(/\/$/, '') || '';

    // If credentials changed, invalidate the cookie
    if (this.host !== newHost || this.username !== config.username || this.password !== config.password) {
      this.cookie = null;
    }

    this.host = newHost;
    this.username = config.username || '';
    this.password = config.password || '';
    this.configured = !!(this.host && this.username && this.password);

    if (this.configured) {
      logger.info(`qBittorrent client configured: ${this.host}`);
    }
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return this.configured;
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
      throw new QBittorrentError(
        'Not configured. Please add your qBittorrent settings.',
        ErrorCode.QBITTORRENT_NOT_CONFIGURED
      );
    }

    logger.info('Authenticating with qBittorrent...');

    try {
      const params = new URLSearchParams();
      params.append('username', this.username);
      params.append('password', this.password);

      // Auth requests use retry logic for reliability
      const response = await fetchWithRetry(`${this.host}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new QBittorrentError(
          `Authentication failed: ${response.statusText}`,
          ErrorCode.QBITTORRENT_AUTH_FAILED
        );
      }

      const result = await response.text();
      if (result !== 'Ok.') {
        throw new QBittorrentError(
          'Authentication failed: Invalid credentials',
          ErrorCode.QBITTORRENT_AUTH_FAILED
        );
      }

      // Extract cookie from response
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.cookie = setCookie.split(';')[0];
      }

      logger.info('qBittorrent authentication successful');
    } catch (error) {
      if (error instanceof QBittorrentError) {
        throw error;
      }
      logger.error('qBittorrent authentication failed:', error);
      throw new QBittorrentError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.QBITTORRENT_CONNECTION_FAILED
      );
    }
  }

  /**
   * Make an authenticated request to qBittorrent API with rate limiting and retry logic
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    await this.authenticate();

    const url = `${this.host}/api/v2/${endpoint}`;

    try {
      // Respect rate limit before making request
      await this.rateLimiter.acquire();

      const response = await fetchWithRetry(url, {
        ...options,
        headers: {
          Cookie: this.cookie || '',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        // Invalidate cookie on auth errors
        if (response.status === 401 || response.status === 403) {
          this.cookie = null;
          throw new QBittorrentError(
            `Authentication expired: ${response.statusText}`,
            ErrorCode.QBITTORRENT_AUTH_FAILED
          );
        }
        throw new QBittorrentError(
          `API error (${response.status}): ${response.statusText}`,
          ErrorCode.QBITTORRENT_ERROR
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }

      return response.text() as T;
    } catch (error) {
      if (error instanceof QBittorrentError) {
        throw error;
      }
      logger.error('qBittorrent request failed:', error);
      throw new QBittorrentError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.QBITTORRENT_CONNECTION_FAILED
      );
    }
  }

  /**
   * Add a torrent by URL or magnet link
   * For magnet links: sends URL directly
   * For .torrent URLs: downloads the file first, then uploads as binary
   */
  async addTorrent(url: string, options?: Partial<AddTorrentOptions>): Promise<string> {
    const isMagnet = url.startsWith('magnet:');
    logger.info(`Adding ${isMagnet ? 'magnet' : 'torrent file'} to qBittorrent`);

    try {
      if (isMagnet) {
        // Magnet links can be sent directly as URL
        return await this.addTorrentByUrl(url, options);
      } else {
        // For .torrent URLs, download the file first then upload as binary
        return await this.addTorrentByFile(url, options);
      }
    } catch (error) {
      logger.error('Failed to add torrent:', error);
      throw error;
    }
  }

  /**
   * Add torrent by magnet URL (sent directly to qBittorrent)
   */
  private async addTorrentByUrl(url: string, options?: Partial<AddTorrentOptions>): Promise<string> {
    logger.debug(`Sending magnet URL to qBittorrent`);

    const params = new URLSearchParams();
    params.append('urls', url);

    if (options?.savepath) params.append('savepath', options.savepath);
    if (options?.category) params.append('category', options.category);
    if (options?.tags) params.append('tags', options.tags);
    if (options?.paused) params.append('paused', options.paused);
    if (options?.skip_checking) params.append('skip_checking', options.skip_checking);
    if (options?.rename) params.append('rename', options.rename);

    logger.debug(`qBittorrent options: category=${options?.category}, tags=${options?.tags}`);

    const result = await this.request<string>('torrents/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (result === 'Fails.') {
      throw new QBittorrentError(
        'qBittorrent rejected the torrent - it may be invalid or already exists',
        ErrorCode.QBITTORRENT_ERROR
      );
    }

    logger.info(`Magnet added successfully to qBittorrent`);
    return result;
  }

  /**
   * Add torrent by downloading .torrent file and uploading as binary
   */
  private async addTorrentByFile(url: string, options?: Partial<AddTorrentOptions>): Promise<string> {
    logger.debug(`Downloading .torrent file from: ${url.substring(0, 80)}...`);

    // Download the .torrent file
    const response = await fetch(url);
    if (!response.ok) {
      throw new QBittorrentError(
        `Failed to download .torrent file: ${response.status} ${response.statusText}`,
        ErrorCode.QBITTORRENT_ERROR
      );
    }

    const torrentData = await response.arrayBuffer();
    logger.debug(`Downloaded .torrent file: ${torrentData.byteLength} bytes`);

    // Create multipart form data with the torrent file
    const formData = new FormData();
    const blob = new Blob([torrentData], { type: 'application/x-bittorrent' });
    formData.append('torrents', blob, 'torrent.torrent');

    // Add optional parameters
    if (options?.savepath) formData.append('savepath', options.savepath);
    if (options?.category) formData.append('category', options.category);
    if (options?.tags) formData.append('tags', options.tags);
    if (options?.paused) formData.append('paused', options.paused);
    if (options?.skip_checking) formData.append('skip_checking', options.skip_checking);
    if (options?.rename) formData.append('rename', options.rename);

    logger.debug(`qBittorrent options: category=${options?.category}, tags=${options?.tags}`);

    // Upload to qBittorrent (multipart/form-data for file uploads)
    const result = await this.request<string>('torrents/add', {
      method: 'POST',
      body: formData,
    });

    if (result === 'Fails.') {
      throw new QBittorrentError(
        'qBittorrent rejected the torrent file - it may be invalid or already exists',
        ErrorCode.QBITTORRENT_ERROR
      );
    }

    logger.info(`Torrent file uploaded successfully to qBittorrent`);
    return result;
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const categories = await this.request<Record<string, QBittorrentCategory>>('torrents/categories');
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
   * Pause/stop torrents
   * Note: qBittorrent v4.4.0+ uses 'stop' instead of 'pause'
   */
  async pauseTorrents(hashes: string[]): Promise<void> {
    const params = new URLSearchParams();
    params.append('hashes', hashes.join('|'));

    await this.request('torrents/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  }

  /**
   * Resume/start torrents
   * Note: qBittorrent v4.4.0+ uses 'start' instead of 'resume'
   */
  async resumeTorrents(hashes: string[]): Promise<void> {
    const params = new URLSearchParams();
    params.append('hashes', hashes.join('|'));

    await this.request('torrents/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  }

  /**
   * Add tags to torrents
   */
  async addTags(hashes: string[], tags: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('hashes', hashes.join('|'));
    params.append('tags', tags);

    await this.request('torrents/addTags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  }

  /**
   * Find torrents by save path
   */
  async findTorrentsByPath(folderPath: string): Promise<TorrentInfo[]> {
    const torrents = await this.getTorrents();

    // Normalize paths for comparison (handle both / and \)
    const normalizedFolder = folderPath.replace(/\\/g, '/').toLowerCase();

    return torrents.filter((torrent) => {
      const torrentPath = torrent.savePath.replace(/\\/g, '/').toLowerCase();
      // Check if the torrent save path contains the folder path or vice versa
      return torrentPath.includes(normalizedFolder) || normalizedFolder.includes(torrentPath);
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
      state: torrent.state as TorrentState,
      category: torrent.category,
      tags: torrent.tags,
      savePath: torrent.save_path,
      addedOn: new Date(torrent.added_on * 1000),
      completionOn: torrent.completion_on > 0 ? new Date(torrent.completion_on * 1000) : undefined,
    };
  }
}

// Singleton instance
export const qbittorrentClient = new QBittorrentClient();
