import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Activity from '../../pages/Activity';
import { api } from '../../api/client';
import { queryKeys } from '../../queries/keys';
import { unwrap } from '../../queries/unwrap';

const searchSchema = z.object({
  q: z.string().optional(),
  status: z
    .enum(['all', 'downloading', 'seeding', 'paused', 'completed', 'error', 'checking'])
    .optional(),
  sort: z
    .enum(['name', 'progress', 'size', 'downloadSpeed', 'uploadSpeed', 'added'])
    .optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export const Route = createFileRoute('/_auth/activity')({
  validateSearch: searchSchema,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.downloads.list(true),
      queryFn: async () => unwrap(await api.getDownloads(true)),
    }),
  component: Activity,
});
