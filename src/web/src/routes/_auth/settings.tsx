import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Settings from '../../pages/Settings';

const settingsTab = z.enum([
  'general',
  'libraries',
  'indexers',
  'downloads',
  'metadata',
  'notifications',
  'updates',
  'system',
  'security',
]);
export type SettingsTab = z.infer<typeof settingsTab>;

const searchSchema = z.object({
  tab: settingsTab.optional(),
});

export const Route = createFileRoute('/_auth/settings')({
  validateSearch: searchSchema,
  component: Settings,
});
