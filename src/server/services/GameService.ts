import { gameRepository, type PaginationParams, type PaginatedResult } from '../repositories/GameRepository';
import { releaseRepository } from '../repositories/ReleaseRepository';
import { downloadHistoryRepository } from '../repositories/DownloadHistoryRepository';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { indexerService } from './IndexerService';
import { downloadService } from './DownloadService';
import { settingsService } from './SettingsService';
import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import type { Game, NewGame, Release, DownloadHistory } from '../db/schema';
import type { GameSearchResult } from '../integrations/igdb/types';
import { logger } from '../utils/logger';
import { NotConfiguredError, NotFoundError, ConflictError } from '../utils/errors';

export class GameService {
  /**
   * Normalize search query for better fuzzy matching
   * Handles: periods, underscores, multiple spaces, etc.
   */
  private normalizeSearchQuery(query: string): string {
    return query
      .replace(/[._-]/g, ' ')      // Replace periods, underscores, hyphens with spaces
      .replace(/\s+/g, ' ')         // Collapse multiple spaces into one
      .trim();                       // Remove leading/trailing whitespace
  }

  /**
   * Search for games on IGDB
   */
  async searchIGDB(query: string): Promise<GameSearchResult[]> {
    if (!igdbClient.isConfigured()) {
      throw new NotConfiguredError('IGDB');
    }

    // Normalize query for better fuzzy matching
    const normalizedQuery = this.normalizeSearchQuery(query);
    logger.info(`Searching IGDB: "${query}" → normalized: "${normalizedQuery}"`);

    return igdbClient.searchGames({ search: normalizedQuery, limit: 20 });
  }

  /**
   * Get all games from library (non-paginated)
   */
  async getAllGames(): Promise<Game[]> {
    return gameRepository.findAll();
  }

  /**
   * Get games with pagination
   */
  async getGamesPaginated(params: PaginationParams = {}): Promise<PaginatedResult<Game>> {
    return gameRepository.findAllPaginated(params);
  }

  /**
   * Get game by ID
   */
  async getGameById(id: number): Promise<Game | undefined> {
    return gameRepository.findById(id);
  }

  /**
   * Get monitored games
   */
  async getMonitoredGames(): Promise<Game[]> {
    return gameRepository.findMonitored();
  }

  /**
   * Add a game to the library from IGDB
   * If store is specified, assumes user owns the game (status: downloaded, monitored: false)
   * If no store, assumes user wants to download it (status: wanted, monitored: true)
   * libraryId can be specified to assign the game to a specific library
   */
  async addGameFromIGDB(igdbId: number, monitored: boolean = true, store?: string | null, libraryId?: number, status?: 'wanted' | 'downloading' | 'downloaded', platform?: string): Promise<Game> {
    // Check if game already exists
    const existing = await gameRepository.findByIgdbId(igdbId);
    if (existing) {
      throw new ConflictError('Game already exists in library');
    }

    // Fetch game details from IGDB
    const igdbGame = await igdbClient.getGame(igdbId);
    if (!igdbGame) {
      throw new NotFoundError('IGDB game', igdbId);
    }

    logger.info(`Adding game to library: ${igdbGame.title}`);

    // Determine status: explicit status > store-based status > default 'wanted'
    const hasStore = !!store;
    const gameStatus = status || (hasStore ? 'downloaded' : 'wanted');
    // If status is 'downloaded' or store is set, default monitored to false
    const shouldMonitor = (status === 'downloaded' || hasStore) ? false : monitored;

    if (hasStore) {
      logger.info(`Game has store (${store}) - setting status to 'downloaded' and monitored to false`);
    }

    // Get the default update policy from settings
    const defaultUpdatePolicy = await settingsService.getSetting('default_update_policy') as 'notify' | 'auto' | 'ignore' | null;

    // Create new game entry with metadata
    const newGame: NewGame = {
      igdbId: igdbGame.igdbId,
      title: igdbGame.title,
      slug: this.generateSlug(igdbGame.title),
      year: igdbGame.year,
      platform: platform || igdbGame.platforms?.[0] || 'PC',
      store: store || null,
      monitored: shouldMonitor,
      status: gameStatus,
      coverUrl: igdbGame.coverUrl,
      folderPath: null,
      libraryId: libraryId || null,
      updatePolicy: defaultUpdatePolicy || 'notify',
      // Metadata from IGDB
      summary: igdbGame.summary || null,
      genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
      totalRating: igdbGame.totalRating || null,
      developer: igdbGame.developer || null,
      publisher: igdbGame.publisher || null,
      gameModes: igdbGame.gameModes ? JSON.stringify(igdbGame.gameModes) : null,
      similarGames: igdbGame.similarGames
        ? JSON.stringify(igdbGame.similarGames)
        : null,
    };

    const game = await gameRepository.create(newGame);

    logger.info(`Game added successfully: ${game.title} (ID: ${game.id}, Status: ${gameStatus})`);

    // If the game is wanted and monitored, trigger an immediate search (fire and forget)
    if (game.status === 'wanted' && game.monitored) {
      this.triggerAutoSearch(game).catch((err) => {
        logger.error(`Auto-search failed for ${game.title}:`, err);
      });
    }

    return game;
  }

