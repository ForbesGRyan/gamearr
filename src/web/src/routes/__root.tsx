import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from '../queries/keys';
import { unwrap } from '../queries/unwrap';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location, context }) => {
    // Setup page is always accessible — mirrors the pre-TSR SetupGuard.
    if (location.pathname === '/setup') return;

    // If the setup-status probe fails, fall through to /setup (original
    // behavior treated isError the same as "needs setup").
    const status = await context.queryClient
      .ensureQueryData({
        queryKey: queryKeys.system.setupStatus(),
        queryFn: async () => unwrap(await api.getSetupStatus()),
        staleTime: 5 * 60_000,
      })
      .catch(() => null);

    if (!status?.isComplete) {
      throw redirect({ to: '/setup' });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  );
}
