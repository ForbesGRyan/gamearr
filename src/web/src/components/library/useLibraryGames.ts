import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { getGameDetailPath } from '../../utils/slug';
import type { Game, ViewMode, SortColumn, SortDirection, Filters, LibraryInfo } from './types';

export function useLibraryGames() {
  const navigate = useNavigate();

  // Core state
  const [games, setGames] = useState<Game[]>([]);
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

  // Computed values
  const allGenres = useMemo((): string[] => {
    const genreSet = new Set<string>();
    games.forEach((game) => {
      if (game.genres) {
        try {
          const parsed = JSON.parse(game.genres) as string[];
          parsed.forEach((g) => genreSet.add(g));
        } catch {}
      }
    });
    return Array.from(genreSet).sort();
  }, [games]);

  const allGameModes = useMemo((): string[] => {
    const modeSet = new Set<string>();
    games.forEach((game) => {
      if (game.gameModes) {
        try {
          const parsed = JSON.parse(game.gameModes) as string[];
          parsed.forEach((m) => modeSet.add(m));
        } catch {}
      }
    });
    return Array.from(modeSet).sort();
  }, [games]);

  const filteredAndSortedGames = useMemo((): Game[] => {
    let filtered = games;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((game) => {
        if (game.title.toLowerCase().includes(query)) return true;
        if (game.developer?.toLowerCase().includes(query)) return true;
        if (game.publisher?.toLowerCase().includes(query)) return true;
        if (game.genres) {
          try {
            const genres = JSON.parse(game.genres) as string[];
            if (genres.some(g => g.toLowerCase().includes(query))) return true;
          } catch {}
        }
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
        if (!game.genres) return false;
        try {
          const gameGenres = JSON.parse(game.genres) as string[];
          return filters.genres.some((g) => gameGenres.includes(g));
        } catch {
          return false;
        }
      });
    }

    if (filters.gameModes.length > 0) {
      filtered = filtered.filter((game) => {
        if (!game.gameModes) return false;
        try {
          const modes = JSON.parse(game.gameModes) as string[];
          return filters.gameModes.some((m) => modes.includes(m));
        } catch {
          return false;
        }
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
          comparison = (a.store || '').localeCompare(b.store || '', undefined, { sensitivity: 'base' });
          break;
        case 'status':
          const statusOrder = { wanted: 0, downloading: 1, downloaded: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [games, searchQuery, filters, sortColumn, sortDirection]);

  const paginatedGames = useMemo((): Game[] => {
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
        const sortedGames = (response.data as Game[]).sort((a, b) =>
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
    navigate(getGameDetailPath(game.platform, game.title));
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

  // Bulk action handlers
  const handleBulkMonitor = useCallback(async (monitor: boolean) => {
    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedGameIds).map((id) =>
        api.updateGame(id, { monitored: monitor })
      );
      await Promise.all(promises);
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
      const promises = Array.from(selectedGameIds).map((id) => api.deleteGame(id));
      await Promise.all(promises);
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