  /**
   * Trigger an immediate search for a game and auto-grab if criteria are met
   * This is called asynchronously after adding a new game
   */
  private async triggerAutoSearch(game: Game): Promise<void> {
    // Check if Prowlarr is configured
    if (!prowlarrClient.isConfigured()) {
      logger.debug(`Skipping auto-search for ${game.title}: Prowlarr not configured`);
      return;
    }

    logger.info(`Triggering immediate search for newly added game: ${game.title}`);

    try {
      // Search for releases
      const releases = await indexerService.searchForGame(game);

      if (releases.length === 0) {
        logger.info(`No releases found for ${game.title}`);
        return;
      }

      // Find the best release that meets auto-grab criteria
      let bestRelease = null;
      for (const release of releases) {
        if (await indexerService.shouldAutoGrab(release)) {
          bestRelease = release;
          break;
        }
      }

      if (!bestRelease) {
        logger.info(
          `No releases meet auto-grab criteria for ${game.title} (best score: ${releases[0]?.score || 0})`
        );
        return;
      }

      logger.info(
        `Auto-grabbing release for ${game.title}: ${bestRelease.title} (score: ${bestRelease.score})`
      );

      // Grab the release
      await downloadService.grabRelease(game.id, bestRelease);
      logger.info(`Successfully auto-grabbed ${bestRelease.title} for ${game.title}`);
    } catch (error) {
      logger.error(`Error during auto-search for ${game.title}:`, error);
    }
  }

  /**
   * Update game
   */
  async updateGame(id: number, updates: Partial<NewGame>): Promise<Game> {
    const game = await gameRepository.update(id, updates);
    if (!game) {
      throw new NotFoundError('Game', id);
    }
    return game;
  }

  /**
   * Toggle game monitored status
   */
  async toggleMonitored(id: number): Promise<Game> {
    const game = await gameRepository.findById(id);
    if (!game) {
      throw new NotFoundError('Game', id);
    }

    return this.updateGame(id, { monitored: !game.monitored });
  }

  /**
   * Delete game from library
   * Also removes associated qBittorrent torrents
   */
  async deleteGame(id: number): Promise<void> {
    // First, remove any associated qBittorrent torrents
    const torrentsRemoved = await downloadService.removeTorrentsByGameIds([id]);
    if (torrentsRemoved > 0) {
      logger.info(`Removed ${torrentsRemoved} torrent(s) for game ${id}`);
    }

    const deleted = await gameRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Game', id);
    }

