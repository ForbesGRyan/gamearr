import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useSearchReleasesForGame, useGrabRelease } from '../queries';
import ConfirmModal from './ConfirmModal';
import { CloseIcon, SeedersIcon } from './Icons';
import { formatBytes, formatDate } from '../utils/formatters';

interface Game {
  id: number;
  title: string;
  year?: number;
}

interface Release {
  guid: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  downloadUrl: string;
  publishedAt: string;
  quality?: string;
  score?: number;
  matchConfidence?: 'high' | 'medium' | 'low';
  releaseType?: 'full' | 'update' | 'patch' | 'dlc';
  protocol?: 'torrent' | 'usenet';
}

// Helper function to get release type badge styling
function getReleaseTypeBadge(releaseType?: string): { label: string; className: string } | null {
  switch (releaseType) {
    case 'update':
      return { label: 'Update Only', className: 'bg-orange-600 text-orange-100' };
    case 'patch':
      return { label: 'Patch Only', className: 'bg-yellow-600 text-yellow-100' };
    case 'dlc':
      return { label: 'DLC', className: 'bg-purple-600 text-purple-100' };
    default:
      return null; // Don't show badge for full games
  }
}

interface SearchReleasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
}

function SearchReleasesModal({ isOpen, onClose, game }: SearchReleasesModalProps) {
  const [releaseToGrab, setReleaseToGrab] = useState<Release | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [grabError, setGrabError] = useState<string | null>(null);
  const [qbitConfigured, setQbitConfigured] = useState(true);
  const [sabConfigured, setSabConfigured] = useState(true);

  const gameId = game?.id;
  const releasesQuery = useSearchReleasesForGame(gameId, {
    enabled: isOpen && gameId !== undefined,
  });
  const grabReleaseMutation = useGrabRelease();

  const isLoading = releasesQuery.isLoading || releasesQuery.isFetching;
  const error = releasesQuery.error
    ? ((releasesQuery.error as Error).message || 'Failed to search for releases')
    : null;

  // Sort releases by score (descending), then seeders as tiebreaker
  const releases = useMemo<Release[]>(() => {
    const data = (releasesQuery.data ?? []) as Release[];
    return [...data].sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.seeders || 0) - (a.seeders || 0);
    });
  }, [releasesQuery.data]);

  // Load client configuration status (Batch 7 owns settings — leave as direct fetch)
  useEffect(() => {
    if (isOpen) {
      api.getSettings().then((res) => {
        if (res.success && res.data) {
          setQbitConfigured(!!res.data.qbittorrent_host);
          setSabConfigured(!!res.data.sabnzbd_host && !!res.data.sabnzbd_api_key);
        }
      });
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleGrabConfirm = async () => {
    if (!game || !releaseToGrab) return;
    const release = releaseToGrab;

    try {
      await grabReleaseMutation.mutateAsync({
        gameId: game.id,
        release,
      });
      setReleaseToGrab(null);
      setSuccessMessage('Release added to download queue!');
    } catch (err) {
      setReleaseToGrab(null);
      const message =
        err instanceof Error && err.message ? err.message : 'Unknown error';
      const clientName = release.protocol === 'usenet' ? 'SABnzbd' : 'qBittorrent';
      setGrabError(
        `Failed to grab release: ${message}. Check your ${clientName} configuration.`
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-releases-modal-title"
    >
      <div className="fixed inset-0 md:inset-auto md:relative md:max-w-4xl md:max-h-[90vh] w-full h-full md:w-auto md:h-auto bg-gray-900 md:rounded-lg flex flex-col shadow-2xl border-0 md:border border-gray-600">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-gray-700 p-4 md:p-6 border-b border-gray-600 md:rounded-t-lg flex-shrink-0 z-10">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h2 id="search-releases-modal-title" className="text-xl md:text-2xl font-bold text-white">Search Releases</h2>
              {game && (
                <p className="text-gray-300 mt-1 truncate">
                  {game.title} {game.year && `(${game.year})`}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center ml-4"
              aria-label="Close modal"
            >
              <CloseIcon className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-200 text-lg">Searching for releases...</p>
            </div>
          ) : releases.length === 0 ? (
            <div className="bg-gray-600 rounded-lg p-8 text-center">
              <p className="text-gray-300 text-lg">
                No releases found. Try adjusting your search or check back later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {releases.map((release) => {
                const typeBadge = getReleaseTypeBadge(release.releaseType);
                const isUsenet = release.protocol === 'usenet';
                const clientMissing = isUsenet ? !sabConfigured : !qbitConfigured;
                const clientName = isUsenet ? 'SABnzbd' : 'qBittorrent';

                return (
                  <div
                    key={release.guid}
                    className="bg-gray-600 hover:bg-gray-500 rounded-lg p-4 transition border border-gray-600"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white text-sm truncate" title={release.title}>
                            {release.title}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${isUsenet ? 'bg-purple-600 text-purple-100' : 'bg-cyan-600 text-cyan-100'}`}>
                            {isUsenet ? 'NZB' : 'Torrent'}
                          </span>
                          {typeBadge && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${typeBadge.className}`}>
                              {typeBadge.label}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs mb-2">
                          <span className="bg-gray-500 text-gray-100 px-2 py-1 rounded">
                            {release.indexer}
                          </span>
                          {release.quality && (
                            <span className="bg-blue-600 text-blue-100 px-2 py-1 rounded">
                              {release.quality}
                            </span>
                          )}
                          {release.matchConfidence && (
                            <span
                              className={`text-white px-2 py-1 rounded ${
                                release.matchConfidence === 'high' ? 'bg-green-600' :
                                release.matchConfidence === 'medium' ? 'bg-yellow-600' :
                                'bg-red-600'
                              }`}
                            >
                              {release.matchConfidence} match
                            </span>
                          )}
                          <span className="bg-gray-500 text-gray-100 px-2 py-1 rounded">
                            {formatBytes(release.size)}
                          </span>
                          {!isUsenet && (
                            <span className="bg-gray-500 text-gray-100 px-2 py-1 rounded flex items-center gap-1">
                              <SeedersIcon className="w-3.5 h-3.5" aria-hidden="true" /> {release.seeders} seeders
                            </span>
                          )}
                          {release.score !== undefined && (
                            <span className="bg-purple-700 text-purple-100 px-2 py-1 rounded">
                              Score: {release.score}
                            </span>
                          )}
                          <span className="bg-gray-500 text-gray-100 px-2 py-1 rounded">
                            {formatDate(release.publishedAt)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => !clientMissing && setReleaseToGrab(release)}
                        disabled={clientMissing}
                        className={`ml-4 px-4 py-2 min-h-[44px] rounded transition text-sm ${
                          clientMissing
                            ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                        aria-label={clientMissing ? `${clientName} not configured` : `Grab release: ${release.title}`}
                        title={clientMissing ? `${clientName} is not configured. Set it up in Settings → Downloads.` : undefined}
                      >
                        Grab
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-gray-800 p-4 md:p-6 border-t border-gray-700 flex flex-col md:flex-row justify-between items-center gap-3 flex-shrink-0">
          <p className="text-sm text-gray-300 order-2 md:order-1">
            {releases.length} release{releases.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={onClose}
            className="w-full md:w-auto bg-gray-600 hover:bg-gray-500 px-4 py-2 min-h-[44px] rounded transition text-white order-1 md:order-2"
          >
            Close
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={releaseToGrab !== null}
        title="Download Release"
        message={releaseToGrab ? `Download "${releaseToGrab.title}"?` : ''}
        confirmText="Download"
        cancelText="Cancel"
        variant="info"
        onConfirm={handleGrabConfirm}
        onCancel={() => setReleaseToGrab(null)}
      />

      <ConfirmModal
        isOpen={successMessage !== null}
        title="Success"
        message={successMessage || ''}
        confirmText="OK"
        cancelText=""
        variant="info"
        onConfirm={() => {
          setSuccessMessage(null);
          onClose();
        }}
        onCancel={() => {
          setSuccessMessage(null);
          onClose();
        }}
      />

      <ConfirmModal
        isOpen={grabError !== null}
        title="Error"
        message={grabError || ''}
        confirmText="OK"
        cancelText=""
        variant="danger"
        onConfirm={() => setGrabError(null)}
        onCancel={() => setGrabError(null)}
      />
    </div>
  );
}

export default SearchReleasesModal;
