import { createFileRoute } from '@tanstack/react-router';
import Library from '../../pages/Library';
import { api } from '../../api/client';
import { queryKeys } from '../../queries/keys';
import { unwrap } from '../../queries/unwrap';

export const Route = createFileRoute('/_auth/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.games.list(),
      queryFn: async () => unwrap(await api.getGames()),
    }),
  component: Library,
});
