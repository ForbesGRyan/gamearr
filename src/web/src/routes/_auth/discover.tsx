import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Discover from '../../pages/Discover';
import { api } from '../../api/client';
import { queryKeys } from '../../queries/keys';
import { unwrap } from '../../queries/unwrap';

const searchSchema = z.object({
  tab: z.enum(['trending', 'torrents']).optional(),
  q: z.string().optional(),
  age: z.coerce.number().optional(),
  type: z.coerce.number().optional(),
});

export const Route = createFileRoute('/_auth/discover')({
  validateSearch: searchSchema,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.discover.popularityTypes(),
      queryFn: async () => unwrap(await api.getPopularityTypes()),
      staleTime: 5 * 60_000,
    }),
  component: Discover,
});
