import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type VisibilityState,
} from '@tanstack/react-table';

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

import {
  DEFAULT_HIDDEN_COLUMNS,
  gameGlobalFilterFn,
  libraryColumns,
  type GameRow,
  type LibraryTableMeta,
} from './libraryColumns';
import { useUrlSyncedTableState } from './useUrlSyncedTableState';
import { useLibraryFilterOptions } from './useLibraryFilterOptions';
import type { Game, LibraryInfo, PosterSize, ViewMode } from './types';

const route = getRouteApi('/_auth/');
const COLUMN_VIS_KEY = 'library-column-visibility';
const VIEW_MODE_KEY = 'library-view-mode';
const POSTER_SIZE_KEY = 'library-poster-size';

function safeParseJsonArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function loadColumnVisibility(): VisibilityState {
  if (typeof window === 'undefined') return { ...DEFAULT_HIDDEN_COLUMNS };
  try {
    const saved = localStorage.getItem(COLUMN_VIS_KEY);
    if (!saved) return { ...DEFAULT_HIDDEN_COLUMNS };
    const parsed = JSON.parse(saved) as VisibilityState;
    return { ...DEFAULT_HIDDEN_COLUMNS, ...parsed };
  } catch {
    return { ...DEFAULT_HIDDEN_COLUMNS };
  }
}

