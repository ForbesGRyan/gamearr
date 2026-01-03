import { gameRepository } from '../repositories/GameRepository';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import type { Game, NewGame } from '../db/schema';
import type { GameSearchResult } from '../integrations/igdb/types';
import { logger } from '../utils/logger';

export class GameService {
  /**
   * Search for games on IGDB
   */
  async searchIGDB(query: string): Promise<GameSearchResult[]> {
    if (!igdbClient.isConfigured()) {
      throw new Error('IGDB is not configured. Please add your API credentials in settings.');
    }

    return igdbClient.searchGames({ search: query, limit: 20 });
  }

  /**
   * Get all games from library
   */
  async getAllGames(): Promise<Game[]> {
    return gameRepository.findAll();
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
   */
  async addGameFromIGDB(igdbId: number, monitored: boolean = true): Promise<Game> {
    // Check if game already exists
    const existing = await gameRepository.findByIgdbId(igdbId);
    if (existing) {
      throw new Error('Game already exists in library');
    }

    // Fetch game details from IGDB
    const igdbGame = await igdbClient.getGame(igdbId);
    if (!igdbGame) {
      throw new Error('Game not found on IGDB');
    }

    logger.info(`Adding game to library: ${igdbGame.title}`);

    // Create new game entry
    const newGame: NewGame = {
      igdbId: igdbGame.igdbId,
      title: igdbGame.title,
      year: igdbGame.year,
      platform: igdbGame.platforms?.[0] || 'PC',
      monitored,
      status: 'wanted',
      coverUrl: igdbGame.coverUrl,
      folderPath: null,
    };

    const game = await gameRepository.create(newGame);

    // TODO: Trigger automatic search in Phase 6
    logger.info(`Game added successfully: ${game.title} (ID: ${game.id})`);

    return game;
  }

  /**
   * Update game
   */
  async updateGame(id: number, updates: Partial<NewGame>): Promise<Game> {
    const game = await gameRepository.update(id, updates);
    if (!game) {
      throw new Error('Game not found');
    }
    return game;
  }

  /**
   * Toggle game monitored status
   */
  async toggleMonitored(id: number): Promise<Game> {
    const game = await gameRepository.findById(id);
    if (!game) {
      throw new Error('Game not found');
    }

    return this.updateGame(id, { monitored: !game.monitored });
  }

  /**
   * Delete game from library
   */
  async deleteGame(id: number): Promise<void> {
    const deleted = await gameRepository.delete(id);
    if (!deleted) {
      throw new Error('Game not found');
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
}

// Singleton instance
export const gameService = new GameService();
