import { handlerRegistry } from '../registry';
import { metadataRefreshHandler } from './metadataRefresh';

/**
 * Register all task handlers. Called once at server startup.
 */
export function registerAllHandlers(): void {
  handlerRegistry.register(metadataRefreshHandler);
}
