import { gameRepository, type PaginationParams, type PaginatedResult } from '../repositories/GameRepository';
import { igdbClient } from '../integrations/igdb/IGDBClient';
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
   */
  async addGameFromIGDB(igdbId: number, monitored: boolean = true, store?: string | null): Promise<Game> {
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

    // If store is specified, user already owns it - no need to download or monitor
    const hasStore = !!store;
    const gameStatus = hasStore ? 'downloaded' : 'wanted';
    const shouldMonitor = hasStore ? false : monitored;

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

    return game;
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
