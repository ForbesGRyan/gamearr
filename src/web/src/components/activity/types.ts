import { Download } from '../../api/client';

export type StatusFilter = 'all' | 'downloading' | 'seeding' | 'paused' | 'completed' | 'error' | 'checking';
export type SortField = 'name' | 'progress' | 'size' | 'downloadSpeed' | 'uploadSpeed' | 'added';
export type SortDirection = 'asc' | 'desc';

export const validStatusFilters: StatusFilter[] = ['all', 'downloading', 'seeding', 'paused', 'completed', 'error', 'checking'];
export const validSortFields: SortField[] = ['name', 'progress', 'size', 'downloadSpeed', 'uploadSpeed', 'added'];
export const validSortDirections: SortDirection[] = ['asc', 'desc'];

export interface StatusInfo {
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
}

// Utility functions for download state
export function getStateColor(state: string): string {
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

export function isPaused(state: string): boolean {
  return state.includes('paused') || state.includes('stopped');
}

export function isActiveDownload(state: string): boolean {
  // Active means downloading, checking, or seeding - anything that's not paused or completed
  return !isPaused(state) &&
    !state.includes('completed') &&
    state !== 'stalledUP' &&
    state !== 'forcedUP';
}

export function getStatusCategory(state: string): StatusFilter {
  if (state.includes('downloading') || state.includes('metaDL')) return 'downloading';
  if (state.includes('uploading') || state.includes('UP') || state.includes('stalled')) return 'seeding';
  if (state.includes('paused') || state.includes('stopped')) return 'paused';
  if (state.includes('error')) return 'error';
  if (state.includes('checking')) return 'checking';
  return 'completed';
}

export function getStatusInfo(state: string): StatusInfo {
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
        comparison = a.uploadSpeed - b.uploadSpeed;
        break;
      case 'added':
        comparison = new Date(a.addedOn).getTime() - new Date(b.addedOn).getTime();
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
    result = result.filter((d) => getStatusCategory(d.state) === statusFilter);
  }

  return result;
}
