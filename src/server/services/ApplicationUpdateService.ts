import { settingsService } from './SettingsService';
import { APP_VERSION, compareVersions, isNewerVersion } from '../utils/version';
import { logger } from '../utils/logger';

// Settings keys for application updates
export const APP_UPDATE_SETTINGS = {
  ENABLED: 'app_update_check_enabled',
  SCHEDULE: 'app_update_check_schedule',
  LAST_CHECK: 'app_update_last_check',
  CACHED_RESULT: 'app_update_cached_result',
  DISMISSED_VERSION: 'app_update_dismissed_version',
  GITHUB_REPO: 'app_update_github_repo',
} as const;

// Default GitHub repository (owner/repo format)
const DEFAULT_GITHUB_REPO = 'Producdevity/gamearr';

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  lastChecked: string | null;
  isDismissed: boolean;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

export class ApplicationUpdateService {
  private isChecking = false;

  /**
   * Get the GitHub repository to check for updates
   */
  async getGitHubRepo(): Promise<string> {
    const repo = await settingsService.getSetting(APP_UPDATE_SETTINGS.GITHUB_REPO);
    return repo || DEFAULT_GITHUB_REPO;
  }

  /**
   * Set the GitHub repository for update checks
   */
  async setGitHubRepo(repo: string): Promise<void> {
    await settingsService.setSetting(APP_UPDATE_SETTINGS.GITHUB_REPO, repo);
  }

  /**
   * Check if update checking is enabled
   */
  async isEnabled(): Promise<boolean> {
    const enabled = await settingsService.getSetting(APP_UPDATE_SETTINGS.ENABLED);
    // Default to enabled if not set
    return enabled === null || enabled === 'true';
  }

  /**
   * Enable or disable update checking
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await settingsService.setSetting(APP_UPDATE_SETTINGS.ENABLED, enabled.toString());
  }

  /**
   * Get the update check schedule
   */
  async getSchedule(): Promise<'daily' | 'weekly' | 'monthly'> {
    const schedule = await settingsService.getSetting(APP_UPDATE_SETTINGS.SCHEDULE);
    if (schedule === 'weekly' || schedule === 'monthly') {
      return schedule;
    }
    return 'daily'; // Default
  }

  /**
   * Set the update check schedule
   */
  async setSchedule(schedule: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    await settingsService.setSetting(APP_UPDATE_SETTINGS.SCHEDULE, schedule);
  }

  /**
   * Get the dismissed version (user clicked "dismiss" on this version)
   */
  async getDismissedVersion(): Promise<string | null> {
    return settingsService.getSetting(APP_UPDATE_SETTINGS.DISMISSED_VERSION);
  }

  /**
   * Dismiss notifications for a specific version
   */
  async dismissVersion(version: string): Promise<void> {
    await settingsService.setSetting(APP_UPDATE_SETTINGS.DISMISSED_VERSION, version);
    logger.info(`Dismissed update notification for version ${version}`);
  }

  /**
   * Clear the dismissed version (show notifications again)
   */
  async clearDismissedVersion(): Promise<void> {
    await settingsService.deleteSetting(APP_UPDATE_SETTINGS.DISMISSED_VERSION);
  }

  /**
   * Get cached update status (from last check)
   */
  async getCachedStatus(): Promise<UpdateStatus | null> {
    const cached = await settingsService.getSetting(APP_UPDATE_SETTINGS.CACHED_RESULT);
    if (!cached) return null;

    try {
      const result = JSON.parse(cached) as UpdateStatus;
      // Update current version in case it changed (app was updated)
      result.currentVersion = APP_VERSION;
      // Recalculate updateAvailable in case version changed
      if (result.latestVersion) {
        result.updateAvailable = isNewerVersion(result.latestVersion, APP_VERSION);
      }
      // Check if dismissed
      const dismissedVersion = await this.getDismissedVersion();
      result.isDismissed = dismissedVersion === result.latestVersion;
      return result;
    } catch (error) {
      logger.error('Failed to parse cached update status:', error);
      return null;
    }
  }

