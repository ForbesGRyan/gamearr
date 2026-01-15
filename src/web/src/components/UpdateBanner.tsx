import { useState, useEffect } from 'react';
import { api, type AppUpdateStatus } from '../api/client';

// Key for storing dismissed version in localStorage
const DISMISSED_VERSION_KEY = 'gamearr_dismissed_update_version';

interface UpdateBannerProps {
  className?: string;
}

export function UpdateBanner({ className = '' }: UpdateBannerProps) {
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissing, setIsDismissing] = useState(false);

  // Check for local dismissal (session-based)
  const isLocallyDismissed = (version: string | null): boolean => {
    if (!version) return false;
    const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
    return dismissed === version;
  };

  useEffect(() => {
    const fetchUpdateStatus = async () => {
      try {
        const response = await api.getAppUpdateStatus();
        if (response.success && response.data) {
          setUpdateStatus(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch update status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpdateStatus();
  }, []);

  const handleDismiss = async () => {
    if (!updateStatus?.latestVersion) return;

    setIsDismissing(true);
    try {
      // Store dismissal locally (for session persistence)
      localStorage.setItem(DISMISSED_VERSION_KEY, updateStatus.latestVersion);

      // Also dismiss on server
      await api.dismissAppUpdate();

      // Update local state
      setUpdateStatus((prev) => prev ? { ...prev, isDismissed: true } : null);
    } catch (error) {
      console.error('Failed to dismiss update:', error);
    } finally {
      setIsDismissing(false);
    }
  };

  // Don't show banner if:
  // - Still loading
  // - No update status
  // - No update available
  // - Update is dismissed (server or local)
  if (
    isLoading ||
    !updateStatus ||
    !updateStatus.updateAvailable ||
    updateStatus.isDismissed ||
    isLocallyDismissed(updateStatus.latestVersion)
  ) {
    return null;
  }

  return (
    <div
      className={`bg-gradient-to-r from-blue-900 to-blue-800 border-b border-blue-700 ${className}`}
      role="alert"
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {/* Update icon */}
            <div className="flex-shrink-0 p-1.5 bg-blue-700 rounded-full">
              <svg
                className="w-4 h-4 text-blue-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>

            <div className="text-sm">
              <span className="text-blue-100">
                A new version of Gamearr is available:{' '}
              </span>
              <span className="font-semibold text-white">
                v{updateStatus.currentVersion}
              </span>
              <span className="text-blue-200"> → </span>
              <span className="font-semibold text-white">
                v{updateStatus.latestVersion}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View release link */}
            {updateStatus.releaseUrl && (
              <a
                href={updateStatus.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
              >
                View Release
              </a>
            )}

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              disabled={isDismissing}
              className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
              aria-label="Dismiss update notification"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateBanner;
