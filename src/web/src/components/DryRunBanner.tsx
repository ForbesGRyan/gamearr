import { Link } from '@tanstack/react-router';
import { useSetting } from '../queries/settings';

interface DryRunBannerProps {
  className?: string;
}

export function DryRunBanner({ className = '' }: DryRunBannerProps) {
  const { data: dryRun } = useSetting<boolean>('dry_run');

  if (!dryRun) return null;

  return (
    <div
      className={`bg-amber-900/90 border-b border-amber-700 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 p-1.5 bg-amber-700 rounded-full">
              <svg
                className="w-4 h-4 text-amber-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="text-sm min-w-0">
              <span className="font-semibold text-amber-100">Dry-run mode is on.</span>{' '}
              <span className="text-amber-200">
                Releases you grab will be logged but not sent to download clients.
              </span>
            </div>
          </div>
          <Link
            to="/settings"
            search={{ tab: 'downloads' }}
            className="shrink-0 px-3 py-1 text-sm font-medium text-amber-50 bg-amber-700 hover:bg-amber-600 rounded transition-colors"
          >
            Disable
          </Link>
        </div>
      </div>
    </div>
  );
}