  /**
   * Get the update status, using cache if available and not expired
   */
  async getUpdateStatus(forceCheck = false): Promise<UpdateStatus> {
    // If not forcing a check, return cached status if available
    if (!forceCheck) {
      const cached = await this.getCachedStatus();
      if (cached) {
        return cached;
      }
    }

    // Perform a fresh check
    return this.checkForUpdates();
  }

  /**
   * Check for updates from GitHub releases
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    // Prevent concurrent checks
    if (this.isChecking) {
      logger.debug('Update check already in progress, returning cached result');
      const cached = await this.getCachedStatus();
      if (cached) return cached;
      // Return default if no cache
      return this.createDefaultStatus();
    }

    this.isChecking = true;
    logger.info('Checking for application updates...');

    try {
      const repo = await this.getGitHubRepo();
      const release = await this.fetchLatestRelease(repo);

      const status: UpdateStatus = {
        currentVersion: APP_VERSION,
        latestVersion: release ? this.parseVersion(release.tag_name) : null,
        updateAvailable: false,
        releaseUrl: release?.html_url || null,
        releaseNotes: release?.body || null,
        publishedAt: release?.published_at || null,
        lastChecked: new Date().toISOString(),
        isDismissed: false,
      };

      // Check if update is available
      if (status.latestVersion) {
        status.updateAvailable = isNewerVersion(status.latestVersion, APP_VERSION);

        // Check if this version was dismissed
        const dismissedVersion = await this.getDismissedVersion();
        status.isDismissed = dismissedVersion === status.latestVersion;
      }

      // Cache the result
      await this.cacheStatus(status);

      if (status.updateAvailable) {
        logger.info(`Update available: ${APP_VERSION} -> ${status.latestVersion}`);
      } else {
        logger.info(`Application is up to date (${APP_VERSION})`);
      }

      return status;
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      // Return cached result on error, or default status
      const cached = await this.getCachedStatus();
      return cached || this.createDefaultStatus();
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Fetch the latest release from GitHub
   */
  private async fetchLatestRelease(repo: string): Promise<GitHubRelease | null> {
    try {
      const url = `https://api.github.com/repos/${repo}/releases/latest`;
      logger.debug(`Fetching latest release from: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `Gamearr/${APP_VERSION}`,
        },
      });

      if (response.status === 404) {
        // No releases yet
        logger.debug('No releases found on GitHub');
        return null;
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const release = await response.json() as GitHubRelease;

      // Skip draft and prerelease versions
      if (release.draft || release.prerelease) {
        logger.debug('Latest release is draft or prerelease, checking for stable releases');
        return this.fetchLatestStableRelease(repo);
      }

      return release;
    } catch (error) {
      logger.error('Failed to fetch latest release:', error);
      return null;
    }
  }

  /**
   * Fetch the latest stable (non-prerelease) release
   */
  private async fetchLatestStableRelease(repo: string): Promise<GitHubRelease | null> {
    try {
      const url = `https://api.github.com/repos/${repo}/releases`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `Gamearr/${APP_VERSION}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const releases = await response.json() as GitHubRelease[];

      // Find first non-draft, non-prerelease version
      const stableRelease = releases.find(r => !r.draft && !r.prerelease);
      return stableRelease || null;
    } catch (error) {
      logger.error('Failed to fetch releases list:', error);
      return null;
    }
  }

  /**
   * Parse version from tag name (removes 'v' prefix if present)
   */
  private parseVersion(tagName: string): string {
    return tagName.replace(/^v/i, '');
  }

  /**
   * Cache the update status
   */
  private async cacheStatus(status: UpdateStatus): Promise<void> {
    await settingsService.setSetting(
      APP_UPDATE_SETTINGS.CACHED_RESULT,
      JSON.stringify(status)
    );
    await settingsService.setSetting(
      APP_UPDATE_SETTINGS.LAST_CHECK,
      status.lastChecked || new Date().toISOString()
    );
  }

  /**
   * Create a default status (no update info available)
   */
  private createDefaultStatus(): UpdateStatus {
    return {
      currentVersion: APP_VERSION,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: null,
      releaseNotes: null,
      publishedAt: null,
      lastChecked: null,
      isDismissed: false,
    };
  }
}

// Singleton instance
export const applicationUpdateService = new ApplicationUpdateService();
