import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Discover from '../../pages/Discover';

const searchSchema = z.object({
  tab: z.enum(['trending', 'torrents']).optional(),
  q: z.string().optional(),
  age: z.coerce.number().optional(),
  type: z.coerce.number().optional(),
});

export const Route = createFileRoute('/_auth/discover')({
  validateSearch: searchSchema,
  component: Discover,
});
