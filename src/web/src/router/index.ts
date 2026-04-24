import { createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { queryClient } from '../queries/client';
import {
  RouteErrorComponent,
  RouteNotFoundComponent,
  RoutePendingComponent,
} from './boundaries';

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Reuse in-flight / recently-resolved loader data when a hover-preload is
  // followed immediately by a click. 30s is the same floor the page-level
  // query staleTime uses for bySlug/releases.
  defaultPreloadStaleTime: 30_000,
  scrollRestoration: true,
  defaultErrorComponent: RouteErrorComponent,
  defaultPendingComponent: RoutePendingComponent,
  defaultNotFoundComponent: RouteNotFoundComponent,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
