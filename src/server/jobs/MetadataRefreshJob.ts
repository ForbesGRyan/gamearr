import { gameRepository } from '../repositories/GameRepository';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { logger } from '../utils/logger';

/**
 * Background job to fetch metadata for games that are missing it.
 * Runs periodically to backfill metadata for games added before the metadata feature.
 */
export class MetadataRefreshJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Start the metadata refresh job
   * @param intervalMs How often to check for games needing metadata (default: 5 minutes)
   */
  start(intervalMs: number = 5 * 60 * 1000) {
    logger.info('Starting MetadataRefreshJob...');

    // Run immediately on startup
    this.refreshMetadata();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.refreshMetadata();
    }, intervalMs);
  }

  /**
   * Stop the job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('MetadataRefreshJob stopped');
    }
  }

  /**
   * Find games missing metadata and fetch it from IGDB
   */
  private async refreshMetadata() {
    if (this.isRunning) {
      logger.debug('MetadataRefreshJob already running, skipping');
      return;
    }

    if (!igdbClient.isConfigured()) {
      logger.debug('IGDB not configured, skipping metadata refresh');
      return;
    }

    this.isRunning = true;

    try {
      // Get all games
      const allGames = await gameRepository.findAll();

      // Filter to games missing metadata (no summary means metadata wasn't fetched)
      const gamesNeedingMetadata = allGames.filter(
        (game) => game.summary === null && game.igdbId
      );

      if (gamesNeedingMetadata.length === 0) {
        logger.debug('No games need metadata refresh');
        this.isRunning = false;
        return;
      }

      logger.info(`Found ${gamesNeedingMetadata.length} games needing metadata refresh`);

      // Process games one at a time to avoid rate limiting
      for (const game of gamesNeedingMetadata) {
        try {
          logger.info(`Fetching metadata for: ${game.title} (IGDB ID: ${game.igdbId})`);

          const igdbGame = await igdbClient.getGame(game.igdbId);

          if (!igdbGame) {
            logger.warn(`Game not found on IGDB: ${game.title} (ID: ${game.igdbId})`);
            continue;
          }

          // Update game with metadata
          await gameRepository.update(game.id, {
            summary: igdbGame.summary || null,
            genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
            totalRating: igdbGame.totalRating || null,
            developer: igdbGame.developer || null,
            publisher: igdbGame.publisher || null,
            gameModes: igdbGame.gameModes ? JSON.stringify(igdbGame.gameModes) : null,
            similarGames: igdbGame.similarGames
              ? JSON.stringify(igdbGame.similarGames)
              : null,
          });

          logger.info(`Updated metadata for: ${game.title}`);

          // Small delay between requests to be nice to the API
          await this.delay(500);
        } catch (error) {
          logger.error(`Failed to fetch metadata for ${game.title}:`, error);
          // Continue with next game
        }
      }

      logger.info('Metadata refresh complete');
    } catch (error) {
      logger.error('MetadataRefreshJob error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const metadataRefreshJob = new MetadataRefreshJob();
