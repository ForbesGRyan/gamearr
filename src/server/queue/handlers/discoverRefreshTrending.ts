import { cacheService } from '../../services/CacheService';
import { igdbClient } from '../../integrations/igdb/IGDBClient';
import { logger } from '../../utils/logger';
import type { HandlerRegistration, TaskHandler } from '../types';

interface DiscoverRefreshTrendingPayload {
  popularityType: number;
}

const handler: TaskHandler = async ({ payload }) => {
  const { popularityType } = payload as DiscoverRefreshTrendingPayload;
  if (typeof popularityType !== 'number') {
    throw new Error(`Invalid payload: expected { popularityType: number }, got ${JSON.stringify(payload)}`);
  }

  if (!igdbClient.isConfigured()) {
    throw new Error('IGDB not configured');
  }

  await cacheService.refreshTrendingGames(popularityType, 50);
  logger.info(`discover.refresh-trending: refreshed popularity type ${popularityType}`);
};

export const discoverRefreshTrendingHandler: HandlerRegistration = {
  kind: 'discover.refresh-trending',
  handler,
  // IGDB rate limit ≈ 4 req/s — sequential is safe.
  concurrency: 1,
  timeoutSec: 30,
};
