import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
} from '@tanstack/react-table';

const route = getRouteApi('/_auth/');

const PAGE_SIZE_KEY = 'library-page-size';
const DEFAULT_PAGE_SIZE = 25;
const GLOBAL_FILTER_DEBOUNCE_MS = 200;

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
}

function parseArrayParam(value: string | undefined | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

function serializeArrayParam(arr: string[]): string | null {
  return arr.length > 0 ? arr.join(',') : null;
}

interface RawSearch {
  sort?: 'title' | 'year' | 'rating' | 'monitored' | 'store' | 'status';
  dir?: 'asc' | 'desc';
  q?: string;
  page?: number;
  status?: 'all' | 'wanted' | 'downloading' | 'downloaded';
  monitored?: 'all' | 'monitored' | 'unmonitored';
  genres?: string;
  modes?: string;
  library?: number;
  stores?: string;
}

// Map the URL `sort` value (uses 'store') to the internal column id ('stores').
function urlSortToColumnId(sort: RawSearch['sort'] | undefined): string {
  if (!sort) return 'title';
  if (sort === 'store') return 'stores';
  return sort;
}

function columnIdToUrlSort(id: string): RawSearch['sort'] | null {
  if (id === 'title') return null;
  if (id === 'stores') return 'store';
  if (
    id === 'year' || id === 'rating' || id === 'monitored' ||
    id === 'status'
  ) {
    return id;
  }
  return null;
}

export function useUrlSyncedTableState() {
  const search = route.useSearch() as RawSearch & Record<string, unknown>;
  const navigate = route.useNavigate();

  // ---- Sorting ----

  const sorting: SortingState = useMemo(
    () => [
      {
        id: urlSortToColumnId(search.sort),
        desc: search.dir === 'desc',
      },
    ],
    [search.sort, search.dir]
  );

  const updateUrl = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      navigate({
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev };
          for (const [k, v] of Object.entries(updates)) {
            if (v === null || v === undefined || v === '') delete next[k];
            else next[k] = v;
          }
          return next;
        },
        replace: true,
      });
    },
    [navigate]
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = resolveUpdater(updater, sorting);
      const first = next[0];
      if (!first) {
        updateUrl({ sort: null, dir: null });
        return;
      }
      updateUrl({
        sort: columnIdToUrlSort(first.id),
        dir: first.desc ? 'desc' : null,
      });
    },
    [sorting, updateUrl]
  );

  // ---- Column filters ----

  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters: ColumnFiltersState = [];
    if (search.status && search.status !== 'all') {
      filters.push({ id: 'status', value: search.status });
    }
    if (search.monitored && search.monitored !== 'all') {
      filters.push({ id: 'monitored', value: search.monitored });
    }
    const genres = parseArrayParam(search.genres);
    if (genres.length) filters.push({ id: 'genres', value: genres });
    const modes = parseArrayParam(search.modes);
    if (modes.length) filters.push({ id: 'gameModes', value: modes });
    if (search.library !== undefined && search.library !== null) {
      filters.push({ id: 'libraryId', value: search.library });
    }
    const stores = parseArrayParam(search.stores);
    if (stores.length) filters.push({ id: 'stores', value: stores });
    return filters;
  }, [search.status, search.monitored, search.genres, search.modes, search.library, search.stores]);

  const onColumnFiltersChange = useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      const next = resolveUpdater(updater, columnFilters);
      const find = (id: string) => next.find((f) => f.id === id)?.value;
      updateUrl({
        status: (find('status') as string | undefined) ?? null,
        monitored: (find('monitored') as string | undefined) ?? null,
        genres: serializeArrayParam((find('genres') as string[] | undefined) ?? []),
        modes: serializeArrayParam((find('gameModes') as string[] | undefined) ?? []),
        library: (() => {
          const v = find('libraryId');
          if (v === undefined || v === null || v === 'all') return null;
          return typeof v === 'string' ? parseInt(v, 10) : (v as number);
        })(),
        stores: serializeArrayParam((find('stores') as string[] | undefined) ?? []),
        page: null, // reset to page 1 on filter change
      });
    },
    [columnFilters, updateUrl]
  );

  // ---- Global filter (debounced URL writes) ----

  const urlGlobalFilter = search.q ?? '';
  const [localGlobalFilter, setLocalGlobalFilter] = useState<string>(urlGlobalFilter);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local back from URL when it changes externally (back/forward).
  useEffect(() => {
    setLocalGlobalFilter(urlGlobalFilter);
  }, [urlGlobalFilter]);

  const onGlobalFilterChange = useCallback(
    (updater: Updater<string>) => {
      const next = resolveUpdater(updater, localGlobalFilter);
      setLocalGlobalFilter(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateUrl({ q: next || null, page: null });
      }, GLOBAL_FILTER_DEBOUNCE_MS);
    },
    [localGlobalFilter, updateUrl]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- Pagination ----

  const initialPageSize = useMemo(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(PAGE_SIZE_KEY) : null;
    const n = saved ? parseInt(saved, 10) : DEFAULT_PAGE_SIZE;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE;
  }, []);

  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: Math.max(0, (search.page ?? 1) - 1),
      pageSize,
    }),
    [search.page, pageSize]
  );

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = resolveUpdater(updater, pagination);
      if (next.pageSize !== pagination.pageSize) {
        setPageSize(next.pageSize);
        try {
          localStorage.setItem(PAGE_SIZE_KEY, String(next.pageSize));
        } catch {
          // ignore quota errors
        }
      }
      const urlPage = next.pageIndex === 0 ? null : next.pageIndex + 1;
      if (urlPage !== (search.page ?? null)) {
        updateUrl({ page: urlPage });
      }
    },
    [pagination, search.page, updateUrl]
  );

  return {
    sorting,
    columnFilters,
    globalFilter: localGlobalFilter,
    pagination,
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange,
  };
}
