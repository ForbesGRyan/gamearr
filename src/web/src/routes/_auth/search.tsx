import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Search from '../../pages/Search';

const searchSchema = z.object({
  tab: z.enum(['games', 'releases']).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute('/_auth/search')({
  validateSearch: searchSchema,
  component: Search,
});
