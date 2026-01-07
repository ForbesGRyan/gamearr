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
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 bg-opacity-100 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-600" style={{ backgroundColor: 'rgb(17, 24, 39)' }}>
        {/* Header */}
        <div className="p-6 border-b border-gray-600" style={{ backgroundColor: 'rgb(31, 41, 55)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Search Releases</h2>
              {game && (
                <p className="text-gray-300 mt-1">
                  {game.title} {game.year && `(${game.year})`}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white"
            >
              <CloseIcon className="w-6 h-6" />
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
            <div className="rounded-lg p-8 text-center" style={{ backgroundColor: 'rgb(55, 65, 81)' }}>
              <p className="text-gray-300 text-lg">
                No releases found. Try adjusting your search or check back later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {releases.map((release) => (
                <div
                  key={release.guid}
                  className="rounded-lg p-4 transition border border-gray-600"
                  style={{ backgroundColor: 'rgb(55, 65, 81)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(75, 85, 99)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(55, 65, 81)'}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm mb-2 truncate" title={release.title}>
                        {release.title}
                      </h3>

                      <div className="flex flex-wrap gap-2 text-xs mb-2">
                        <span className="text-gray-100 px-2 py-1 rounded" style={{ backgroundColor: 'rgb(75, 85, 99)' }}>
                          {release.indexer}
                        </span>
                        {release.quality && (
                          <span className="text-blue-100 px-2 py-1 rounded" style={{ backgroundColor: 'rgb(37, 99, 235)' }}>
                            {release.quality}
                          </span>
                        )}
                        {release.matchConfidence && (
                          <span
                            className="text-white px-2 py-1 rounded"
                            style={{
                              backgroundColor: release.matchConfidence === 'high' ? 'rgb(22, 163, 74)' :
                                              release.matchConfidence === 'medium' ? 'rgb(202, 138, 4)' :
                                              'rgb(220, 38, 38)'
                            }}
                          >
                            {release.matchConfidence} match
                          </span>
                        )}
                        <span className="text-gray-100 px-2 py-1 rounded" style={{ backgroundColor: 'rgb(75, 85, 99)' }}>
                          {formatBytes(release.size)}
                        </span>
                        <span className="text-gray-100 px-2 py-1 rounded flex items-center gap-1" style={{ backgroundColor: 'rgb(75, 85, 99)' }}>
                          <SeedersIcon className="w-3.5 h-3.5" /> {release.seeders} seeders
                        </span>
                        {release.score !== undefined && (
                          <span className="text-purple-100 px-2 py-1 rounded" style={{ backgroundColor: 'rgb(126, 34, 206)' }}>
                            Score: {release.score}
                          </span>
                        )}
                        <span className="text-gray-100 px-2 py-1 rounded" style={{ backgroundColor: 'rgb(75, 85, 99)' }}>
                          {formatDate(release.publishedAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setReleaseToGrab(release)}
                      className="ml-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm"
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
        <div className="p-6 border-t border-gray-600 flex justify-between items-center" style={{ backgroundColor: 'rgb(31, 41, 55)' }}>
          <p className="text-sm text-gray-300">
            {releases.length} release{releases.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded transition text-white"
            style={{ backgroundColor: 'rgb(75, 85, 99)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(107, 114, 128)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(75, 85, 99)'}
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
