import type {
  SabnzbdConfig,
  SabnzbdQueueSlot,
  SabnzbdHistorySlot,
  SabnzbdQueueResponse,
  SabnzbdHistoryResponse,
  SabnzbdAddResponse,
  SabnzbdVersionResponse,
  SabnzbdCategoriesResponse,
  NzbDownloadInfo,
  AddNzbOptions,
} from './types';
import { logger } from '../../utils/logger';
import { SabnzbdError, ErrorCode } from '../../utils/errors';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

export class SabnzbdClient {
  private host: string;
  private apiKey: string;
  private configured: boolean = false;

  // Conservative rate limit for SABnzbd (10 requests per second)
  private readonly rateLimiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

  constructor(config?: SabnzbdConfig) {
    this.host = config?.host || process.env.SABNZBD_HOST || '';
    this.apiKey = config?.apiKey || process.env.SABNZBD_API_KEY || '';

    // Remove trailing slash from host
    if (this.host) {
      this.host = this.host.replace(/\/$/, '');
      this.configured = !!(this.host && this.apiKey);
    }
  }

  /**
   * Configure the client with new credentials (called when settings are loaded/updated)
   */
  configure(config: SabnzbdConfig): void {
    this.host = config.host?.replace(/\/$/, '') || '';
    this.apiKey = config.apiKey || '';

    // Validate host uses http/https scheme only (prevent SSRF via file://, ftp://, etc.)
    if (this.host) {
      try {
        const parsed = new URL(this.host);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          logger.warn(`SABnzbd host uses disallowed protocol: ${parsed.protocol}`);
          this.host = '';
        }
      } catch {
        logger.warn(`SABnzbd host is not a valid URL: ${this.host}`);
        this.host = '';
      }
    }

    this.configured = !!(this.host && this.apiKey);

    if (this.configured) {
      logger.info(`SABnzbd client configured: ${this.host}`);
    }
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Make an authenticated request to SABnzbd API with rate limiting.
   * Uses POST for write operations (addurl) to avoid URL length limits,
   * GET for read operations.
   */
  private async request<T>(mode: string, params?: Record<string, string>, usePost: boolean = false): Promise<T> {
    if (!this.isConfigured()) {
      throw new SabnzbdError(
        'Not configured. Please add your SABnzbd settings.',
        ErrorCode.SABNZBD_NOT_CONFIGURED
      );
    }

    const url = new URL(`${this.host}/sabnzbd/api`);

    // Base params always needed
    const allParams: Record<string, string> = {
      output: 'json',
      apikey: this.apiKey,
      mode,
      ...params,
    };

    let fetchOptions: RequestInit;

    if (usePost) {
      // POST with form-encoded body — avoids URL length limits for long NZB URLs
      const body = new URLSearchParams(allParams);
      fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      };
    } else {
      for (const [key, value] of Object.entries(allParams)) {
        url.searchParams.set(key, value);
      }
      fetchOptions = { method: 'GET' };
    }