    logger.info(`Game deleted: ${id}`);
  }

  /**
   * Batch update multiple games
   * Returns count of updated games
   */
  async batchUpdate(
    gameIds: number[],
    updates: Partial<Pick<NewGame, 'monitored' | 'status'>>
  ): Promise<{ updated: number }> {
    if (gameIds.length === 0) {
      return { updated: 0 };
    }

    logger.info(`Batch updating ${gameIds.length} games`, { updates });

    // Use batch update for status if provided
    if (updates.status !== undefined) {
      await gameRepository.batchUpdateStatus(gameIds, updates.status);
    }

    // For monitored updates, we need to update individually (no batch method exists)
    // But we can use a single SQL statement via the repository
    if (updates.monitored !== undefined) {
      // Import inArray for batch update
      const { db } = await import('../db');
      const { games } = await import('../db/schema');
      const { inArray } = await import('drizzle-orm');

      await db
        .update(games)
        .set({ monitored: updates.monitored })
        .where(inArray(games.id, gameIds));
    }

    return { updated: gameIds.length };
  }

  /**
   * Batch delete multiple games
   * Also removes associated qBittorrent torrents
   * Returns count of deleted games
   */
  async batchDelete(gameIds: number[]): Promise<{ deleted: number }> {
    if (gameIds.length === 0) {
      return { deleted: 0 };
    }

    logger.info(`Batch deleting ${gameIds.length} games`);

    // First, remove any associated qBittorrent torrents
    const torrentsRemoved = await downloadService.removeTorrentsByGameIds(gameIds);
    if (torrentsRemoved > 0) {
      logger.info(`Removed ${torrentsRemoved} torrent(s) for games: ${gameIds.join(', ')}`);
    }

    // Import for batch delete
    const { db } = await import('../db');
    const { games } = await import('../db/schema');
    const { inArray } = await import('drizzle-orm');

    const result = await db
      .delete(games)
      .where(inArray(games.id, gameIds));

    return { deleted: result.changes || gameIds.length };
  }

  /**
   * Update game status
   */
  async updateGameStatus(
    id: number,
    status: 'wanted' | 'downloading' | 'downloaded'
  ): Promise<Game> {
    return this.updateGame(id, { status });
  }

  /**
   * Rematch a game to a different IGDB entry
   * Updates all metadata from the new IGDB entry while preserving local fields
   */
  async rematchGame(id: number, newIgdbId: number): Promise<Game> {
    const game = await gameRepository.findById(id);
    if (!game) {
      throw new NotFoundError('Game', id);
    }

    // Fetch new game details from IGDB
    const igdbGame = await igdbClient.getGame(newIgdbId);
    if (!igdbGame) {
      throw new NotFoundError('IGDB game', newIgdbId);
    }

    logger.info(`Rematching game "${game.title}" to "${igdbGame.title}" (IGDB ID: ${newIgdbId})`);

    // Update with new IGDB metadata while preserving local fields like status, store, folderPath
    const updates: Partial<NewGame> = {
      igdbId: igdbGame.igdbId,
      title: igdbGame.title,
      slug: this.generateSlug(igdbGame.title),
      year: igdbGame.year,
      coverUrl: igdbGame.coverUrl,
      summary: igdbGame.summary || null,
      genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
      totalRating: igdbGame.totalRating || null,
      developer: igdbGame.developer || null,
      publisher: igdbGame.publisher || null,
      gameModes: igdbGame.gameModes ? JSON.stringify(igdbGame.gameModes) : null,
      similarGames: igdbGame.similarGames ? JSON.stringify(igdbGame.similarGames) : null,
    };

    const updatedGame = await gameRepository.update(id, updates);
    if (!updatedGame) {
      throw new NotFoundError('Game', id);
    }

    logger.info(`Game rematched successfully: ${updatedGame.title}`);
    return updatedGame;
  }

  /**
   * Generate a URL-safe slug from a title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/['']/g, '')           // Remove apostrophes
      .replace(/[:\-–—]/g, ' ')       // Replace colons/dashes with spaces
      .replace(/[^a-z0-9\s]/g, '')    // Remove special characters
      .trim()
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/-+/g, '-');           // Collapse multiple hyphens
  }

  /**
   * Check if a platform string represents a PC platform
   */
  private isPcPlatform(platform: string): boolean {
    const lower = platform.toLowerCase();
    return lower.includes('pc') || lower.includes('windows') || lower === 'microsoft windows';
  }

  /**
   * Find a game by platform and title slug
   * Uses indexed slug column for efficient lookup
   */
  async findByPlatformAndSlug(platform: string, slug: string): Promise<Game | undefined> {
    // Query by slug using the indexed column
    const gamesWithSlug = await gameRepository.findBySlug(slug);

    if (gamesWithSlug.length === 0) {
      return undefined;
    }

    // Normalize platform for comparison
    const normalizedPlatform = platform.toLowerCase().replace(/-/g, ' ');
    const isSearchingForPc = normalizedPlatform === 'pc' || this.isPcPlatform(normalizedPlatform);

    // Find game where platform matches from the slug-matched results
    return gamesWithSlug.find(game => {
      // If searching for PC, match any PC variant
      if (isSearchingForPc) {
        return this.isPcPlatform(game.platform);
      }

      // For other platforms, do flexible matching
      const gamePlatform = game.platform.toLowerCase();
      return gamePlatform === normalizedPlatform ||
        gamePlatform.includes(normalizedPlatform) ||
        normalizedPlatform.includes(gamePlatform);
    });
  }

  /**
   * Get all releases for a game
   */
  async getGameReleases(gameId: number): Promise<Release[]> {
    const game = await gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game', gameId);
    }
    return releaseRepository.findByGameId(gameId);
  }

  /**
   * Get download history for a game
   */
  async getGameHistory(gameId: number): Promise<DownloadHistory[]> {
    const game = await gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game', gameId);
    }
    return downloadHistoryRepository.findByGameId(gameId);
  }

  /**
   * Find game by IGDB ID
   */
  async findByIgdbId(igdbId: number): Promise<Game | undefined> {
    return gameRepository.findByIgdbId(igdbId);
  }

  /**
   * Get all IGDB IDs in the library
   * Returns a Set for efficient lookups
   */
  async getAllIgdbIds(): Promise<Set<number>> {
    const games = await gameRepository.findAll();
    return new Set(games.map(g => g.igdbId));
  }

  /**
   * Get normalized titles for duplicate detection
   * Returns a Set of normalized titles for efficient lookups
   */
  async getNormalizedTitles(): Promise<Set<string>> {
    const games = await gameRepository.findAll();
    return new Set(games.map(g => this.normalizeSearchQuery(g.title).toLowerCase()));
  }

  /**
   * Create game directly (for Steam import and similar use cases)
   * Automatically generates slug if not provided
   */
  async createGame(gameData: NewGame): Promise<Game> {
    // Ensure slug is generated if not provided
    if (!gameData.slug && gameData.title) {
      gameData.slug = this.generateSlug(gameData.title);
    }
    return gameRepository.create(gameData);
  }

  /**
   * Get game count (for health check)
   */
  async getGameCount(): Promise<number> {
    return gameRepository.count();
  }

  /**
   * Get game statistics
   */
  async getGameStats(): Promise<{
    totalGames: number;
    wantedGames: number;
    downloadingGames: number;
    downloadedGames: number;
  }> {
    return gameRepository.getStats();
  }
}

// Singleton instance
export const gameService = new GameService();
