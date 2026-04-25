import { gameRepository } from '../../repositories/GameRepository';
import { indexerService } from '../../services/IndexerService';
import { downloadService } from '../../services/DownloadService';
import { logger } from '../../utils/logger';
import type { HandlerRegistration, TaskHandler } from '../types';

interface SearchGamePayload {
  gameId: number;
}

const handler: TaskHandler = async ({ payload }) => {
  const { gameId } = payload as SearchGamePayload;
  if (typeof gameId !== 'number') {
    throw new Error(`Invalid payload: expected { gameId: number }, got ${JSON.stringify(payload)}`);
  }

  const game = await gameRepository.findById(gameId);
  if (!game) {
    logger.debug(`search.game: game ${gameId} no longer exists, skipping`);
    return;
  }

  // Skip if game's status changed since enqueue (e.g. user already imported it).
  if (game.status !== 'wanted' || !game.monitored) {
    logger.debug(`search.game: game ${game.title} no longer wanted/monitored, skipping`);
    return;
  }

  logger.info(`search.game: searching for ${game.title} (${game.year})`);

  const releases = await indexerService.searchForGame(game);
  if (releases.length === 0) {
    logger.info(`search.game: no releases found for ${game.title}`);
    return;
  }

  let bestRelease = null;
  for (const release of releases) {
    if (await indexerService.shouldAutoGrab(release)) {
      bestRelease = release;
      break;
    }
  }

  if (!bestRelease) {
    logger.info(
      `search.game: no releases meet auto-grab criteria for ${game.title} (best score: ${releases[0]?.score ?? 0})`
    );
    return;
  }

  logger.info(
    `search.game: auto-grabbing ${bestRelease.title} for ${game.title} (score: ${bestRelease.score})`
  );
  await downloadService.grabRelease(game.id, bestRelease);
  logger.info(`search.game: grabbed ${bestRelease.title} for ${game.title}`);
};

export const searchGameHandler: HandlerRegistration = {
  kind: 'search.game',
  handler,
  // Single-flight protects Prowlarr/qBit. Existing scheduler used a 2s sleep
  // between iterations; sequential execution is the equivalent.
  concurrency: 1,
  timeoutSec: 120,
};
