import { Download } from '../../api/client';

export type StatusFilter = 'all' | 'downloading' | 'seeding' | 'paused' | 'completed' | 'error' | 'checking';
export type SortField = 'name' | 'progress' | 'size' | 'downloadSpeed' | 'uploadSpeed' | 'added';
export type SortDirection = 'asc' | 'desc';

export const validStatusFilters: StatusFilter[] = ['all', 'downloading', 'seeding', 'paused', 'completed', 'error', 'checking'];
export const validSortFields: SortField[] = ['name', 'progress', 'size', 'downloadSpeed', 'uploadSpeed', 'added'];
export const validSortDirections: SortDirection[] = ['asc', 'desc'];

interface StatusInfo {
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
}

/**
 * Get a unique identifier for a download (hash for torrents, nzo_id for usenet)
 */
export function getDownloadId(download: Download): string {
  return download.hash || download.id || '';
}

/**
 * Get the effective state string, normalizing between qBittorrent and SABnzbd
 */
function getEffectiveState(download: Download): string {
  if (download.client === 'sabnzbd') {
    // Map SABnzbd status to qBittorrent-like state strings
    const status = download.status || '';
    switch (status) {
      case 'Downloading':
      case 'Fetching':
        return 'downloading';
      case 'Queued':
        return 'queuedDL';
      case 'Paused':
        return 'pausedDL';
      case 'Completed':
        return 'completed';
      case 'Failed':
        return 'error';
      default:
        return status.toLowerCase();
    }
  }
  return download.state || '';
}

// Utility functions for download state
export function getStateColor(download: Download): string {
  const state = getEffectiveState(download);
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
}

export function getStateLabel(download: Download): string {
  if (download.client === 'sabnzbd') {
    return download.status || 'Unknown';
  }
  return download.state || 'Unknown';
}

export function isPaused(download: Download): boolean {
  const state = getEffectiveState(download);
  return state.includes('paused') || state.includes('stopped');
}

export function isActiveDownload(download: Download): boolean {
  const state = getEffectiveState(download);
  return !isPaused(download) &&
    !state.includes('completed') &&
    state !== 'stalledUP' &&
    state !== 'forcedUP';
}

function getStatusCategory(download: Download): StatusFilter {
  const state = getEffectiveState(download);
  if (state.includes('downloading') || state.includes('metaDL')) return 'downloading';
  if (state.includes('uploading') || state.includes('UP') || state.includes('stalled')) return 'seeding';
  if (state.includes('paused') || state.includes('stopped')) return 'paused';
  if (state.includes('error')) return 'error';
  if (state.includes('checking')) return 'checking';
  if (state.includes('completed') || state.includes('queued')) return 'completed';
  return 'completed';
}

export function getStatusInfo(download: Download): StatusInfo {
  const state = getEffectiveState(download);
  if (state.includes('downloading') || state.includes('metaDL')) {
    return { label: 'Downloading', color: 'blue' };
  } else if (state.includes('uploading') || state.includes('UP') || state.includes('stalled')) {
    return { label: 'Seeding', color: 'green' };
  } else if (state.includes('paused') || state.includes('stopped')) {
    return { label: 'Paused', color: 'yellow' };
  } else if (state.includes('error')) {
    return { label: 'Error', color: 'red' };
  } else if (state.includes('checking')) {
    return { label: 'Checking', color: 'gray' };
  } else if (state.includes('queued')) {
    return { label: 'Queued', color: 'gray' };
  }
  return { label: 'Completed', color: 'green' };
}

// Sort downloads helper
export function sortDownloads(
  downloads: Download[],
  sortField: SortField,
  sortDirection: SortDirection
): Download[] {
  return [...downloads].sort((a, b) => {
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
        comparison = (a.uploadSpeed || 0) - (b.uploadSpeed || 0);
        break;
      case 'added':
        comparison = new Date(a.addedOn || 0).getTime() - new Date(b.addedOn || 0).getTime();
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

// Filter downloads helper
export function filterDownloads(
  downloads: Download[],
  searchQuery: string,
  statusFilter: StatusFilter
): Download[] {
  let result = [...downloads];

  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter((d) => d.name.toLowerCase().includes(query));
  }

  // Status filter
  if (statusFilter !== 'all') {
    result = result.filter((d) => getStatusCategory(d) === statusFilter);
  }

  return result;
}
