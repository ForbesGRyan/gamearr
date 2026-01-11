import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { getGameDetailPath } from '../../utils/slug';
import type { Game, ViewMode, SortColumn, SortDirection, Filters, LibraryInfo } from './types';

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

export function useLibraryGames() {
  const navigate = useNavigate();

  // Core state - games with pre-parsed JSON fields for performance
  const [games, setGames] = useState<GameWithParsedFields[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('library-view-mode');
    return (saved as ViewMode) || 'posters';
  });
  const [sortColumn, setSortColumn] = useState<SortColumn>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    monitored: 'all',
    genres: [],
    gameModes: [],
    libraryId: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);

  // Bulk selection state
  const [selectedGameIds, setSelectedGameIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('library-page-size');
    return saved ? parseInt(saved, 10) : 25;
  });

  // View mode handler
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('library-view-mode', mode);
  }, []);

  // Sort handler
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

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
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({
      status: 'all',
      monitored: 'all',
      genres: [],
      gameModes: [],
      libraryId: 'all',
    });
  }, []);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sortColumn, sortDirection]);

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
  };
}
