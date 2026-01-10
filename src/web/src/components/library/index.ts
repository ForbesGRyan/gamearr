// Library component exports
export { LibraryFilterBar } from './LibraryFilterBar';
export { LibraryPagination } from './LibraryPagination';
export { BulkActionToolbar } from './BulkActionToolbar';
export { SteamImportModal } from './SteamImportModal';
export { LibraryHealthTab } from './LibraryHealthTab';
export { LibraryScanTab } from './LibraryScanTab';

// New extracted components
export { LibraryTableView } from './LibraryTableView';
export { LibraryPosterGrid } from './LibraryPosterGrid';
export { LibraryOverviewGrid } from './LibraryOverviewGrid';
export { LibraryEmptyState } from './LibraryEmptyState';
export { LibraryHeader } from './LibraryHeader';
export { LibraryTabs } from './LibraryTabs';
export { LibraryGamesFilter } from './LibraryGamesFilter';
export { LibraryToasts } from './LibraryToasts';

// Hooks
export { useLibraryGames } from './useLibraryGames';

// Type exports
export type {
  Game,
  SimilarGame,
  LibraryFolder,
  AutoMatchSuggestion,
  LooseFile,
  DuplicateGroup,
  DuplicateGameInfo,
  ViewMode,
  SortColumn,
  SortDirection,
  StatusFilter,
  MonitoredFilter,
  Filters,
  SteamGame,
  SteamImportProgress,
  LibraryInfo,
} from './types';
