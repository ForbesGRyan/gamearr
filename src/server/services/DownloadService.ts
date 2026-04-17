import { qbittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { sabnzbdClient } from '../integrations/sabnzbd/SabnzbdClient';
import { discordClient } from '../integrations/discord/DiscordWebhookClient';
import { releaseRepository } from '../repositories/ReleaseRepository';
import { gameRepository } from '../repositories/GameRepository';
import { settingsService } from './SettingsService';
import { libraryService } from './LibraryService';
import type { NewRelease, NewDownloadHistory, Release } from '../db/schema';
import type { ScoredRelease } from './IndexerService';
import type { TorrentInfo } from '../integrations/qbittorrent/types';
import type { NzbDownloadInfo } from '../integrations/sabnzbd/types';
import { logger } from '../utils/logger';
import { NotConfiguredError, NotFoundError } from '../utils/errors';

export interface GrabReleaseResult {
  releaseId: number;
  torrentHash?: string;
}

/**
 * Result of torrent matching with confidence level
 */
interface TorrentMatchResult {
  torrent: TorrentInfo;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  matchMethod: string;
}

/**
 * Size tolerance percentage for matching (10% difference allowed)
 */
const SIZE_TOLERANCE_PERCENT = 0.10;

/**
 * Progressive retry delays (ms) for torrent hash discovery
 * Increases delay with each retry to allow qBittorrent processing time
 */
const TORRENT_DISCOVERY_DELAYS_MS = [2000, 3000, 5000, 8000, 10000] as const;
const TORRENT_DISCOVERY_MAX_RETRIES = TORRENT_DISCOVERY_DELAYS_MS.length;
const TORRENT_DISCOVERY_LOOKBACK_MS = 60000; // Look for torrents added in last minute

export class DownloadService {
  /**
   * Normalize a string for comparison by removing special characters,
   * converting to lowercase, and collapsing whitespace.
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      // Remove common scene/release group markers
      .replace(/[\[\](){}]/g, ' ')
      // Remove file extensions
      .replace(/\.(torrent|nfo|txt|rar|zip|7z)$/i, '')
      // Replace common separators with spaces
      .replace(/[._-]+/g, ' ')
      // Remove special characters except alphanumeric and spaces
      .replace(/[^a-z0-9\s]/g, '')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract key identifying tokens from a release name.
   * This helps match torrents even when names differ slightly.
   */
  private extractKeyTokens(name: string): Set<string> {
    const normalized = this.normalizeName(name);
    const tokens = normalized.split(' ').filter(t => t.length >= 2);
    return new Set(tokens);
  }

  /**
   * Calculate token overlap ratio between two sets of tokens.
   * Returns a value between 0 and 1.
   */
  private calculateTokenOverlap(tokens1: Set<string>, tokens2: Set<string>): number {
    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let matchCount = 0;
    for (const token of tokens1) {
      if (tokens2.has(token)) {
        matchCount++;
      }
    }

    // Use the smaller set as the denominator to favor partial matches
    const minSize = Math.min(tokens1.size, tokens2.size);
    return matchCount / minSize;
  }

  /**
   * Check if two sizes are within tolerance of each other.
   */
  private sizesMatch(size1: number | null, size2: number): boolean {
    if (size1 === null || size1 === 0) return true; // No size to compare

    const diff = Math.abs(size1 - size2);
    const maxSize = Math.max(size1, size2);
    const percentDiff = diff / maxSize;

    return percentDiff <= SIZE_TOLERANCE_PERCENT;
  }

  /**
   * Parse game ID from torrent tags (e.g., "gamearr,game-123" -> 123)
   */
  private parseGameIdFromTags(tags: string): number | null {
    if (!tags) return null;

    const tagList = tags.split(',').map(t => t.trim());
    for (const tag of tagList) {
      const match = tag.match(/^game-(\d+)$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  }

  /**
   * Find the best matching torrent for a release using multiple criteria.
   * Returns null if no confident match is found.
   *
   * Matching priority:
   * 1. Exact hash match (if release has stored hash)
   * 2. Tag-based match (using game-{id} tag we set when adding)
   * 3. Multi-criteria match (normalized name + size)
   */
  private findMatchingTorrent(
    release: Release,
    torrents: TorrentInfo[]
  ): TorrentMatchResult | null {
    // Priority 1: Exact hash match (most reliable)
    if (release.torrentHash) {
      const hashMatch = torrents.find(
        t => t.hash.toLowerCase() === release.torrentHash!.toLowerCase()
      );
      if (hashMatch) {
        return {
          torrent: hashMatch,
          confidence: 'exact',
          matchMethod: 'hash'
        };
      }
      // Hash was stored but torrent not found - it may have been removed
      logger.debug(`Release ${release.id} has hash ${release.torrentHash} but torrent not found in qBittorrent`);
    }

    // Priority 2: Tag-based match (high confidence)
    // We tag torrents with "game-{gameId}" when adding them
    const tagMatches = torrents.filter(t => {
      const gameId = this.parseGameIdFromTags(t.tags);
      return gameId === release.gameId;
    });

    if (tagMatches.length === 1) {
      // Single match by game ID tag - high confidence
      return {
        torrent: tagMatches[0],
        confidence: 'high',
        matchMethod: 'tag'
      };
    } else if (tagMatches.length > 1) {
      // Multiple torrents for same game - need to narrow down by name/size
      const releaseTokens = this.extractKeyTokens(release.title);

      let bestMatch: TorrentInfo | null = null;
      let bestScore = 0;

      for (const torrent of tagMatches) {
        const torrentTokens = this.extractKeyTokens(torrent.name);
        const tokenOverlap = this.calculateTokenOverlap(releaseTokens, torrentTokens);
        const sizeMatches = this.sizesMatch(release.size, torrent.size);

        // Combined score: token overlap + size match bonus
        const score = tokenOverlap + (sizeMatches ? 0.2 : 0);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = torrent;
        }
      }

      if (bestMatch && bestScore >= 0.5) {
        return {
          torrent: bestMatch,
          confidence: 'high',
          matchMethod: 'tag+name'
        };
      }
    }

    // Priority 3: Multi-criteria matching (name similarity + size)
    // Filter to gamearr category first
    const gamearrTorrents = torrents.filter(t => t.category === 'gamearr');

    const releaseTokens = this.extractKeyTokens(release.title);
    let bestMatch: TorrentInfo | null = null;
    let bestScore = 0;
    let bestOverlap = 0;

    for (const torrent of gamearrTorrents) {
      const torrentTokens = this.extractKeyTokens(torrent.name);
      const tokenOverlap = this.calculateTokenOverlap(releaseTokens, torrentTokens);
      const sizeMatches = this.sizesMatch(release.size, torrent.size);

      // Require at least 60% token overlap for name matching
      if (tokenOverlap < 0.6) continue;

      // Calculate combined score
      let score = tokenOverlap;

      // Size match is a significant bonus
      if (sizeMatches) {
        score += 0.3;
      } else if (release.size && release.size > 0) {
        // Size mismatch is a penalty when we have size info
        score -= 0.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestOverlap = tokenOverlap;
        bestMatch = torrent;
      }
    }

    // Require minimum confidence threshold
    if (bestMatch) {
      // Determine confidence level based on score
      let confidence: 'high' | 'medium' | 'low';
      if (bestScore >= 0.9 && bestOverlap >= 0.8) {
        confidence = 'high';
      } else if (bestScore >= 0.7) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      // Only return low confidence matches if we're desperate
      // For now, require at least medium confidence
      if (confidence !== 'low') {
        return {
          torrent: bestMatch,
          confidence,
          matchMethod: `name(${(bestOverlap * 100).toFixed(0)}%)+size`
        };
      }

      logger.debug(
        `Low confidence match for release "${release.title}" -> "${bestMatch.name}" ` +
        `(overlap: ${(bestOverlap * 100).toFixed(0)}%, score: ${bestScore.toFixed(2)})`
      );
    }

    return null;
  }

  /**
   * Extract hash from a magnet link if present.
   * Magnet links contain the hash in the format: magnet:?xt=urn:btih:HASH
   */
  private extractHashFromMagnet(url: string): string | null {
    if (!url.startsWith('magnet:')) return null;

    // URL decode first in case it's encoded
    const decodedUrl = decodeURIComponent(url);

    // Standard hex hash (40 characters)
    const hexMatch = decodedUrl.match(/btih:([a-fA-F0-9]{40})/i);
    if (hexMatch) {
      logger.debug(`Extracted hex hash from magnet: ${hexMatch[1]}`);
      return hexMatch[1].toLowerCase();
    }

    // Base32 encoded hash (32 chars) - common in some magnet links
    const base32Match = decodedUrl.match(/btih:([A-Z2-7]{32})/i);
    if (base32Match) {
      logger.debug(`Extracted base32 hash from magnet: ${base32Match[1]}`);
      // Return as-is; qBittorrent handles both formats
      return base32Match[1].toLowerCase();
    }

    // Try to find hash anywhere after btih: or xt=urn:btih:
    const looseMatch = decodedUrl.match(/(?:btih:|xt=urn:btih:)([a-fA-F0-9]{40}|[A-Z2-7]{32})/i);
    if (looseMatch) {
      logger.debug(`Extracted hash (loose match) from magnet: ${looseMatch[1]}`);
      return looseMatch[1].toLowerCase();
    }

    logger.debug(`Could not extract hash from magnet URL`);
    return null;
  }

  /**
   * Try to find and store the torrent hash after adding a torrent.
   * Uses multiple strategies with retries.
   */
  private async tryFindAndStoreHash(
    releaseId: number,
    releaseName: string,
    releaseSize: number,
    gameId: number,
    downloadUrl: string
  ): Promise<string | null> {
    try {
      // Strategy 1: Extract hash directly from magnet link (instant, most reliable)
      const isMagnet = downloadUrl.startsWith('magnet:');
      logger.debug(`Hash lookup for release ${releaseId}: URL type=${isMagnet ? 'magnet' : 'http'}`);

      const magnetHash = this.extractHashFromMagnet(downloadUrl);
      if (magnetHash) {
        await releaseRepository.update(releaseId, { torrentHash: magnetHash });
        logger.info(`Stored torrent hash ${magnetHash} for release ${releaseId} (from magnet)`);
        return magnetHash;
      }

      if (isMagnet) {
        logger.warn(`Magnet link found but hash extraction failed for release ${releaseId}`);
        logger.debug(`Magnet URL: ${downloadUrl.substring(0, 100)}...`);
      }

      // Strategy 2: Poll qBittorrent with retries for .torrent file URLs
      const category = await settingsService.getQBittorrentCategory();
      const addedAfter = new Date(Date.now() - TORRENT_DISCOVERY_LOOKBACK_MS);

      for (let attempt = 0; attempt < TORRENT_DISCOVERY_MAX_RETRIES; attempt++) {
        await new Promise(resolve => setTimeout(resolve, TORRENT_DISCOVERY_DELAYS_MS[attempt]));

        const torrents = await qbittorrentClient.getTorrents();

        // Filter to our category and recently added
        const categoryTorrents = torrents.filter(t => t.category === category);
        const recentInCategory = categoryTorrents
          .filter(t => t.addedOn > addedAfter)
          .sort((a, b) => b.addedOn.getTime() - a.addedOn.getTime());

        if (attempt === 0) {
          logger.debug(`qBittorrent: ${torrents.length} total, ${categoryTorrents.length} in "${category}", ${recentInCategory.length} recent`);
          recentInCategory.slice(0, 3).forEach(t => {
            logger.debug(`  Recent: "${t.name.substring(0, 50)}" added=${t.addedOn.toISOString()}`);
          });
        }

        // Strategy 2a: Tag-based matching (if tags are available)
        const tagMatch = torrents.find(t => {
          const tagGameId = this.parseGameIdFromTags(t.tags);
          return tagGameId === gameId;
        });
        if (tagMatch) {
          await releaseRepository.update(releaseId, { torrentHash: tagMatch.hash });
          logger.info(`Stored hash ${tagMatch.hash} for release ${releaseId} (via tag match)`);
          return tagMatch.hash;
        }

        // Strategy 2b: Name matching within our category (most reliable for .torrent files)
        const releaseTokens = this.extractKeyTokens(releaseName);
        for (const torrent of recentInCategory) {
          const torrentTokens = this.extractKeyTokens(torrent.name);
          const overlap = this.calculateTokenOverlap(releaseTokens, torrentTokens);

          if (overlap >= 0.5) { // Lower threshold since we're already filtered by category+time
            await releaseRepository.update(releaseId, { torrentHash: torrent.hash });
            logger.info(`Stored hash ${torrent.hash} for release ${releaseId} (name match ${(overlap*100).toFixed(0)}%, attempt ${attempt + 1})`);
            return torrent.hash;
          }
        }

        // Strategy 2c: If only one recent torrent in category, assume it's ours
        if (recentInCategory.length === 1) {
          const match = recentInCategory[0];
          await releaseRepository.update(releaseId, { torrentHash: match.hash });
          logger.info(`Stored hash ${match.hash} for release ${releaseId} (only recent in category, attempt ${attempt + 1})`);
          return match.hash;
        }

        logger.debug(`Hash lookup attempt ${attempt + 1}/${TORRENT_DISCOVERY_MAX_RETRIES} failed for release ${releaseId}, retrying...`);
      }

      logger.warn(`Could not find torrent hash for release ${releaseId} after ${TORRENT_DISCOVERY_MAX_RETRIES} attempts`);
      return null;
    } catch (error) {
      logger.error(`Failed to find/store hash for release ${releaseId}:`, error);
      return null;
    }
  }

  /**
   * Grab a release and send it to the appropriate download client
   */
  async grabRelease(
    gameId: number,
    release: ScoredRelease
  ): Promise<GrabReleaseResult> {
    const protocol = release.protocol || 'torrent';

    // Check the appropriate client is configured
    if (protocol === 'usenet') {
      if (!sabnzbdClient.isConfigured()) {
        throw new NotConfiguredError('SABnzbd');
      }
    } else {
      if (!qbittorrentClient.isConfigured()) {
        throw new NotConfiguredError('qBittorrent');
      }
    }

    // Check if dry-run mode is enabled
    const isDryRun = await settingsService.getDryRun();

    logger.info(`${isDryRun ? '[DRY-RUN] ' : ''}Grabbing ${protocol} release: ${release.title} for game ID ${gameId}`);

    // Get game info
    const game = await gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game', gameId);
    }

    // Get category from the appropriate client
    let category: string;
    if (protocol === 'usenet') {
      category = await settingsService.getSabnzbdCategory();
    } else {
      category = await settingsService.getQBittorrentCategory();
      if (game.libraryId) {
        const library = await libraryService.getLibrary(game.libraryId);
        if (library?.downloadCategory) {
          category = library.downloadCategory;
        }
      }
    }
    const tags = `gamearr,game-${gameId}`;

    if (isDryRun) {
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('[DRY-RUN] Download Details:');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`Game: ${game.title} (${game.year})`);
      logger.info(`Release: ${release.title}`);
      logger.info(`Protocol: ${protocol}`);
      logger.info(`Indexer: ${release.indexer}`);
      logger.info(`Quality: ${release.quality || 'N/A'}`);
      logger.info(`Size: ${(release.size / (1024 * 1024 * 1024)).toFixed(2)} GB`);
      logger.info(`Seeders: ${release.seeders}`);
      logger.info(`Match Confidence: ${release.matchConfidence}`);
      logger.info(`Quality Score: ${release.score}`);
      logger.info(`Download URL: ${release.downloadUrl}`);
      logger.info(`Category: ${category}`);
      logger.info(`Tags: ${tags}`);
      logger.info('═══════════════════════════════════════════════════════');

      return { releaseId: -1 };
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
      protocol,
      downloadClient: protocol === 'usenet' ? 'sabnzbd' : 'qbittorrent',
      grabbedAt: new Date(),
      status: 'pending',
    };

    const createdRelease = await releaseRepository.create(newRelease);

    try {
      if (protocol === 'usenet') {
        // Send to SABnzbd
        const nzoId = await sabnzbdClient.addNzb(release.downloadUrl, { category });

        // Store the nzo_id for reliable future matching
        await releaseRepository.update(createdRelease.id, { downloadId: nzoId });
      } else {
        // Send to qBittorrent (existing torrent flow)
        const fallbackUrl = release.magnetUrl && release.magnetUrl !== release.downloadUrl
          ? release.magnetUrl : undefined;

        const prowlarrApiKey = await settingsService.getSetting('prowlarr_api_key');
        const fetchHeaders: Record<string, string> = {};
        if (prowlarrApiKey) {
          fetchHeaders['X-Api-Key'] = prowlarrApiKey;
        }

        await qbittorrentClient.addTorrent(release.downloadUrl, {
          category,
          tags,
          paused: 'false',
        }, fallbackUrl, fetchHeaders);

        // Try to find and store the torrent hash asynchronously
        this.tryFindAndStoreHash(
          createdRelease.id,
          release.title,
          release.size,
          gameId,
          release.downloadUrl
        ).catch(err => logger.error('Background hash storage failed:', err));
      }

      // Update release status to downloading
      await releaseRepository.updateStatus(createdRelease.id, 'downloading');

      // Update game status to downloading
      await gameRepository.update(gameId, { status: 'downloading' });

      logger.info(`Release grabbed successfully (${protocol}): ${release.title}`);

      return { releaseId: createdRelease.id };
    } catch (error) {
      await releaseRepository.updateStatus(createdRelease.id, 'failed');
      throw error;
    }
  }

  /**
   * Sync usenet download status from SABnzbd
   */
  async syncUsenetDownloadStatus() {
    if (!sabnzbdClient.isConfigured()) return;

    try {
      const downloads = await sabnzbdClient.getAllDownloads();
      const activeReleases = await releaseRepository.findActiveDownloads();

      // Filter to usenet releases only
      const usenetReleases = activeReleases.filter(
        r => r.downloadClient === 'sabnzbd'
      );

      const releaseStatusUpdates: Array<{
        id: number;
        status: 'pending' | 'downloading' | 'completed' | 'failed';
      }> = [];
      const gameIdsToMarkDownloaded: number[] = [];
      const completedReleases: string[] = [];

      for (const release of usenetReleases) {
        // Match by stored downloadId (nzo_id)
        const match = downloads.find(d => d.id === release.downloadId);
        if (!match) {
          logger.debug(`No SABnzbd match found for release ${release.id}: "${release.title}"`);
          continue;
        }

        let newStatus: 'pending' | 'downloading' | 'completed' | 'failed' = 'downloading';

        if (match.status === 'Completed' || match.progress >= 1) {
          newStatus = 'completed';
          if (release.status !== 'completed') {
            completedReleases.push(release.title);
            gameIdsToMarkDownloaded.push(release.gameId);
          }
        } else if (match.status === 'Failed') {
          newStatus = 'failed';
        }

        if (release.status !== newStatus) {
          releaseStatusUpdates.push({ id: release.id, status: newStatus });
        }
      }

      for (const completed of completedReleases) {
        logger.info(`Usenet download completed: ${completed}`);
      }

      if (releaseStatusUpdates.length > 0) {
        await releaseRepository.batchUpdateStatus(releaseStatusUpdates);
      }

      await this.handleCompletedGames(gameIdsToMarkDownloaded);
    } catch (error) {
      // Rethrow to let DownloadMonitor handle connection state tracking
      throw error;
    }
  }

  /**
   * Get all active downloads (unified: torrents + usenet)
   * Filters to configured category and optionally includes completed downloads
   */
  async getActiveDownloads(includeCompleted: boolean = false) {
    const results: Array<{
      hash?: string;
      id?: string;
      name: string;
      size: number;
      progress: number;
      downloadSpeed: number;
      eta: number | string;
      state?: string;
      status?: string;
      category: string;
      tags?: string;
      savePath?: string;
      addedOn?: Date;
      completionOn?: Date;
      gameId: number | null;
      client: 'qbittorrent' | 'sabnzbd';
    }> = [];

    // Fetch from both clients concurrently
    const fetchTorrents = async () => {
      if (!qbittorrentClient.isConfigured()) return;
      try {
        const [torrents, categoryFilter] = await Promise.all([
          qbittorrentClient.getTorrents(),
          settingsService.getQBittorrentCategory(),
        ]);

        const filteredTorrents = torrents.filter((torrent) => {
          const isInCategory = !categoryFilter ||
            torrent.category === categoryFilter ||
            torrent.category.startsWith(categoryFilter + '/');
          const isCompleted = torrent.progress >= 1;
          return isInCategory && (includeCompleted || !isCompleted);
        });

        for (const torrent of filteredTorrents) {
          results.push({
            hash: torrent.hash,
            name: torrent.name,
            size: torrent.size,
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            eta: torrent.eta,
            state: torrent.state,
            category: torrent.category,
            tags: torrent.tags,
            savePath: torrent.savePath,
            addedOn: torrent.addedOn,
            completionOn: torrent.completionOn,
            gameId: this.parseGameIdFromTags(torrent.tags),
            client: 'qbittorrent',
          });
        }
      } catch (error) {
        logger.error('Failed to get torrent downloads:', error);
      }
    };

    const fetchUsenet = async () => {
      if (!sabnzbdClient.isConfigured()) return;
      try {
        const [sabCategory, nzbDownloads, activeReleases] = await Promise.all([
          settingsService.getSabnzbdCategory(),
          sabnzbdClient.getAllDownloads(),
          releaseRepository.findActiveDownloads(),
        ]);

        const filteredNzbs = nzbDownloads.filter((nzb) => {
          const isInCategory = !sabCategory || nzb.category === sabCategory;
          const isCompleted = nzb.progress >= 1;
          return isInCategory && (includeCompleted || !isCompleted);
        });

        // Look up game IDs from release records for usenet downloads
        const nzoIdToGameId = new Map<string, number>();
        for (const release of activeReleases) {
          if (release.downloadClient === 'sabnzbd' && release.downloadId) {
            nzoIdToGameId.set(release.downloadId, release.gameId);
          }
        }

        for (const nzb of filteredNzbs) {
          results.push({
            id: nzb.id,
            name: nzb.name,
            size: nzb.size,
            progress: nzb.progress,
            downloadSpeed: nzb.downloadSpeed,
            eta: nzb.eta,
            status: nzb.status,
            category: nzb.category,
            savePath: nzb.savePath,
            completionOn: nzb.completionOn,
            gameId: nzoIdToGameId.get(nzb.id) ?? null,
            client: 'sabnzbd',
          });
        }
      } catch (error) {
        logger.error('Failed to get usenet downloads:', error);
      }
    };

    await Promise.all([fetchTorrents(), fetchUsenet()]);

    logger.info(`getActiveDownloads: returning ${results.length} downloads`);
    return results;
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
  async cancelDownload(id: string, deleteFiles: boolean = false, client?: 'qbittorrent' | 'sabnzbd') {
    logger.info(`Cancelling download: ${id} (client: ${client || 'auto'})`);

    try {
      if (client === 'sabnzbd') {
        await sabnzbdClient.deleteDownload(id, deleteFiles);
      } else {
        await qbittorrentClient.deleteTorrents([id], deleteFiles);
      }

      // Update release status in database
      let release;
      if (client === 'sabnzbd') {
        const activeReleases = await releaseRepository.findActiveDownloads();
        release = activeReleases.find(r => r.downloadId === id);
      } else {
        release = await releaseRepository.findByTorrentHash(id);
      }

      if (release) {
        await releaseRepository.updateStatus(release.id, 'failed');
        logger.info(`Updated release ${release.id} status to failed`);
      }

      logger.info('Download cancelled successfully');
    } catch (error) {
      logger.error('Failed to cancel download:', error);
      throw error;
    }
  }

  /**
   * Pause a download
   */
  async pauseDownload(id: string, client?: 'qbittorrent' | 'sabnzbd') {
    try {
      if (client === 'sabnzbd') {
        await sabnzbdClient.pauseDownload(id);
      } else {
        await qbittorrentClient.pauseTorrents([id]);
      }
      logger.info(`Download paused: ${id}`);
    } catch (error) {
      logger.error('Failed to pause download:', error);
      throw error;
    }
  }

  /**
   * Resume a download
   */
  async resumeDownload(id: string, client?: 'qbittorrent' | 'sabnzbd') {
    try {
      if (client === 'sabnzbd') {
        await sabnzbdClient.resumeDownload(id);
      } else {
        await qbittorrentClient.resumeTorrents([id]);
      }
      logger.info(`Download resumed: ${id}`);
    } catch (error) {
      logger.error('Failed to resume download:', error);
      throw error;
    }
  }

  /**
   * Pause all downloads across both clients
   */
  async pauseAllDownloads() {
    try {
      const promises: Promise<void>[] = [];
      if (qbittorrentClient.isConfigured()) {
        promises.push(qbittorrentClient.pauseTorrents(['all']));
      }
      if (sabnzbdClient.isConfigured()) {
        promises.push(sabnzbdClient.pauseQueue());
      }
      await Promise.all(promises);
      logger.info('All downloads paused');
    } catch (error) {
      logger.error('Failed to pause all downloads:', error);
      throw error;
    }
  }

  /**
   * Resume all downloads across both clients
   */
  async resumeAllDownloads() {
    try {
      const promises: Promise<void>[] = [];
      if (qbittorrentClient.isConfigured()) {
        promises.push(qbittorrentClient.resumeTorrents(['all']));
      }
      if (sabnzbdClient.isConfigured()) {
        promises.push(sabnzbdClient.resumeQueue());
      }
      await Promise.all(promises);
      logger.info('All downloads resumed');
    } catch (error) {
      logger.error('Failed to resume all downloads:', error);
      throw error;
    }
  }

  /**
   * Link torrents to a game by folder path
   * Finds torrents whose save path matches and adds the game tag
   */
  async linkTorrentsToGame(folderPath: string, gameId: number): Promise<number> {
    if (!qbittorrentClient.isConfigured()) {
      logger.debug('qBittorrent not configured, skipping torrent linking');
      return 0;
    }

    try {
      const matchingTorrents = await qbittorrentClient.findTorrentsByPath(folderPath);

      if (matchingTorrents.length === 0) {
        logger.debug(`No torrents found matching path: ${folderPath}`);
        return 0;
      }

      // Filter out torrents that already have a game tag
      const torrentsToTag = matchingTorrents.filter((torrent) => {
        const existingGameId = this.parseGameIdFromTags(torrent.tags);
        return existingGameId === null;
      });

      if (torrentsToTag.length === 0) {
        logger.debug(`All matching torrents already have game tags`);
        return 0;
      }

      const hashes = torrentsToTag.map((t) => t.hash);
      const tag = `game-${gameId}`;

      await qbittorrentClient.addTags(hashes, tag);
      logger.info(`Linked ${hashes.length} torrent(s) to game ${gameId}: ${hashes.join(', ')}`);

      return hashes.length;
    } catch (error) {
      logger.error('Failed to link torrents to game:', error);
      // Don't throw - this is a non-critical operation
      return 0;
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

      // Only sync torrent releases here; usenet releases are handled by syncUsenetDownloadStatus().
      // Null downloadClient preserves backwards compat for releases created before the column existed.
      const torrentReleases = activeReleases.filter(
        r => r.downloadClient === 'qbittorrent' || r.downloadClient === null
      );

      // Collect updates to perform in batch
      const releaseStatusUpdates: Array<{
        id: number;
        status: 'pending' | 'downloading' | 'completed' | 'failed';
        torrentHash?: string;
      }> = [];
      const gameIdsToMarkDownloaded: number[] = [];
      const completedReleases: string[] = [];

      for (const release of torrentReleases) {
        // Use robust multi-criteria matching algorithm
        const matchResult = this.findMatchingTorrent(release, torrents);

        if (!matchResult) {
          // No confident match found - log for debugging
          logger.debug(`No torrent match found for release ${release.id}: "${release.title}"`);
          continue;
        }

        const { torrent, confidence, matchMethod } = matchResult;

        // Log match details for transparency
        if (confidence !== 'exact') {
          logger.debug(
            `Matched release ${release.id} to torrent "${torrent.name}" ` +
            `(confidence: ${confidence}, method: ${matchMethod})`
          );
        }

        // If we matched but don't have the hash stored, store it now
        if (!release.torrentHash && torrent.hash) {
          releaseStatusUpdates.push({
            id: release.id,
            status: release.status as 'pending' | 'downloading' | 'completed' | 'failed',
            torrentHash: torrent.hash
          });
        }

        // Determine new status based on torrent state
        let newStatus: 'pending' | 'downloading' | 'completed' | 'failed' = 'downloading';

        if (torrent.progress >= 1) {
          newStatus = 'completed';

          // Queue game status update when download completes
          if (release.status !== 'completed') {
            completedReleases.push(release.title);
            gameIdsToMarkDownloaded.push(release.gameId);
          }
        } else if (torrent.state === 'error') {
          newStatus = 'failed';
        }

        if (release.status !== newStatus) {
          // Find existing update or create new one
          const existingUpdate = releaseStatusUpdates.find(u => u.id === release.id);
          if (existingUpdate) {
            existingUpdate.status = newStatus;
          } else {
            releaseStatusUpdates.push({ id: release.id, status: newStatus });
          }
        }
      }

      // Log completed releases
      for (const completed of completedReleases) {
        logger.info(`Download completed: ${completed}`);
      }

      // Update releases (status and/or hash)
      // Separate updates that need torrentHash from status-only updates
      const hashUpdates = releaseStatusUpdates.filter(u => u.torrentHash);
      const statusOnlyUpdates = releaseStatusUpdates.filter(u => !u.torrentHash);

      // Updates with torrentHash must be done individually (different data per record)
      for (const update of hashUpdates) {
        await releaseRepository.update(update.id, {
          status: update.status,
          torrentHash: update.torrentHash
        });
      }

      // Status-only updates can be batched efficiently
      if (statusOnlyUpdates.length > 0) {
        await releaseRepository.batchUpdateStatus(statusOnlyUpdates);
      }

      await this.handleCompletedGames(gameIdsToMarkDownloaded);
    } catch (error) {
      // Rethrow to let DownloadMonitor handle connection state tracking
      throw error;
    }
  }

  /**
   * Assign libraries to games that don't have one yet
   * Uses platform matching when possible, falls back to default library
   */
  private async assignLibrariesToGames(gameIds: number[]): Promise<void> {
    try {
      const games = await gameRepository.findByIds(gameIds);

      for (const [, game] of games) {
        // Skip if already assigned to a library
        if (game.libraryId) {
          continue;
        }

        // Find appropriate library based on platform
        const library = await libraryService.getLibraryForGame(game.platform);
        if (library) {
          await gameRepository.update(game.id, { libraryId: library.id });
          logger.info(`Assigned game "${game.title}" to library "${library.name}"`);
        } else {
          logger.debug(`No library available for game "${game.title}" (platform: ${game.platform || 'unknown'})`);
        }
      }
    } catch (error) {
      logger.error('Failed to assign libraries to games:', error);
    }
  }

  /**
   * Send Discord notifications for completed downloads
   */
  private async sendDownloadCompleteNotifications(gameIds: number[]): Promise<void> {
    try {
      const games = await gameRepository.findByIds(gameIds);

      for (const [, game] of games) {
        try {
          await discordClient.notifyDownloadComplete({
            gameTitle: game.title,
            coverUrl: game.coverUrl || undefined,
            store: game.store || undefined,
          });
        } catch (error) {
          // Log but don't fail the whole sync if notification fails
          logger.error(`Failed to send Discord notification for game "${game.title}":`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to send download complete notifications:', error);
    }
  }

  /**
   * Handle post-completion tasks for downloaded games:
   * mark as downloaded, assign libraries, send notifications.
   */
  private async handleCompletedGames(gameIds: number[]): Promise<void> {
    const uniqueGameIds = [...new Set(gameIds)];
    if (uniqueGameIds.length === 0) return;

    await gameRepository.batchUpdateStatus(uniqueGameIds, 'downloaded');
    await this.assignLibrariesToGames(uniqueGameIds);

    if (discordClient.isConfigured()) {
      await this.sendDownloadCompleteNotifications(uniqueGameIds);
    }
  }

  /**
   * Test qBittorrent connection
   */
  async testConnection(): Promise<boolean> {
    return qbittorrentClient.testConnection();
  }

  /**
   * Test SABnzbd connection
   */
  async testSabnzbdConnection(): Promise<boolean> {
    return sabnzbdClient.testConnection();
  }
}

// Singleton instance
export const downloadService = new DownloadService();
