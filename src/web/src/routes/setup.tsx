import { createFileRoute, redirect } from '@tanstack/react-router';
import { Setup } from '../pages/Setup';

interface SetupStatus {
  isComplete: boolean;
}

// Fetch with cache: 'no-store' to defeat HTTP heuristic caching between
// navigations — a stale cached response here would fight the post-skip
// redirect and leave the user stranded on /setup.
async function getStatus(): Promise<SetupStatus | null> {
  const res = await fetch('/api/v1/system/setup-status', { cache: 'no-store' });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.success && body.data ? (body.data as SetupStatus) : null;
}

export const Route = createFileRoute('/setup')({
  // Bypass the Query cache here: the root beforeLoad intentionally skips
  // ensureQueryData on /setup to avoid seeding a stale isComplete=false that
  // would trap the user after they click "skip setup" and navigate away.
  // Hitting the endpoint directly keeps the cache pristine so the downstream
  // root beforeLoad (on /) gets a clean miss and refetches fresh.
  beforeLoad: async () => {
    const status = await getStatus();
    if (status?.isComplete) throw redirect({ to: '/' });
  },
  component: Setup,
});
