import { qbittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { releaseRepository } from '../repositories/ReleaseRepository';
import { gameRepository } from '../repositories/GameRepository';
import { settingsService } from './SettingsService';
import type { NewRelease, NewDownloadHistory } from '../db/schema';
import type { ScoredRelease } from './IndexerService';
import { logger } from '../utils/logger';
import { db } from '../db';
import { downloadHistory } from '../db/schema';

export interface GrabReleaseResult {
  success: boolean;
  message: string;
  releaseId?: number;
  torrentHash?: string;
}

export class DownloadService {
  /**
   * Grab a release and send it to qBittorrent
   */
  async grabRelease(
    gameId: number,
    release: ScoredRelease
  ): Promise<GrabReleaseResult> {
    if (!qbittorrentClient.isConfigured()) {
      throw new Error('qBittorrent is not configured. Please add your qBittorrent settings.');
    }

    // Check if dry-run mode is enabled
    const isDryRun = await settingsService.getDryRun();

    logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Grabbing release: ${release.title} for game ID ${gameId}`);

    try {
      // Get game info
      const game = await gameRepository.findById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      if (isDryRun) {
        // Log detailed information about what would be downloaded
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('[DRY-RUN] Download Details:');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info(`Game: ${game.title} (${game.year})`);
        logger.info(`Release: ${release.title}`);
        logger.info(`Indexer: ${release.indexer}`);
        logger.info(`Quality: ${release.quality || 'N/A'}`);
        logger.info(`Size: ${(release.size / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        logger.info(`Seeders: ${release.seeders}`);
        logger.info(`Match Confidence: ${release.matchConfidence}`);
        logger.info(`Quality Score: ${release.score}`);
        logger.info(`Download URL: ${release.downloadUrl}`);
        logger.info(`Category: gamearr`);
        logger.info(`Tags: gamearr,game-${gameId}`);
        logger.info('═══════════════════════════════════════════════════════');

        return {
          success: true,
          message: '[DRY-RUN] Download logged (not actually downloaded)',
          releaseId: -1,
        };
      }

      // Create release record
      const newRelease: NewRelease = {
        gameId,
        title: release.title,
        size: release.size,
        seeders: release.seeders,
        downloadUrl: release.downloadUrl,
        indexer: release.indexer,
        quality: release.quality || null,
        grabbedAt: new Date(),
        status: 'pending',
      };

      const createdRelease = await releaseRepository.create(newRelease);

      // Add to qBittorrent
      const category = 'gamearr';
      const tags = `gamearr,game-${gameId}`;

      try {
        await qbittorrentClient.addTorrent(release.downloadUrl, {
          category,
          tags,
          paused: 'false',
        });

        // Update release status to downloading
        await releaseRepository.updateStatus(createdRelease.id, 'downloading');

        // Update game status to downloading
        await gameRepository.update(gameId, { status: 'downloading' });

        logger.info(`Release grabbed successfully: ${release.title}`);

        return {
          success: true,
          message: 'Release added to download queue',
          releaseId: createdRelease.id,
        };
      } catch (error) {
        // If adding to qBittorrent fails, mark release as failed
        await releaseRepository.updateStatus(createdRelease.id, 'failed');

        throw error;
      }
    } catch (error) {
      logger.error('Failed to grab release:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all active downloads
   * Filters to configured category and excludes completed downloads
   */
  async getActiveDownloads() {
    try {
      const torrents = await qbittorrentClient.getTorrents();

      // Get configured category filter
      const categoryFilter = await settingsService.getQBittorrentCategory();

      // Filter for configured category and exclude completed downloads
      const filteredTorrents = torrents.filter((torrent) => {
        // Only show torrents in configured category
        const isInCategory = torrent.category === categoryFilter;

        // Exclude completed downloads (100% progress)
        const isNotCompleted = torrent.progress < 1;

        return isInCategory && isNotCompleted;
      });

      return filteredTorrents;
    } catch (error) {
      logger.error('Failed to get active downloads:', error);
      throw error;
    }
  }

  /**
   * Get available qBittorrent categories
   */
  async getCategories(): Promise<string[]> {
    try {
      return await qbittorrentClient.getCategories();
    } catch (error) {
      logger.error('Failed to get categories:', error);
      throw error;
    }
  }

  /**
   * Get download by torrent hash
   */
  async getDownload(hash: string) {
    try {
      return await qbittorrentClient.getTorrent(hash);
    } catch (error) {
      logger.error('Failed to get download:', error);
      throw error;
    }
  }

  /**
   * Cancel/delete a download
   */
  async cancelDownload(hash: string, deleteFiles: boolean = false) {
    logger.info(`Cancelling download: ${hash}`);

    try {
      await qbittorrentClient.deleteTorrents([hash], deleteFiles);

      // TODO: Update release status in database
      // This would require storing the hash with the release

      logger.info('Download cancelled successfully');
    } catch (error) {
      logger.error('Failed to cancel download:', error);
      throw error;
    }
  }

  /**
   * Pause a download
   */
  async pauseDownload(hash: string) {
    try {
      await qbittorrentClient.pauseTorrents([hash]);
      logger.info(`Download paused: ${hash}`);
    } catch (error) {
      logger.error('Failed to pause download:', error);
      throw error;
    }
  }

  /**
   * Resume a download
   */
  async resumeDownload(hash: string) {
    try {
      await qbittorrentClient.resumeTorrents([hash]);
      logger.info(`Download resumed: ${hash}`);
    } catch (error) {
      logger.error('Failed to resume download:', error);
      throw error;
    }
  }

  /**
   * Sync download status from qBittorrent
   * This will be called by the monitoring job
   */
  async syncDownloadStatus() {
    try {
      const torrents = await qbittorrentClient.getTorrents();
      const activeReleases = await releaseRepository.findActiveDownloads();

      for (const release of activeReleases) {
        // Find matching torrent by name (we'll improve this later with hash storage)
        const torrent = torrents.find((t) =>
          t.name.toLowerCase().includes(release.title.toLowerCase().substring(0, 20))
        );

        if (!torrent) {
          continue;
        }

        // Update release status based on torrent state
        let newStatus: 'pending' | 'downloading' | 'completed' | 'failed' = 'downloading';

        if (torrent.progress >= 1) {
          newStatus = 'completed';

          // Update game status to downloaded when download completes
          if (release.status !== 'completed') {
            logger.info(`Download completed: ${release.title}`);
            await gameRepository.update(release.gameId, { status: 'downloaded' });
          }
        } else if (torrent.state === 'error') {
          newStatus = 'failed';
        }

        if (release.status !== newStatus) {
          await releaseRepository.updateStatus(release.id, newStatus);
          logger.info(`Updated release ${release.id} status to ${newStatus}`);
        }
      }
    } catch (error) {
      logger.error('Failed to sync download status:', error);
    }
  }

  /**
   * Test qBittorrent connection
   */
  async testConnection(): Promise<boolean> {
    return qbittorrentClient.testConnection();
  }
}

// Singleton instance
export const downloadService = new DownloadService();
