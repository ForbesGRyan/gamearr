import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, Download } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import ImportDownloadModal from '../components/ImportDownloadModal';
import { PlayIcon, PauseIcon, TrashIcon, DownloadIcon } from '../components/Icons';
import { formatBytes, formatSpeed, formatETA } from '../utils/formatters';

type StatusFilter = 'all' | 'downloading' | 'seeding' | 'paused' | 'completed' | 'error' | 'checking';
type SortField = 'name' | 'progress' | 'size' | 'downloadSpeed' | 'uploadSpeed' | 'added';
type SortDirection = 'asc' | 'desc';

const validStatusFilters: StatusFilter[] = ['all', 'downloading', 'seeding', 'paused', 'completed', 'error', 'checking'];
const validSortFields: SortField[] = ['name', 'progress', 'size', 'downloadSpeed', 'uploadSpeed', 'added'];
const validSortDirections: SortDirection[] = ['asc', 'desc'];

function Activity() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const initialSearch = searchParams.get('q') || '';
  const initialStatus = validStatusFilters.includes(searchParams.get('status') as StatusFilter)
    ? (searchParams.get('status') as StatusFilter)
    : 'all';
  const initialSort = validSortFields.includes(searchParams.get('sort') as SortField)
    ? (searchParams.get('sort') as SortField)
    : 'added';
  const initialDir = validSortDirections.includes(searchParams.get('dir') as SortDirection)
    ? (searchParams.get('dir') as SortDirection)
    : 'desc';
  const initialShowCompleted = searchParams.get('completed') === 'true';

  const [downloads, setDownloads] = useState<Download[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(initialShowCompleted);
  const [downloadToDelete, setDownloadToDelete] = useState<Download | null>(null);
  const [downloadToImport, setDownloadToImport] = useState<Download | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedRef = useRef(false);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [sortField, setSortField] = useState<SortField>(initialSort);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDir);

  // Update URL params when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sortField !== 'added') params.set('sort', sortField);
    if (sortDirection !== 'desc') params.set('dir', sortDirection);
    if (showCompleted) params.set('completed', 'true');
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, sortField, sortDirection, showCompleted, setSearchParams]);

  const loadDownloads = useCallback(async (includeCompleted: boolean = false, showLoading: boolean = false) => {
    if (!isMountedRef.current) return;

    // Only show loading spinner on initial load or manual refresh
    if (showLoading || !hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await api.getDownloads(includeCompleted);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        if (response.success && response.data) {
          setDownloads(response.data);
          hasLoadedRef.current = true;
        } else {
          setError(response.error || 'Failed to load downloads');
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to load downloads');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    // Show loading when toggling showCompleted
    loadDownloads(showCompleted, true);

    // Refresh every 5 seconds (silently, no loading spinner)
    intervalRef.current = setInterval(() => loadDownloads(showCompleted, false), 5000);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [loadDownloads, showCompleted]);

  const getStateColor = (state: string) => {
    if (state.includes('downloading') || state.includes('metaDL')) {
      return 'text-blue-400';
    } else if (state.includes('uploading') || state.includes('UP')) {
      return 'text-green-400';
    } else if (state.includes('paused') || state.includes('stopped')) {
      return 'text-yellow-400';
    } else if (state.includes('error')) {
      return 'text-red-400';
    } else if (state.includes('checking')) {
      return 'text-purple-400';
    }
    return 'text-gray-400';
  };

  // Check if torrent is paused/stopped
  const isPaused = (state: string) => state.includes('paused') || state.includes('stopped');

  // Get status category for filtering
  const getStatusCategory = (state: string): StatusFilter => {
    if (state.includes('downloading') || state.includes('metaDL')) return 'downloading';
    if (state.includes('uploading') || state.includes('UP') || state.includes('stalled')) return 'seeding';
    if (state.includes('paused') || state.includes('stopped')) return 'paused';
    if (state.includes('error')) return 'error';
    if (state.includes('checking')) return 'checking';
    return 'completed';
  };

  // Filter and sort downloads
  const filteredDownloads = useMemo(() => {
    let result = [...downloads];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(query));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((d) => getStatusCategory(d.state) === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'downloadSpeed':
          comparison = a.downloadSpeed - b.downloadSpeed;
          break;
        case 'uploadSpeed':
          comparison = a.uploadSpeed - b.uploadSpeed;
          break;
        case 'added':
          // Use addedOn timestamp for sorting
          comparison = new Date(a.addedOn).getTime() - new Date(b.addedOn).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [downloads, searchQuery, statusFilter, sortField, sortDirection]);

  const handlePause = async (hash: string) => {
    try {
      await api.pauseDownload(hash);
      loadDownloads(showCompleted);
    } catch (err) {
      setActionError('Failed to pause download');
    }
  };

  const handleResume = async (hash: string) => {
    try {
      await api.resumeDownload(hash);
      loadDownloads(showCompleted);
    } catch (err) {
      setActionError('Failed to resume download');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!downloadToDelete) return;

    try {
      await api.cancelDownload(downloadToDelete.hash, false);
      loadDownloads(showCompleted);
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
            {filteredDownloads.length === downloads.length
              ? `${downloads.length} ${showCompleted ? 'total' : 'active'} ${downloads.length === 1 ? 'download' : 'downloads'}`
              : `${filteredDownloads.length} of ${downloads.length} ${downloads.length === 1 ? 'download' : 'downloads'}`}
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
            onClick={() => loadDownloads(showCompleted, true)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 flex flex-wrap gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search downloads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="downloading">Downloading</option>
          <option value="seeding">Seeding</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="checking">Checking</option>
          <option value="error">Error</option>
        </select>
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
      ) : downloads.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            No active downloads
          </h3>
          <p className="text-gray-500 mb-6">
            Download releases from the Search page or game cards to see activity here
          </p>
        </div>
      ) : filteredDownloads.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            No matching downloads
          </h3>
          <p className="text-gray-500 mb-6">
            No downloads match your search or filter criteria
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="text-blue-400 hover:text-blue-300"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700 text-gray-300 text-left">
                <tr>
                  <th
                    className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => {
                      if (sortField === 'name') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('name');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => {
                      if (sortField === 'progress') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('progress');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    Progress {sortField === 'progress' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => {
                      if (sortField === 'size') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('size');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => {
                      if (sortField === 'downloadSpeed') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('downloadSpeed');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    Down {sortField === 'downloadSpeed' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => {
                      if (sortField === 'uploadSpeed') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('uploadSpeed');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    Up {sortField === 'uploadSpeed' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">ETA</th>
                  <th
                    className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => {
                      if (sortField === 'added') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('added');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    Added {sortField === 'added' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredDownloads.map((download) => (
                  <tr key={download.hash} className="hover:bg-gray-750">
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <div className="truncate font-medium" title={download.name}>
                          {download.name}
                        </div>
                        <div className="mt-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${download.progress * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${getStateColor(download.state)}`}>
                        {download.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {(download.progress * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {formatBytes(download.size)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">
                      {formatSpeed(download.downloadSpeed)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400">
                      {formatSpeed(download.uploadSpeed)}
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {formatETA(download.eta)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(download.addedOn).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {isPaused(download.state) ? (
                          <button
                            onClick={() => handleResume(download.hash)}
                            className="bg-green-600 hover:bg-green-700 p-1.5 rounded transition"
                            title="Resume"
                          >
                            <PlayIcon />
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePause(download.hash)}
                            className="bg-yellow-600 hover:bg-yellow-700 p-1.5 rounded transition"
                            title="Pause"
                          >
                            <PauseIcon />
                          </button>
                        )}
                        <button
                          onClick={() => setDownloadToImport(download)}
                          className={`p-1.5 rounded transition ${
                            download.gameId
                              ? 'bg-gray-600 cursor-not-allowed opacity-50'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                          title={download.gameId ? 'Already linked to library' : 'Import to Library'}
                          disabled={!!download.gameId}
                        >
                          <DownloadIcon />
                        </button>
                        <button
                          onClick={() => setDownloadToDelete(download)}
                          className="bg-red-600 hover:bg-red-700 p-1.5 rounded transition"
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      <ImportDownloadModal
        isOpen={downloadToImport !== null}
        download={downloadToImport}
        onClose={() => setDownloadToImport(null)}
        onImported={() => {
          setDownloadToImport(null);
          loadDownloads(showCompleted);
        }}
      />
    </div>
  );
}

export default Activity;
