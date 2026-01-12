import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { getGameDetailPath } from '../../utils/slug';
import type { Game, ViewMode, SortColumn, SortDirection, Filters, LibraryInfo, StatusFilter, MonitoredFilter } from './types';

// Extended game type with pre-parsed JSON fields
interface GameWithParsedFields extends Game {
  parsedGenres: string[];
  parsedGameModes: string[];
}

// Helper to safely parse JSON array
function safeParseJsonArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

// URL param helpers
function parseArrayParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

function serializeArrayParam(arr: string[]): string | null {
  return arr.length > 0 ? arr.join(',') : null;
}

const DEFAULT_FILTERS: Filters = {
  status: 'all',
  monitored: 'all',
  genres: [],
  gameModes: [],
  libraryId: 'all',
  stores: [],
};

export function useLibraryGames() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Core state - games with pre-parsed JSON fields for performance
  const [games, setGames] = useState<GameWithParsedFields[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // View mode from URL param with localStorage fallback
  const urlViewMode = searchParams.get('view');
  const viewMode: ViewMode = (urlViewMode && ['posters', 'table', 'overview'].includes(urlViewMode))
    ? (urlViewMode as ViewMode)
    : ((localStorage.getItem('library-view-mode') as ViewMode) || 'posters');
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);

  // URL-synced state - derive initial values from URL params
  const sortColumn = (searchParams.get('sort') as SortColumn) || 'title';
  const sortDirection = (searchParams.get('dir') as SortDirection) || 'asc';
  const searchQuery = searchParams.get('q') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10) || 1;

  const filters: Filters = useMemo(() => ({
    status: (searchParams.get('status') as StatusFilter) || 'all',
    monitored: (searchParams.get('monitored') as MonitoredFilter) || 'all',
    genres: parseArrayParam(searchParams.get('genres')),
    gameModes: parseArrayParam(searchParams.get('modes')),
    libraryId: searchParams.get('library') ? parseInt(searchParams.get('library')!, 10) : 'all',
    stores: parseArrayParam(searchParams.get('stores')),
  }), [searchParams]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);

  // Bulk selection state
  const [selectedGameIds, setSelectedGameIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Pagination state (pageSize still uses localStorage, page is in URL)
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('library-page-size');
    return saved ? parseInt(saved, 10) : 25;
  });

  // Helper to update URL params without losing other params
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // URL-synced setters
  const setSortColumn = useCallback((column: SortColumn) => {
    updateUrlParams({ sort: column === 'title' ? null : column });
  }, [updateUrlParams]);

  const setSortDirection = useCallback((dir: SortDirection) => {
    updateUrlParams({ dir: dir === 'asc' ? null : dir });
  }, [updateUrlParams]);

  // Combined sort setter for dropdowns that set both at once
  const setSort = useCallback((column: SortColumn, direction: SortDirection) => {
    updateUrlParams({
      sort: column === 'title' ? null : column,
      dir: direction === 'asc' ? null : direction,
    });
  }, [updateUrlParams]);

  const setSearchQuery = useCallback((query: string) => {
    updateUrlParams({ q: query || null, page: null }); // Reset page on search
  }, [updateUrlParams]);

  const setCurrentPage = useCallback((page: number) => {
    updateUrlParams({ page: page === 1 ? null : String(page) });
  }, [updateUrlParams]);

  const setFilters = useCallback((newFilters: Filters) => {
    updateUrlParams({
      status: newFilters.status === 'all' ? null : newFilters.status,
      monitored: newFilters.monitored === 'all' ? null : newFilters.monitored,
      genres: serializeArrayParam(newFilters.genres),
      modes: serializeArrayParam(newFilters.gameModes),
      library: newFilters.libraryId === 'all' ? null : String(newFilters.libraryId),
      stores: serializeArrayParam(newFilters.stores),
      page: null, // Reset page on filter change
    });
  }, [updateUrlParams]);

  // View mode handler - updates URL and localStorage
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    updateUrlParams({ view: mode === 'posters' ? null : mode });
    localStorage.setItem('library-view-mode', mode);
  }, [updateUrlParams]);

  // Sort handler
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      const newDir = sortDirection === 'asc' ? 'desc' : 'asc';
      updateUrlParams({ dir: newDir === 'asc' ? null : newDir });
    } else {
      updateUrlParams({ sort: column === 'title' ? null : column, dir: null });
    }
  }, [sortColumn, sortDirection, updateUrlParams]);

  // Computed values - uses pre-parsed fields for performance
  const allGenres = useMemo((): string[] => {
    const genreSet = new Set<string>();
    games.forEach((game) => {
      game.parsedGenres.forEach((g) => genreSet.add(g));
    });
    return Array.from(genreSet).sort();
  }, [games]);

  const allGameModes = useMemo((): string[] => {
    const modeSet = new Set<string>();
    games.forEach((game) => {
      game.parsedGameModes.forEach((m) => modeSet.add(m));
    });
    return Array.from(modeSet).sort();
  }, [games]);

  const allStores = useMemo((): string[] => {
    const storeSet = new Set<string>();
    games.forEach((game) => {
      // Collect from stores array (new format)
      game.stores?.forEach((s) => storeSet.add(s.name));
      // Also include legacy store field for backwards compatibility
      if (game.store) storeSet.add(game.store);
    });
    return Array.from(storeSet).sort();
  }, [games]);

  const filteredAndSortedGames = useMemo((): GameWithParsedFields[] => {
    let filtered = games;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((game) => {
        if (game.title.toLowerCase().includes(query)) return true;
        if (game.developer?.toLowerCase().includes(query)) return true;
        if (game.publisher?.toLowerCase().includes(query)) return true;
        // Use pre-parsed genres for search
        if (game.parsedGenres.some(g => g.toLowerCase().includes(query))) return true;
        return false;
      });
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter((game) => game.status === filters.status);
    }

    if (filters.monitored !== 'all') {
      filtered = filtered.filter((game) =>
        filters.monitored === 'monitored' ? game.monitored : !game.monitored
      );
    }

    if (filters.genres.length > 0) {
      filtered = filtered.filter((game) => {
        // Use pre-parsed genres for filtering
        return filters.genres.some((g) => game.parsedGenres.includes(g));
      });
    }

    if (filters.gameModes.length > 0) {
      filtered = filtered.filter((game) => {
        // Use pre-parsed game modes for filtering
        return filters.gameModes.some((m) => game.parsedGameModes.includes(m));
      });
    }

    if (filters.libraryId !== 'all') {
      filtered = filtered.filter((game) => game.libraryId === filters.libraryId);
    }

    if (filters.stores.length > 0) {
      filtered = filtered.filter((game) => {
        // Check stores array (new format)
        const gameStoreNames = game.stores?.map((s) => s.name) || [];
        // Also check legacy store field
        if (game.store) gameStoreNames.push(game.store);
        return filters.stores.some((s) => gameStoreNames.includes(s));
      });
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'title':
          comparison = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
          break;
        case 'year':
          comparison = (a.year || 0) - (b.year || 0);
          break;
        case 'rating':
          comparison = (a.totalRating || 0) - (b.totalRating || 0);
          break;
        case 'monitored':
          comparison = (a.monitored === b.monitored) ? 0 : (a.monitored ? -1 : 1);
          break;
        case 'store':
          // Use first store from stores array if available, fallback to legacy store field
          const aStore = a.stores?.[0]?.name || a.store || '';
          const bStore = b.stores?.[0]?.name || b.store || '';
          comparison = aStore.localeCompare(bStore, undefined, { sensitivity: 'base' });
          break;
        case 'status':
          const statusOrder = { wanted: 0, downloading: 1, downloaded: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [games, searchQuery, filters, sortColumn, sortDirection]);

  const paginatedGames = useMemo((): GameWithParsedFields[] => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedGames.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedGames, currentPage, pageSize]);

  const totalPages = useMemo((): number => {
    return Math.ceil(filteredAndSortedGames.length / pageSize);
  }, [filteredAndSortedGames.length, pageSize]);

  const activeFilterCount = useMemo((): number => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (filters.status !== 'all') count++;
    if (filters.monitored !== 'all') count++;
    if (filters.libraryId !== 'all') count++;
    count += filters.genres.length;
    count += filters.gameModes.length;
    count += filters.stores.length;
    return count;
  }, [searchQuery, filters]);

  // Data loading
  const loadGames = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getGames();
      if (response.success && response.data) {
        // Parse JSON fields once when loading to avoid repeated parsing in memos
        const gamesWithParsedFields: GameWithParsedFields[] = (response.data as Game[]).map((game) => ({
          ...game,
          parsedGenres: safeParseJsonArray(game.genres),
          parsedGameModes: safeParseJsonArray(game.gameModes),
        }));
        const sortedGames = gamesWithParsedFields.sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        );
        setGames(sortedGames);
      } else {
        setError(response.error || 'Failed to load games');
      }
    } catch {
      setError('Failed to load games');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLibraries = useCallback(async () => {
    try {
      const response = await api.getLibraries();
      if (response.success && response.data) {
        setLibraries(response.data.map(lib => ({
          id: lib.id,
          name: lib.name,
          platform: lib.platform,
        })));
      }
    } catch (err) {
      console.error('Failed to load libraries:', err);
    }
  }, []);

  // Game action handlers
  const handleToggleMonitor = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/v1/games/${id}/toggle-monitor`, { method: 'POST' });
      if (response.ok) {
        loadGames();
      }
    } catch (err) {
      console.error('Failed to toggle monitor:', err);
    }
  }, [loadGames]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      const response = await api.deleteGame(id);
      if (response.success) {
        loadGames();
      }
    } catch (err) {
      console.error('Failed to delete game:', err);
    }
  }, [loadGames]);

  const handleSearch = useCallback((game: Game) => {
    setSelectedGame(game);
    setIsSearchModalOpen(true);
  }, []);

  const handleEdit = useCallback((game: Game) => {
    const path = getGameDetailPath(game.platform, game.title);
    // Use View Transition for navigation
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        navigate(path);
      });
    } else {
      navigate(path);
    }
  }, [navigate]);

  // Pagination handlers
  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    localStorage.setItem('library-page-size', newSize.toString());
  }, [setCurrentPage]);

  // Clear filters
  const clearFilters = useCallback(() => {
    // Clear all filter-related URL params in one update
    updateUrlParams({
      q: null,
      status: null,
      monitored: null,
      genres: null,
      modes: null,
      library: null,
      stores: null,
      page: null,
    });
  }, [updateUrlParams]);

  // Bulk selection helpers
  const toggleGameSelection = useCallback((gameId: number) => {
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  }, []);

  const selectAllGames = useCallback(() => {
    setSelectedGameIds(new Set(filteredAndSortedGames.map((g) => g.id)));
  }, [filteredAndSortedGames]);

  const clearSelection = useCallback(() => {
    setSelectedGameIds(new Set());
  }, []);

  const isAllSelected = filteredAndSortedGames.length > 0 && filteredAndSortedGames.every((g) => selectedGameIds.has(g.id));
  const isSomeSelected = filteredAndSortedGames.some((g) => selectedGameIds.has(g.id)) && !isAllSelected;

  // Bulk action handlers - use batch API for efficiency
  const handleBulkMonitor = useCallback(async (monitor: boolean) => {
    setBulkActionLoading(true);
    try {
      const gameIds = Array.from(selectedGameIds);
      const result = await api.batchUpdateGames(gameIds, { monitored: monitor });
      if (!result.success) {
        throw new Error(result.error || 'Failed to update games');
      }
      await loadGames();
      clearSelection();
    } catch (err) {
      console.error('Failed to update games:', err);
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedGameIds, loadGames, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    setBulkActionLoading(true);
    try {
      const gameIds = Array.from(selectedGameIds);
      const result = await api.batchDeleteGames(gameIds);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete games');
      }
      await loadGames();
      clearSelection();
    } catch (err) {
      console.error('Failed to delete games:', err);
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedGameIds, loadGames, clearSelection]);

  // Effects
  useEffect(() => {
    loadGames();
    loadLibraries();
  }, [loadGames, loadLibraries]);

  // Note: Page reset on filter/search change is handled in setFilters/setSearchQuery
  // by clearing the page param in the URL update

  return {
    // State
    games,
    isLoading,
    error,
    setError,
    viewMode,
    sortColumn,
    sortDirection,
    filters,
    searchQuery,
    libraries,

    // Modal state
    isModalOpen,
    setIsModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    selectedGame,
    setSelectedGame,
    gameToDelete,
    setGameToDelete,

    // Bulk selection
    selectedGameIds,
    bulkActionLoading,
    isAllSelected,
    isSomeSelected,

    // Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    totalPages,

    // Computed
    allGenres,
    allGameModes,
    allStores,
    filteredAndSortedGames,
    paginatedGames,
    activeFilterCount,

    // Handlers
    handleViewModeChange,
    handleSort,
    handleToggleMonitor,
    handleDelete,
    handleSearch,
    handleEdit,
    handlePageSizeChange,
    clearFilters,
    toggleGameSelection,
    selectAllGames,
    clearSelection,
    handleBulkMonitor,
    handleBulkDelete,
    loadGames,
    setSearchQuery,
    setFilters,
    setSortColumn,
    setSortDirection,
    setSort,
  };
}
