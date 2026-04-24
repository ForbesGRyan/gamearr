import { createFileRoute } from '@tanstack/react-router';
import GameDetail from '../../pages/GameDetail';
import { api } from '../../api/client';
import { queryKeys } from '../../queries/keys';
import { unwrap } from '../../queries/unwrap';

export const Route = createFileRoute('/_auth/game/$platform/$slug')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.games.bySlug(params.platform, params.slug),
      queryFn: async () => unwrap(await api.getGameBySlug(params.platform, params.slug)),
    }),
  component: GameDetail,
});
