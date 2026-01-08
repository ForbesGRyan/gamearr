import { settingsRepository } from '../repositories/SettingsRepository';
import { DEFAULT_CATEGORIES } from '../../shared/categories';
import { logger } from '../utils/logger';

// Type for setting values after parsing
type SettingValue = string | number | boolean | null | number[];

// Settings keys
const SETTINGS_KEYS = {
  PROWLARR_CATEGORIES: 'prowlarr_categories',
  PROWLARR_URL: 'prowlarr_url',
  PROWLARR_API_KEY: 'prowlarr_api_key',
  QBITTORRENT_HOST: 'qbittorrent_host',
  QBITTORRENT_USERNAME: 'qbittorrent_username',
  QBITTORRENT_PASSWORD: 'qbittorrent_password',
  QBITTORRENT_CATEGORY: 'qbittorrent_category',
  IGDB_CLIENT_ID: 'igdb_client_id',
  IGDB_CLIENT_SECRET: 'igdb_client_secret',
  LIBRARY_PATH: 'library_path',
  DRY_RUN: 'dry_run',
  // Authentication settings
  AUTH_ENABLED: 'auth_enabled',
  API_KEY_HASH: 'api_key_hash',
  // Automation settings
  RSS_SYNC_INTERVAL: 'rss_sync_interval',
  SEARCH_SCHEDULER_INTERVAL: 'search_scheduler_interval',
  AUTO_GRAB_MIN_SCORE: 'auto_grab_min_score',
  AUTO_GRAB_MIN_SEEDERS: 'auto_grab_min_seeders',
};

// Map settings keys to their environment variable fallbacks
const ENV_VAR_FALLBACKS: Record<string, string> = {
  prowlarr_url: 'PROWLARR_URL',
  prowlarr_api_key: 'PROWLARR_API_KEY',
  qbittorrent_host: 'QBITTORRENT_HOST',
  qbittorrent_username: 'QBITTORRENT_USERNAME',
  qbittorrent_password: 'QBITTORRENT_PASSWORD',
  igdb_client_id: 'IGDB_CLIENT_ID',
  igdb_client_secret: 'IGDB_CLIENT_SECRET',
  library_path: 'LIBRARY_PATH',
};

export class SettingsService {
  /**
   * Get Prowlarr search categories
   */
  async getProwlarrCategories(): Promise<number[]> {
    const categories = await settingsRepository.getJSON<number[]>(
      SETTINGS_KEYS.PROWLARR_CATEGORIES
    );

    // Return default if not set
    return categories || DEFAULT_CATEGORIES;
  }

  /**
   * Set Prowlarr search categories
   */
  async setProwlarrCategories(categories: number[]): Promise<void> {
    logger.info(`Setting Prowlarr categories: ${categories.join(', ')}`);
    await settingsRepository.setJSON(SETTINGS_KEYS.PROWLARR_CATEGORIES, categories);
  }

  /**
   * Get qBittorrent category filter
   */
  async getQBittorrentCategory(): Promise<string> {
    const category = await settingsRepository.get(SETTINGS_KEYS.QBITTORRENT_CATEGORY);
    // Default to 'gamearr' if not set
    return category || 'gamearr';
  }

  /**
   * Set qBittorrent category filter
   */
  async setQBittorrentCategory(category: string): Promise<void> {
    logger.info(`Setting qBittorrent category filter: ${category}`);
    await settingsRepository.set(SETTINGS_KEYS.QBITTORRENT_CATEGORY, category);
  }

  /**
   * Get dry-run mode status
   */
  async getDryRun(): Promise<boolean> {
    const dryRun = await settingsRepository.getJSON<boolean>(SETTINGS_KEYS.DRY_RUN);
    // Default to true for safety - users should explicitly disable when ready
    return dryRun ?? true;
  }