    try {
      await this.rateLimiter.acquire();

      const response = await fetchWithRetry(url.toString(), fetchOptions);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new SabnzbdError(
            `Authentication failed: ${response.statusText}`,
            ErrorCode.SABNZBD_AUTH_FAILED
          );
        }
        throw new SabnzbdError(
          `API error (${response.status}): ${response.statusText}`,
          ErrorCode.SABNZBD_ERROR
        );
      }

      const data = await response.json() as T & { error?: string };

      // SABnzbd returns errors in the response body
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new SabnzbdError(
          `API error: ${data.error}`,
          ErrorCode.SABNZBD_ERROR
        );
      }

      return data;
    } catch (error) {
      if (error instanceof SabnzbdError) {
        throw error;
      }
      logger.error('SABnzbd request failed:', error);
      throw new SabnzbdError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.SABNZBD_CONNECTION_FAILED
      );
    }
  }

  /**
   * Test connection to SABnzbd
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.request<SabnzbdVersionResponse>('version');
      logger.info(`Connected to SABnzbd v${result.version}`);
      return true;
    } catch (error) {
      logger.error('SABnzbd connection test failed:', error);
      return false;
    }
  }

  /**
   * Add an NZB by URL
   */
  async addNzb(url: string, options?: AddNzbOptions): Promise<string> {
    logger.info('Adding NZB to SABnzbd');

    const params: Record<string, string> = {
      name: url,
    };

    if (options?.category) {
      params.cat = options.category;
    }
    if (options?.priority !== undefined) {
      params.priority = options.priority.toString();
    }

    const result = await this.request<SabnzbdAddResponse>('addurl', params, true);

    if (!result.status || !result.nzo_ids?.length) {
      throw new SabnzbdError(
        'SABnzbd rejected the NZB - it may be invalid or already exists',
        ErrorCode.SABNZBD_ERROR
      );
    }

    const nzoId = result.nzo_ids[0];
    logger.info(`NZB added successfully to SABnzbd: ${nzoId}`);
    return nzoId;
  }

  /**
   * Get current download queue
   */
  async getQueue(): Promise<NzbDownloadInfo[]> {
    try {
      const result = await this.request<SabnzbdQueueResponse>('queue');
      return result.queue.slots.map(slot => this.mapQueueSlotToInfo(slot));
    } catch (error) {
      if (!(error instanceof SabnzbdError && error.code === ErrorCode.SABNZBD_NOT_CONFIGURED)) {
        logger.error('Failed to get SABnzbd queue:', error);
      }
      throw error;
    }
  }

  /**
   * Get download history
   */
  async getHistory(limit: number = 50): Promise<NzbDownloadInfo[]> {
    try {
      const result = await this.request<SabnzbdHistoryResponse>('history', {
        limit: limit.toString(),
      });
      return result.history.slots.map(slot => this.mapHistorySlotToInfo(slot));
    } catch (error) {
      if (!(error instanceof SabnzbdError && error.code === ErrorCode.SABNZBD_NOT_CONFIGURED)) {
        logger.error('Failed to get SABnzbd history:', error);
      }
      throw error;
    }
  }

  /**
   * Get all downloads (queue + recent history)
   */
  async getAllDownloads(historyLimit: number = 200): Promise<NzbDownloadInfo[]> {
    const [queue, history] = await Promise.all([
      this.getQueue(),
      this.getHistory(historyLimit),
    ]);
    return [...queue, ...history];
  }

  /**
   * Pause a download
   */
  async pauseDownload(nzoId: string): Promise<void> {
    await this.request('queue', {
      name: 'pause',
      value: nzoId,
    });
    logger.info(`SABnzbd download paused: ${nzoId}`);
  }

  /**
   * Resume a download
   */
  async resumeDownload(nzoId: string): Promise<void> {
    await this.request('queue', {
      name: 'resume',
      value: nzoId,
    });
    logger.info(`SABnzbd download resumed: ${nzoId}`);
  }

  /**
   * Delete a download
   */
  async deleteDownload(nzoId: string, deleteFiles: boolean = false): Promise<void> {
    // Try queue first, then history
    try {
      await this.request('queue', {
        name: 'delete',
        value: nzoId,
        del_files: deleteFiles ? '1' : '0',
      });
    } catch {
      // If not in queue, try removing from history
      await this.request('history', {
        name: 'delete',
        value: nzoId,
        del_files: deleteFiles ? '1' : '0',
      });
    }
    logger.info(`SABnzbd download deleted: ${nzoId}`);
  }

  /**
   * Pause the entire download queue
   */
  async pauseQueue(): Promise<void> {
    await this.request('pause');
    logger.info('SABnzbd queue paused');
  }

  /**
   * Resume the entire download queue
   */
  async resumeQueue(): Promise<void> {
    await this.request('resume');
    logger.info('SABnzbd queue resumed');
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const result = await this.request<SabnzbdCategoriesResponse>('get_cats');
      return result.categories.filter(c => c !== '*'); // Remove the wildcard category
    } catch (error) {
      logger.error('Failed to get SABnzbd categories:', error);
      throw error;
    }
  }

  /**
   * Map a queue slot to NzbDownloadInfo
   */
  private mapQueueSlotToInfo(slot: SabnzbdQueueSlot): NzbDownloadInfo {
    const totalMb = parseFloat(slot.mb) || 0;
    const leftMb = parseFloat(slot.mbleft) || 0;
    const downloadedMb = totalMb - leftMb;

    return {
      id: slot.nzo_id,
      name: slot.filename,
      size: totalMb * 1024 * 1024, // Convert MB to bytes
      progress: totalMb > 0 ? downloadedMb / totalMb : 0,
      downloadSpeed: 0, // Speed is at the global level, not per-slot
      eta: slot.timeleft,
      status: slot.status,
      category: slot.cat,
      client: 'sabnzbd',
    };
  }

  /**
   * Map a history slot to NzbDownloadInfo
   */
  private mapHistorySlotToInfo(slot: SabnzbdHistorySlot): NzbDownloadInfo {
    return {
      id: slot.nzo_id,
      name: slot.name,
      size: slot.bytes,
      progress: slot.status === 'Completed' ? 1 : 0,
      downloadSpeed: 0,
      eta: '0:00:00',
      status: slot.status,
      category: slot.category,
      savePath: slot.storage,
      completionOn: slot.completed > 0 ? new Date(slot.completed * 1000) : undefined,
      client: 'sabnzbd',
    };
  }
}

// Singleton instance
export const sabnzbdClient = new SabnzbdClient();
