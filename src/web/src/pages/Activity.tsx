import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, Download } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import ImportDownloadModal from '../components/ImportDownloadModal';
import {
  ActivityHeader,
  ActivityFilters,
  ActivityMobileView,
  ActivityTable,
  LoadingState,
  NoDownloadsState,
  NoMatchingDownloadsState,
  StatusFilter,
  SortField,
  SortDirection,
  validStatusFilters,
  validSortFields,
  validSortDirections,
  filterDownloads,
  sortDownloads,
} from '../components/activity';

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

    if (showLoading || !hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await api.getDownloads(includeCompleted);

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
    loadDownloads(showCompleted, true);

    intervalRef.current = setInterval(() => loadDownloads(showCompleted, false), 15000);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [loadDownloads, showCompleted]);

  // Filter and sort downloads
  const filteredDownloads = useMemo(() => {
    const filtered = filterDownloads(downloads, searchQuery, statusFilter);
    return sortDownloads(filtered, sortField, sortDirection);
  }, [downloads, searchQuery, statusFilter, sortField, sortDirection]);

  // Action handlers
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

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  return (
    <div>
      <ActivityHeader
        totalDownloads={downloads.length}
        filteredCount={filteredDownloads.length}
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted(!showCompleted)}
        onRefresh={() => loadDownloads(showCompleted, true)}
      />

      <ActivityFilters
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : downloads.length === 0 ? (
        <NoDownloadsState />
      ) : filteredDownloads.length === 0 ? (
        <NoMatchingDownloadsState onClearFilters={handleClearFilters} />
      ) : (
        <>
          <ActivityMobileView
            downloads={filteredDownloads}
            onPause={handlePause}
            onResume={handleResume}
            onImport={setDownloadToImport}
            onDelete={setDownloadToDelete}
          />

          <ActivityTable
            downloads={filteredDownloads}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            onPause={handlePause}
            onResume={handleResume}
            onImport={setDownloadToImport}
            onDelete={setDownloadToDelete}
          />
        </>
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
