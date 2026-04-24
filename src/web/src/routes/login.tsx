import { createFileRoute } from '@tanstack/react-router';
import Login from '../pages/Login';
import { api } from '../api/client';
import { queryKeys } from '../queries/keys';
import { unwrap } from '../queries/unwrap';

export const Route = createFileRoute('/login')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.auth.status(),
      queryFn: async () => unwrap(await api.getAuthStatus()),
      staleTime: 5 * 60_000,
    }),
  component: Login,
});
