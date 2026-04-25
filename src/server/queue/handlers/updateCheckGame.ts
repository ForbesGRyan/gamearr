import { gameRepository } from '../../repositories/GameRepository';
import { updateService } from '../../services/UpdateService';
import { logger } from '../../utils/logger';
import type { HandlerRegistration, TaskHandler } from '../types';

interface UpdateCheckGamePayload {
  gameId: number;
}

const handler: TaskHandler = async ({ payload }) => {
  const { gameId } = payload as UpdateCheckGamePayload;
  if (typeof gameId !== 'number') {
    throw new Error(`Invalid payload: expected { gameId: number }, got ${JSON.stringify(payload)}`);
  }

  const game = await gameRepository.findById(gameId);
  if (!game) {
    logger.debug(`update.check-game: game ${gameId} no longer exists, skipping`);
    return;
  }

  if (game.status !== 'downloaded' || game.updatePolicy === 'ignore') {
    logger.debug(`update.check-game: game ${game.title} not eligible, skipping`);
    return;
  }

  const updates = await updateService.checkGameForUpdates(game.id);
  if (updates.length > 0) {
    logger.info(`update.check-game: ${game.title} — found ${updates.length} update(s)`);
  }
};

export const updateCheckGameHandler: HandlerRegistration = {
  kind: 'update.check-game',
  handler,
  // Sequential — same indexer rate-limit concern as search.
  concurrency: 1,
  timeoutSec: 60,
};
