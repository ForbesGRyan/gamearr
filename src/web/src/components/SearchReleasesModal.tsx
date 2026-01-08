import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';
import { CloseIcon, SeedersIcon } from './Icons';

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
}

interface SearchReleasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
}

function SearchReleasesModal({ isOpen, onClose, game }: SearchReleasesModalProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releaseToGrab, setReleaseToGrab] = useState<Release | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [grabError, setGrabError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && game) {
      searchForReleases();
    }
  }, [isOpen, game]);

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

  const searchForReleases = async () => {
    if (!game) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.searchReleases(game.id);

      if (response.success && response.data) {
        // Sort releases by seeders (descending) for better visibility of well-seeded torrents
        const sortedReleases = (response.data as Release[]).sort((a, b) => b.seeders - a.seeders);
        setReleases(sortedReleases);
      } else {
        setError(response.error || 'Failed to search for releases');
      }
    } catch (err) {
      setError('Failed to search for releases');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getConfidenceBadgeColor = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-600';
      case 'medium':
        return 'bg-yellow-600';
      case 'low':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const handleGrabConfirm = async () => {
    if (!game || !releaseToGrab) return;

    try {
      const response = await api.grabRelease(game.id, releaseToGrab);

      if (response.success) {
        setReleaseToGrab(null);
        setSuccessMessage('Release added to download queue!');
      } else {
        setReleaseToGrab(null);
        setGrabError(`Failed to grab release: ${response.error || 'Unknown error'}`);
      }
    } catch (err) {
      setReleaseToGrab(null);
      setGrabError('Failed to grab release. Check your qBittorrent configuration.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-releases-modal-title"
    >
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-600">
        {/* Header */}
        <div className="bg-gray-700 p-6 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="search-releases-modal-title" className="text-2xl font-bold text-white">Search Releases</h2>
              {game && (
                <p className="text-gray-300 mt-1">
                  {game.title} {game.year && `(${game.year})`}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white"
              aria-label="Close modal"
            >
              <CloseIcon className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
              {releases.map((release) => (
                <div
                  key={release.guid}
                  className="bg-gray-600 hover:bg-gray-500 rounded-lg p-4 transition border border-gray-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm mb-2 truncate" title={release.title}>
                        {release.title}
                      </h3>

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
                        <span className="bg-gray-500 text-gray-100 px-2 py-1 rounded flex items-center gap-1">
                          <SeedersIcon className="w-3.5 h-3.5" aria-hidden="true" /> {release.seeders} seeders
                        </span>
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
                      onClick={() => setReleaseToGrab(release)}
                      className="ml-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm"
                      aria-label={`Grab release: ${release.title}`}
                    >
                      Grab
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-700 p-6 border-t border-gray-600 flex justify-between items-center">
          <p className="text-sm text-gray-300">
            {releases.length} release{releases.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-400 px-4 py-2 rounded transition text-white"
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
