import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Library from '../../pages/Library';
import { api } from '../../api/client';
import { queryKeys } from '../../queries/keys';
import { unwrap } from '../../queries/unwrap';

const searchSchema = z.object({
  tab: z.enum(['games', 'scan', 'health']).optional(),
  view: z.enum(['posters', 'table', 'overview']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  sort: z.enum(['title', 'year', 'rating', 'monitored', 'store', 'status', 'added']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().optional(),
  status: z.enum(['all', 'wanted', 'downloading', 'downloaded']).optional(),
  monitored: z.enum(['all', 'monitored', 'unmonitored']).optional(),
  genres: z.string().optional(),
  modes: z.string().optional(),
  library: z.coerce.number().optional(),
  stores: z.string().optional(),
});

export const Route = createFileRoute('/_auth/')({
  validateSearch: searchSchema,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.games.list(),
      queryFn: async () => unwrap(await api.getGames()),
    }),
  component: Library,
});
