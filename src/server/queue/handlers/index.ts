import { handlerRegistry } from '../registry';
import { metadataRefreshHandler } from './metadataRefresh';
import { searchGameHandler } from './searchGame';
import { updateCheckGameHandler } from './updateCheckGame';
import { discoverRefreshTrendingHandler } from './discoverRefreshTrending';

/**
 * Register all task handlers. Called once at server startup.
 */
export function registerAllHandlers(): void {
  handlerRegistry.register(metadataRefreshHandler);
  handlerRegistry.register(searchGameHandler);
  handlerRegistry.register(updateCheckGameHandler);
  handlerRegistry.register(discoverRefreshTrendingHandler);
}
