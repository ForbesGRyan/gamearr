import { createFileRoute } from '@tanstack/react-router';
import Updates from '../../pages/Updates';
import { api } from '../../api/client';
import { queryKeys } from '../../queries/keys';
import { unwrap } from '../../queries/unwrap';

export const Route = createFileRoute('/_auth/updates')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.updates.pending(),
      queryFn: async () => unwrap(await api.getPendingUpdates()),
    }),
  component: Updates,
});
