import { gameRepository } from '../../repositories/GameRepository';
import { igdbClient } from '../../integrations/igdb/IGDBClient';
import { logger } from '../../utils/logger';
import type { HandlerRegistration, TaskHandler } from '../types';

interface MetadataRefreshPayload {
  gameId: number;
}

const handler: TaskHandler = async ({ payload }) => {
  const { gameId } = payload as MetadataRefreshPayload;
  if (typeof gameId !== 'number') {
    throw new Error(`Invalid payload: expected { gameId: number }, got ${JSON.stringify(payload)}`);
  }

  if (!igdbClient.isConfigured()) {
    // Throw so the task is retried later. Backoff will rate-limit polling.
    throw new Error('IGDB not configured');
  }

  const game = await gameRepository.findById(gameId);
  if (!game) {
    // Game was deleted; nothing to do, treat as success to avoid retry loop.
    logger.debug(`metadata.refresh: game ${gameId} no longer exists, skipping`);
    return;
  }

  const igdbGame = await igdbClient.getGame(game.igdbId);
  if (!igdbGame) {
    logger.warn(`metadata.refresh: IGDB returned no data for ${game.title} (${game.igdbId})`);
    return;
  }

  await gameRepository.update(game.id, {
    summary: igdbGame.summary || null,
    genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
    totalRating: igdbGame.totalRating || null,
    developer: igdbGame.developer || null,
    publisher: igdbGame.publisher || null,
    gameModes: igdbGame.gameModes ? JSON.stringify(igdbGame.gameModes) : null,
    similarGames: igdbGame.similarGames ? JSON.stringify(igdbGame.similarGames) : null,
  });
  logger.info(`metadata.refresh: updated ${game.title}`);
};

export const metadataRefreshHandler: HandlerRegistration = {
  kind: 'metadata.refresh',
  handler,
  // IGDB rate limit ≈ 4 req/s. Sequential is safe.
  concurrency: 1,
  timeoutSec: 60,
};
