import { gameRepository, type PaginationParams, type PaginatedResult } from '../repositories/GameRepository';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { indexerService } from './IndexerService';
import { downloadService } from './DownloadService';
import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import type { Game, NewGame } from '../db/schema';
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
  async addGameFromIGDB(igdbId: number, monitored: boolean = true, store?: string | null, libraryId?: number, status?: 'wanted' | 'downloading' | 'downloaded'): Promise<Game> {
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

    // Create new game entry with metadata
    const newGame: NewGame = {
      igdbId: igdbGame.igdbId,
      title: igdbGame.title,
      year: igdbGame.year,
      platform: igdbGame.platforms?.[0] || 'PC',
      store: store || null,
      monitored: shouldMonitor,
      status: gameStatus,
      coverUrl: igdbGame.coverUrl,
      folderPath: null,
      libraryId: libraryId || null,
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
   */
  async deleteGame(id: number): Promise<void> {
    const deleted = await gameRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Game', id);
    }

    logger.info(`Game deleted: ${id}`);
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
}

// Singleton instance
export const gameService = new GameService();