  /**
   * Set dry-run mode
   */
  async setDryRun(enabled: boolean): Promise<void> {
    logger.info(`Setting dry-run mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    await settingsRepository.setJSON(SETTINGS_KEYS.DRY_RUN, enabled);
  }

  /**
   * Get RSS sync interval in minutes
   */
  async getRssSyncInterval(): Promise<number> {
    const interval = await settingsRepository.getJSON<number>(SETTINGS_KEYS.RSS_SYNC_INTERVAL);
    return interval ?? 15; // Default: 15 minutes
  }

  /**
   * Set RSS sync interval in minutes
   */
  async setRssSyncInterval(minutes: number): Promise<void> {
    const validMinutes = Math.max(5, Math.min(1440, minutes)); // 5 mins to 24 hours
    logger.info(`Setting RSS sync interval: ${validMinutes} minutes`);
    await settingsRepository.setJSON(SETTINGS_KEYS.RSS_SYNC_INTERVAL, validMinutes);
  }

  /**
   * Get search scheduler interval in minutes
   */
  async getSearchSchedulerInterval(): Promise<number> {
    const interval = await settingsRepository.getJSON<number>(SETTINGS_KEYS.SEARCH_SCHEDULER_INTERVAL);
    return interval ?? 15; // Default: 15 minutes
  }

  /**
   * Set search scheduler interval in minutes
   */
  async setSearchSchedulerInterval(minutes: number): Promise<void> {
    const validMinutes = Math.max(5, Math.min(1440, minutes)); // 5 mins to 24 hours
    logger.info(`Setting search scheduler interval: ${validMinutes} minutes`);
    await settingsRepository.setJSON(SETTINGS_KEYS.SEARCH_SCHEDULER_INTERVAL, validMinutes);
  }

  /**
   * Get minimum quality score for auto-grab
   */
  async getAutoGrabMinScore(): Promise<number> {
    const score = await settingsRepository.getJSON<number>(SETTINGS_KEYS.AUTO_GRAB_MIN_SCORE);
    return score ?? 100; // Default: 100
  }

  /**
   * Set minimum quality score for auto-grab
   */
  async setAutoGrabMinScore(score: number): Promise<void> {
    const validScore = Math.max(0, Math.min(500, score)); // 0 to 500
    logger.info(`Setting auto-grab minimum score: ${validScore}`);
    await settingsRepository.setJSON(SETTINGS_KEYS.AUTO_GRAB_MIN_SCORE, validScore);
  }

  /**
   * Get minimum seeders for auto-grab
   */
  async getAutoGrabMinSeeders(): Promise<number> {
    const seeders = await settingsRepository.getJSON<number>(SETTINGS_KEYS.AUTO_GRAB_MIN_SEEDERS);
    return seeders ?? 5; // Default: 5
  }

  /**
   * Set minimum seeders for auto-grab
   */
  async setAutoGrabMinSeeders(seeders: number): Promise<void> {
    const validSeeders = Math.max(0, Math.min(100, seeders)); // 0 to 100
    logger.info(`Setting auto-grab minimum seeders: ${validSeeders}`);
    await settingsRepository.setJSON(SETTINGS_KEYS.AUTO_GRAB_MIN_SEEDERS, validSeeders);
  }

  /**
   * Get a setting value (with env var fallback)
   */
  async getSetting(key: string): Promise<string | null> {
    const dbValue = await settingsRepository.get(key);
    if (dbValue !== null) {
      return dbValue;
    }

    // Fall back to environment variable if available
    const envVarName = ENV_VAR_FALLBACKS[key];
    if (envVarName && process.env[envVarName]) {
      return process.env[envVarName] as string;
    }

    return null;
  }

  /**
   * Set a setting value
   */
  async setSetting(key: string, value: string): Promise<void> {
    await settingsRepository.set(key, value);
  }

  /**
   * Get all settings (for display purposes, hide sensitive values)
   */
  async getAllSettings(): Promise<Record<string, SettingValue>> {
    const allSettings = await settingsRepository.getAll();
    const settingsMap: Record<string, SettingValue> = {};

    for (const setting of allSettings) {
      // Hide sensitive values
      if (
        setting.key.includes('password') ||
        setting.key.includes('secret') ||
        setting.key.includes('api_key')
      ) {
        settingsMap[setting.key] = '***HIDDEN***';
      } else {
        try {
          settingsMap[setting.key] = JSON.parse(setting.value) as SettingValue;
        } catch {
          settingsMap[setting.key] = setting.value;
        }
      }
    }

    return settingsMap;
  }
}

// Singleton instance
export const settingsService = new SettingsService();

// Export keys for use in other services
export { SETTINGS_KEYS };
