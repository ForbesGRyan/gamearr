import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';

// SVG Icon Components
const PlayIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

interface Download {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  state: string;
  savePath: string;
  addedOn: string;
}

function Activity() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [downloadToDelete, setDownloadToDelete] = useState<Download | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDownloads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getDownloads();

      if (response.success && response.data) {
        setDownloads(response.data as any);
      } else {
        setError(response.error || 'Failed to load downloads');
      }
    } catch (err) {
      setError('Failed to load downloads');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDownloads();

    // Refresh every 5 seconds
    const interval = setInterval(loadDownloads, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const formatETA = (seconds: number): string => {
    if (seconds <= 0 || seconds === 8640000) return '∞';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStateColor = (state: string) => {
    if (state.includes('downloading') || state.includes('metaDL')) {
      return 'text-blue-400';
    } else if (state.includes('uploading') || state.includes('UP')) {
      return 'text-green-400';
    } else if (state.includes('paused')) {
      return 'text-yellow-400';
    } else if (state.includes('error')) {
      return 'text-red-400';
    } else if (state.includes('checking')) {
      return 'text-purple-400';
    }
    return 'text-gray-400';
  };

  const getFilteredDownloads = () => {
    if (showCompleted) {
      return downloads;
    }
    // Filter out completed downloads (100% progress)
    return downloads.filter((download) => download.progress < 1);
  };

  const filteredDownloads = getFilteredDownloads();

  const handlePause = async (hash: string) => {
    try {
      await api.pauseDownload(hash);
      loadDownloads();
    } catch (err) {
      setActionError('Failed to pause download');
    }
  };

  const handleResume = async (hash: string) => {
    try {
      await api.resumeDownload(hash);
      loadDownloads();
    } catch (err) {
      setActionError('Failed to resume download');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!downloadToDelete) return;

    try {
      await api.cancelDownload(downloadToDelete.hash, false);
      loadDownloads();
    } catch (err) {
      setActionError('Failed to delete download');
    } finally {
      setDownloadToDelete(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Activity</h2>
          <p className="text-gray-400 mt-1">
            {filteredDownloads.length} active {filteredDownloads.length === 1 ? 'download' : 'downloads'}
            {!showCompleted && downloads.length !== filteredDownloads.length && (
              <span className="text-gray-500 ml-2">
                ({downloads.length - filteredDownloads.length} completed hidden)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-4 py-2 rounded transition ${
              showCompleted
                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {showCompleted ? 'Hide' : 'Show'} Completed
          </button>
          <button
            onClick={loadDownloads}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Loading downloads...</p>
        </div>
      ) : filteredDownloads.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            {downloads.length === 0
              ? 'No active downloads'
              : 'All downloads completed'}
          </h3>
          <p className="text-gray-500 mb-6">
            {downloads.length === 0
              ? 'Download releases from the Search page or game cards to see activity here'
              : 'Click "Show Completed" to view finished downloads'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDownloads.map((download) => (
            <div
              key={download.hash}
              className="bg-gray-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1 truncate" title={download.name}>
                    {download.name}
                  </h3>
                  <p className={`text-xs ${getStateColor(download.state)}`}>
                    {download.state}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  {download.state.includes('paused') ? (
                    <button
                      onClick={() => handleResume(download.hash)}
                      className="bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded transition text-sm"
                      title="Resume"
                    >
                      <PlayIcon />
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePause(download.hash)}
                      className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1.5 rounded transition text-sm"
                      title="Pause"
                    >
                      <PauseIcon />
                    </button>
                  )}
                  <button
                    onClick={() => setDownloadToDelete(download)}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded transition text-sm"
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${download.progress * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-400">
                <div>
                  <span className="text-gray-500">Progress:</span>{' '}
                  <span className="text-white">{(download.progress * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Size:</span>{' '}
                  <span className="text-white">{formatBytes(download.size)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Down:</span>{' '}
                  <span className="text-green-400">{formatSpeed(download.downloadSpeed)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Up:</span>{' '}
                  <span className="text-blue-400">{formatSpeed(download.uploadSpeed)}</span>
                </div>
                <div>
                  <span className="text-gray-500">ETA:</span>{' '}
                  <span className="text-white">{formatETA(download.eta)}</span>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-gray-500">Path:</span>{' '}
                  <span className="text-white truncate" title={download.savePath}>
                    {download.savePath}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={downloadToDelete !== null}
        title="Delete Download"
        message={downloadToDelete ? `Delete "${downloadToDelete.name}"?\n\nThis will remove the torrent but keep the downloaded files.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDownloadToDelete(null)}
      />

      <ConfirmModal
        isOpen={actionError !== null}
        title="Error"
        message={actionError || ''}
        confirmText="OK"
        cancelText=""
        variant="danger"
        onConfirm={() => setActionError(null)}
        onCancel={() => setActionError(null)}
      />
    </div>
  );
}

export default Activity;
