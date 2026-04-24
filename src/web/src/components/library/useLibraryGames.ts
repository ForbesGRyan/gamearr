import { useCallback, useMemo, useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';

const route = getRouteApi('/_auth/');
import {
  useBatchDeleteGames,
  useBatchUpdateGames,
  useDeleteGame,
  useGames,
  useToggleMonitor,
} from '../../queries/games';
import { useLibraries } from '../../queries/libraries';
import { queryKeys } from '../../queries/keys';
import { getGameSlugs } from '../../utils/slug';
import type {
  Filters,
  Game,
  LibraryInfo,
  SortColumn,
  SortDirection,
  ViewMode,
} from './types';

interface GameWithParsedFields extends Game {
  parsedGenres: string[];
  parsedGameModes: string[];
}

function safeParseJsonArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

function parseArrayParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

function serializeArrayParam(arr: string[]): string | null {
  return arr.length > 0 ? arr.join(',') : null;
}

export function useLibraryGames() {
  const navigate = useNavigate();
  const search = route.useSearch();
  const routeNavigate = route.useNavigate();
  const queryClient = useQueryClient();

  const gamesQuery = useGames();
  const librariesQuery = useLibraries();
  const deleteGameMutation = useDeleteGame();
  const batchUpdateMutation = useBatchUpdateGames();
  const batchDeleteMutation = useBatchDeleteGames();

  const games: GameWithParsedFields[] = useMemo(() => {
    const raw = gamesQuery.data ?? [];
    const parsed: GameWithParsedFields[] = raw.map((game) => ({
      ...game,
      parsedGenres: safeParseJsonArray(game.genres),
      parsedGameModes: safeParseJsonArray(game.gameModes),
    }));
    return parsed.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    );
  }, [gamesQuery.data]);

  const libraries: LibraryInfo[] = useMemo(
    () =>
      (librariesQuery.data ?? []).map((lib) => ({
        id: lib.id,
        name: lib.name,
        platform: lib.platform,
      })),
    [librariesQuery.data]
  );

  const isLoading = gamesQuery.isLoading;
  const queryError = gamesQuery.error;
  const [errorOverride, setErrorOverride] = useState<string | null>(null);
  const error = errorOverride ?? (queryError ? (queryError as Error).message : null);
  const setError = setErrorOverride;

  const viewMode: ViewMode =
    search.view ?? ((localStorage.getItem('library-view-mode') as ViewMode) || 'posters');

  const sortColumn: SortColumn = search.sort ?? 'title';
  const sortDirection: SortDirection = search.dir ?? 'asc';
  const searchQuery = search.q ?? '';
  const currentPage = search.page ?? 1;

  const filters: Filters = useMemo(
    () => ({
      status: search.status ?? 'all',
      monitored: search.monitored ?? 'all',
      genres: parseArrayParam(search.genres ?? null),
      gameModes: parseArrayParam(search.modes ?? null),
      libraryId: search.library ?? 'all',
      stores: parseArrayParam(search.stores ?? null),
    }),
    [search.status, search.monitored, search.genres, search.modes, search.library, search.stores]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);

  const [selectedGameIds, setSelectedGameIds] = useState<Set<number>>(new Set());
  const bulkActionLoading =
    batchUpdateMutation.isPending || batchDeleteMutation.isPending;

  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('library-page-size');
    return saved ? parseInt(saved, 10) : 25;
  });

  const updateUrlParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      routeNavigate({
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev };
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === '') {
              delete next[key];
            } else {
              next[key] = value;
            }
          }
          return next;
        },
        replace: true,
      });
    },
    [routeNavigate]
  );

  const setSortColumn = useCallback(
    (column: SortColumn) => {
      updateUrlParams({ sort: column === 'title' ? null : column });
    },
    [updateUrlParams]
  );

  const setSortDirection = useCallback(
    (dir: SortDirection) => {
      updateUrlParams({ dir: dir === 'asc' ? null : dir });
    },
    [updateUrlParams]
  );

  const setSort = useCallback(
    (column: SortColumn, direction: SortDirection) => {
      updateUrlParams({
        sort: column === 'title' ? null : column,
        dir: direction === 'asc' ? null : direction,
      });
    },
    [updateUrlParams]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      updateUrlParams({ q: query || null, page: null });
    },
    [updateUrlParams]
  );

  const setCurrentPage = useCallback(
    (page: number) => {
      updateUrlParams({ page: page === 1 ? null : String(page) });
    },
    [updateUrlParams]
  );

  const setFilters = useCallback(
    (newFilters: Filters) => {
      updateUrlParams({
        status: newFilters.status === 'all' ? null : newFilters.status,
        monitored: newFilters.monitored === 'all' ? null : newFilters.monitored,
        genres: serializeArrayParam(newFilters.genres),
        modes: serializeArrayParam(newFilters.gameModes),
        library:
          newFilters.libraryId === 'all' ? null : String(newFilters.libraryId),
        stores: serializeArrayParam(newFilters.stores),
        page: null,
      });
    },
    [updateUrlParams]
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      updateUrlParams({ view: mode === 'posters' ? null : mode });
      localStorage.setItem('library-view-mode', mode);
    },
    [updateUrlParams]
  );

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        const newDir = sortDirection === 'asc' ? 'desc' : 'asc';
        updateUrlParams({ dir: newDir === 'asc' ? null : newDir });
      } else {
        updateUrlParams({ sort: column === 'title' ? null : column, dir: null });
      }
    },
    [sortColumn, sortDirection, updateUrlParams]
  );

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
      game.stores?.forEach((s) => storeSet.add(s.name));
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
        if (game.parsedGenres.some((g) => g.toLowerCase().includes(query)))
          return true;
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
      filtered = filtered.filter((game) =>
        filters.genres.some((g) => game.parsedGenres.includes(g))
      );
    }

    if (filters.gameModes.length > 0) {
      filtered = filtered.filter((game) =>
        filters.gameModes.some((m) => game.parsedGameModes.includes(m))
      );
    }

    if (filters.libraryId !== 'all') {
      filtered = filtered.filter((game) => game.libraryId === filters.libraryId);
    }

    if (filters.stores.length > 0) {
      filtered = filtered.filter((game) => {
        const gameStoreNames = game.stores?.map((s) => s.name) || [];
        if (game.store) gameStoreNames.push(game.store);
        return filters.stores.some((s) => gameStoreNames.includes(s));
      });
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'title':
          comparison = a.title.localeCompare(b.title, undefined, {
            sensitivity: 'base',
          });
          break;
        case 'year':
          comparison = (a.year || 0) - (b.year || 0);
          break;
        case 'rating':
          comparison = (a.totalRating || 0) - (b.totalRating || 0);
          break;
        case 'monitored':
          comparison = a.monitored === b.monitored ? 0 : a.monitored ? -1 : 1;
          break;
        case 'store': {
          const aStore = a.stores?.[0]?.name || a.store || '';
          const bStore = b.stores?.[0]?.name || b.store || '';
          comparison = aStore.localeCompare(bStore, undefined, {
            sensitivity: 'base',
          });
          break;
        }
        case 'status': {
          const statusOrder = { wanted: 0, downloading: 1, downloaded: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [games, searchQuery, filters, sortColumn, sortDirection]);

  const paginatedGames = useMemo((): GameWithParsedFields[] => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedGames.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedGames, currentPage, pageSize]);

  const totalPages = useMemo(
    (): number => Math.ceil(filteredAndSortedGames.length / pageSize),
    [filteredAndSortedGames.length, pageSize]
  );

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

  const loadGames = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.games.list() });
  }, [queryClient]);

  const toggleMonitorMutation = useToggleMonitor();
  const handleToggleMonitor = useCallback(
    async (id: number) => {
      try {
        await toggleMonitorMutation.mutateAsync(id);
      } catch (err) {
        console.error('Failed to toggle monitor:', err);
      }
    },
    [toggleMonitorMutation]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteGameMutation.mutateAsync(id);
      } catch (err) {
        console.error('Failed to delete game:', err);
      }
    },
    [deleteGameMutation]
  );

  const handleSearch = useCallback((game: Game) => {
    setSelectedGame(game);
    setIsSearchModalOpen(true);
  }, []);

  const handleEdit = useCallback(
    (game: Game) => {
      const go = () =>
        navigate({
          to: '/game/$platform/$slug',
          params: getGameSlugs(game.platform, game.title),
        });
      if (document.startViewTransition) {
        document.startViewTransition(go);
      } else {
        go();
      }
    },
    [navigate]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize);
      setCurrentPage(1);
      localStorage.setItem('library-page-size', newSize.toString());
    },
    [setCurrentPage]
  );

  const clearFilters = useCallback(() => {
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

  const isAllSelected =
    filteredAndSortedGames.length > 0 &&
    filteredAndSortedGames.every((g) => selectedGameIds.has(g.id));
  const isSomeSelected =
    filteredAndSortedGames.some((g) => selectedGameIds.has(g.id)) &&
    !isAllSelected;

  const handleBulkMonitor = useCallback(
    async (monitor: boolean) => {
      try {
        const gameIds = Array.from(selectedGameIds);
        await batchUpdateMutation.mutateAsync({
          gameIds,
          updates: { monitored: monitor },
        });
        clearSelection();
      } catch (err) {
        console.error('Failed to update games:', err);
      }
    },
    [selectedGameIds, batchUpdateMutation, clearSelection]
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      const gameIds = Array.from(selectedGameIds);
      await batchDeleteMutation.mutateAsync(gameIds);
      clearSelection();
    } catch (err) {
      console.error('Failed to delete games:', err);
    }
  }, [selectedGameIds, batchDeleteMutation, clearSelection]);

  return {
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

    isModalOpen,
    setIsModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    selectedGame,
    setSelectedGame,
    gameToDelete,
    setGameToDelete,

    selectedGameIds,
    bulkActionLoading,
    isAllSelected,
    isSomeSelected,

    currentPage,
    setCurrentPage,
    pageSize,
    totalPages,

    allGenres,
    allGameModes,
    allStores,
    filteredAndSortedGames,
    paginatedGames,
    activeFilterCount,

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