export function useLibraryTable() {
  const navigate = useNavigate();
  const search = route.useSearch();
  const routeNavigate = route.useNavigate();
  const queryClient = useQueryClient();

  // ---- Data ----

  const gamesQuery = useGames();
  const librariesQuery = useLibraries();
  const deleteGameMutation = useDeleteGame();
  const batchUpdateMutation = useBatchUpdateGames();
  const batchDeleteMutation = useBatchDeleteGames();
  const toggleMonitorMutation = useToggleMonitor();

  const games: GameRow[] = useMemo(() => {
    const raw = gamesQuery.data ?? [];
    const parsed: GameRow[] = raw.map((g) => ({
      ...g,
      parsedGenres: safeParseJsonArray(g.genres),
      parsedGameModes: safeParseJsonArray(g.gameModes),
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

  // ---- View mode (URL-synced + localStorage fallback) ----

  const viewMode: ViewMode =
    search.view ??
    ((typeof window !== 'undefined' && (localStorage.getItem(VIEW_MODE_KEY) as ViewMode)) || 'posters');

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      routeNavigate({
        search: (prev) => ({ ...prev, view: mode }),
        replace: true,
        viewTransition: false,
      });
      try {
        localStorage.setItem(VIEW_MODE_KEY, mode);
      } catch {
        // ignore
      }
    },
    [routeNavigate]
  );

  // Poster grid density (URL-synced, falls back to localStorage)
  const posterSize: PosterSize =
    search.size ??
    ((typeof window !== 'undefined' && (localStorage.getItem(POSTER_SIZE_KEY) as PosterSize)) || 'md');

  const handlePosterSizeChange = useCallback(
    (size: PosterSize) => {
      routeNavigate({
        search: (prev) => ({ ...prev, size }),
        replace: true,
        viewTransition: false,
      });
      try {
        localStorage.setItem(POSTER_SIZE_KEY, size);
      } catch {
        // ignore
      }
    },
    [routeNavigate]
  );

  // ---- Modal state ----

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);

  // ---- URL-synced table state ----

  const {
    sorting,
    columnFilters,
    globalFilter,
    pagination,
    onSortingChange,
    onColumnFiltersChange: onColumnFiltersChangeRaw,
    onGlobalFilterChange: onGlobalFilterChangeRaw,
    onPaginationChange,
  } = useUrlSyncedTableState();

  // ---- Local-only table state ----

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(loadColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const handleColumnVisibilityChange = useCallback(
    (updater: Parameters<typeof setColumnVisibility>[0]) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: VisibilityState) => VisibilityState)(prev) : updater;
        try {
          localStorage.setItem(COLUMN_VIS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  // Reset row selection when filters change.
  const onColumnFiltersChange: typeof onColumnFiltersChangeRaw = useCallback(
    (updater) => {
      setRowSelection({});
      onColumnFiltersChangeRaw(updater);
    },
    [onColumnFiltersChangeRaw]
  );
  const onGlobalFilterChange: typeof onGlobalFilterChangeRaw = useCallback(
    (updater) => {
      setRowSelection({});
      onGlobalFilterChangeRaw(updater);
    },
    [onGlobalFilterChangeRaw]
  );

  // ---- Action handlers (passed via meta) ----

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
      navigate({
        to: '/game/$platform/$slug',
        params: getGameSlugs(game.platform, game.title),
      });
    },
    [navigate]
  );

  const handleDeleteFromRow = useCallback((game: Game) => {
    setGameToDelete(game);
  }, []);

  // ---- Build the table ----

  const meta: LibraryTableMeta = useMemo(
    () => ({
      onToggleMonitor: handleToggleMonitor,
      onSearch: handleSearch,
      onEdit: handleEdit,
      onDelete: handleDeleteFromRow,
    }),
    [handleToggleMonitor, handleSearch, handleEdit, handleDeleteFromRow]
  );

  const table = useReactTable<GameRow>({
    data: games,
    columns: libraryColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
      columnVisibility,
      rowSelection,
    },
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: gameGlobalFilterFn,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    autoResetPageIndex: false, // we manage page reset ourselves on filter change
    manualSorting: false,
    manualFiltering: false,
    manualPagination: false,
    meta,
  });

  // Keep page in range when filtered count drops below current page.
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  useEffect(() => {
    if (pageCount > 0 && pagination.pageIndex >= pageCount) {
      table.setPageIndex(0);
    }
  }, [pageCount, pagination.pageIndex, table]);

  // ---- Filter option lists (derived from UNFILTERED data) ----

  const { allGenres, allGameModes, allStores } = useLibraryFilterOptions(games);

  // ---- Bulk actions ----

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number),
    [rowSelection]
  );

  const bulkActionLoading = batchUpdateMutation.isPending || batchDeleteMutation.isPending;

  const handleBulkMonitor = useCallback(
    async (monitor: boolean) => {
      try {
        await batchUpdateMutation.mutateAsync({
          gameIds: selectedIds,
          updates: { monitored: monitor },
        });
        setRowSelection({});
      } catch (err) {
        console.error('Failed to update games:', err);
      }
    },
    [batchUpdateMutation, selectedIds]
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      await batchDeleteMutation.mutateAsync(selectedIds);
      setRowSelection({});
    } catch (err) {
      console.error('Failed to delete games:', err);
    }
  }, [batchDeleteMutation, selectedIds]);

  const selectAllFiltered = useCallback(() => {
    table.toggleAllRowsSelected(true);
  }, [table]);

  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, []);

  // ---- Misc ----

  const loadGames = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.games.list() });
  }, [queryClient]);

  const activeFilterCount =
    columnFilters.length + (globalFilter.trim() ? 1 : 0);

  return {
    table,
    games,
    libraries,
    allGenres,
    allGameModes,
    allStores,
    isLoading,
    error,
    setError: setErrorOverride,

    viewMode,
    handleViewModeChange,
    posterSize,
    handlePosterSizeChange,

    isModalOpen,
    setIsModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    selectedGame,
    setSelectedGame,
    gameToDelete,
    setGameToDelete,

    // Bulk
    selectedIds,
    selectedCount: selectedIds.length,
    bulkActionLoading,
    handleBulkMonitor,
    handleBulkDelete,
    selectAllFiltered,
    clearSelection,
    filteredCount,

    // Single-row actions still reachable from the page (e.g. ConfirmModal)
    handleDelete,

    activeFilterCount,
    loadGames,
  };
}
