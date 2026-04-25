import { useState, useEffect, useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';

const route = getRouteApi('/_auth/activity');
import type { Download } from '../api/client';
import {
  useCancelDownload,
  useDownloads,
  usePauseAllDownloads,
  usePauseDownload,
  useResumeAllDownloads,
  useResumeDownload,
} from '../queries/downloads';
import { queryKeys } from '../queries/keys';
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
  filterDownloads,
  sortDownloads,
  isPaused,
  isActiveDownload,
  getDownloadId,
} from '../components/activity';

function Activity() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();

  const initialSearch = search.q ?? '';
  const initialStatus: StatusFilter = search.status ?? 'all';
  const initialSort: SortField = search.sort ?? 'added';
  const initialDir: SortDirection = search.dir ?? 'desc';

  const downloadsQuery = useDownloads(true);
  const downloads: Download[] = useMemo(
    () => downloadsQuery.data ?? [],
    [downloadsQuery.data]
  );
  const isLoading = downloadsQuery.isLoading;
  const error = downloadsQuery.error ? (downloadsQuery.error as Error).message : null;

  const pauseMutation = usePauseDownload();
  const resumeMutation = useResumeDownload();
  const pauseAllMutation = usePauseAllDownloads();
  const resumeAllMutation = useResumeAllDownloads();
  const cancelMutation = useCancelDownload();

  const [downloadToDelete, setDownloadToDelete] = useState<Download | null>(null);
  const [downloadToImport, setDownloadToImport] = useState<Download | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [sortField, setSortField] = useState<SortField>(initialSort);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDir);

  useEffect(() => {
    const next = {
      q: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      sort: sortField === 'added' ? undefined : sortField,
      dir: sortDirection === 'desc' ? undefined : sortDirection,
    };
    if (
      next.q === search.q &&
      next.status === search.status &&
      next.sort === search.sort &&
      next.dir === search.dir
    ) {
      return;
    }
    navigate({ search: next, replace: true, viewTransition: false });
  }, [searchQuery, statusFilter, sortField, sortDirection, navigate, search]);

  const filteredDownloads = useMemo(() => {
    const filtered = filterDownloads(downloads, searchQuery, statusFilter);
    return sortDownloads(filtered, sortField, sortDirection);
  }, [downloads, searchQuery, statusFilter, sortField, sortDirection]);

  const hasActiveDownloads = useMemo(
    () => downloads.some((d) => isActiveDownload(d)),
    [downloads]
  );

  const hasPausedDownloads = useMemo(
    () => downloads.some((d) => isPaused(d)),
    [downloads]
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.downloads.all });
  };

  const handlePause = async (id: string, client: 'qbittorrent' | 'sabnzbd') => {
    try {
      await pauseMutation.mutateAsync({ id, client });
    } catch {
      setActionError('Failed to pause download');
    }
  };

  const handleResume = async (id: string, client: 'qbittorrent' | 'sabnzbd') => {
    try {
      await resumeMutation.mutateAsync({ id, client });
    } catch {
      setActionError('Failed to resume download');
    }
  };

  const handlePauseAll = async () => {
    try {
      await pauseAllMutation.mutateAsync();
    } catch {
      setActionError('Failed to pause all downloads');
    }
  };

  const handleResumeAll = async () => {
    try {
      await resumeAllMutation.mutateAsync();
    } catch {
      setActionError('Failed to resume all downloads');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!downloadToDelete) return;

    try {
      const dlId = getDownloadId(downloadToDelete);
      await cancelMutation.mutateAsync({
        id: dlId,
        deleteFiles: false,
        client: downloadToDelete.client,
      });
    } catch {
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
        hasActiveDownloads={hasActiveDownloads}
        hasPausedDownloads={hasPausedDownloads}
        onRefresh={refresh}
        onPauseAll={handlePauseAll}
        onResumeAll={handleResumeAll}
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
        message={
          downloadToDelete
            ? `Delete "${downloadToDelete.name}"?\n\nThis will remove the download but keep the downloaded files.`
            : ''
        }
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
          queryClient.invalidateQueries({ queryKey: queryKeys.downloads.all });
        }}
      />
    </div>
  );
}

export default Activity;
