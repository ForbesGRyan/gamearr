import { useState, useEffect } from 'react';
import { api } from '../api/client';

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
      alert('Failed to pause download');
    }
  };

  const handleResume = async (hash: string) => {
    try {
      await api.resumeDownload(hash);
      loadDownloads();
    } catch (err) {
      alert('Failed to resume download');
    }
  };

  const handleDelete = async (hash: string, name: string) => {
    const confirmed = confirm(`Delete "${name}"?\n\nThis will remove the torrent but keep the downloaded files.`);
    if (!confirmed) return;

    try {
      await api.cancelDownload(hash, false);
      loadDownloads();
    } catch (err) {
      alert('Failed to delete download');
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
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">📥</div>
          <p className="text-gray-400 text-lg mb-2">
            {downloads.length === 0
              ? 'No active downloads'
              : 'No active downloads (all completed)'}
          </p>
          <p className="text-gray-500 text-sm">
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
                      className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded transition text-sm"
                      title="Resume"
                    >
                      ▶️
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePause(download.hash)}
                      className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded transition text-sm"
                      title="Pause"
                    >
                      ⏸️
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(download.hash, download.name)}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition text-sm"
                    title="Delete"
                  >
                    🗑️
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
    </div>
  );
}

export default Activity;
