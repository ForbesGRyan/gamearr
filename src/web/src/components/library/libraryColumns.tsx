import { Link } from '@tanstack/react-router';
import type { ColumnDef, FilterFn, RowData, SortingFn } from '@tanstack/react-table';
import { getCoverUrl } from '../../utils/images';
import { getGameSlugs } from '../../utils/slug';
import StoreIcon from '../StoreIcon';
import {
  EyeIcon,
  EyeSlashIcon,
  GamepadIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
} from '../Icons';
import type { Game } from './types';

export interface GameRow extends Game {
  parsedGenres: string[];
  parsedGameModes: string[];
}

export interface LibraryTableMeta {
  onToggleMonitor: (id: number) => void;
  onSearch: (game: Game) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
}

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> extends LibraryTableMeta {}
}

// ---- Sorting fns ----

const monitoredSortFn: SortingFn<GameRow> = (a, b) =>
  a.original.monitored === b.original.monitored ? 0 : a.original.monitored ? -1 : 1;

const statusSortFn: SortingFn<GameRow> = (a, b) => {
  const order = { wanted: 0, downloading: 1, downloaded: 2 } as const;
  return order[a.original.status] - order[b.original.status];
};

const storeSortFn: SortingFn<GameRow> = (a, b) => {
  const av = a.original.stores?.[0]?.name ?? a.original.store ?? '';
  const bv = b.original.stores?.[0]?.name ?? b.original.store ?? '';
  return av.localeCompare(bv, undefined, { sensitivity: 'base' });
};

const addedAtSortFn: SortingFn<GameRow> = (a, b) => {
  const av = a.original.addedAt ? Date.parse(a.original.addedAt) : 0;
  const bv = b.original.addedAt ? Date.parse(b.original.addedAt) : 0;
  return av - bv;
};

// ---- Filter fns ----

function splitIncludeExclude(filterValue: string[]): { includes: string[]; excludes: string[] } {
  const includes: string[] = [];
  const excludes: string[] = [];
  for (const v of filterValue) {
    if (v.startsWith('!')) excludes.push(v.slice(1));
    else includes.push(v);
  }
  return { includes, excludes };
}

const arrayIncludesAnyFn: FilterFn<GameRow> = (row, columnId, filterValue: string[]) => {
  if (!filterValue?.length) return true;
  const { includes, excludes } = splitIncludeExclude(filterValue);
  const cellValue = row.getValue<string[]>(columnId);
  if (excludes.some((v) => cellValue.includes(v))) return false;
  if (includes.length === 0) return true;
  return includes.some((v) => cellValue.includes(v));
};

const storeFilterFn: FilterFn<GameRow> = (row, _columnId, filterValue: string[]) => {
  if (!filterValue?.length) return true;
  const { includes, excludes } = splitIncludeExclude(filterValue);
  const g = row.original;
  const names = [
    ...(g.stores?.map((s) => s.name) ?? []),
    ...(g.store ? [g.store] : []),
  ];
  if (excludes.some((s) => names.includes(s))) return false;
  if (includes.length === 0) return true;
  return includes.some((s) => names.includes(s));
};

const monitoredFilterFn: FilterFn<GameRow> = (row, _columnId, filterValue) => {
  if (!filterValue || filterValue === 'all') return true;
  return filterValue === 'monitored' ? row.original.monitored : !row.original.monitored;
};

const statusFilterFn: FilterFn<GameRow> = (row, _columnId, filterValue) => {
  if (!filterValue || filterValue === 'all') return true;
  return row.original.status === filterValue;
};

const libraryFilterFn: FilterFn<GameRow> = (row, _columnId, filterValue) => {
  if (filterValue === undefined || filterValue === null || filterValue === 'all') return true;
  const target = typeof filterValue === 'string' ? parseInt(filterValue, 10) : filterValue;
  return row.original.libraryId === target;
};

export const gameGlobalFilterFn: FilterFn<GameRow> = (row, _columnId, filterValue: string) => {
  const q = (filterValue ?? '').toLowerCase().trim();
  if (!q) return true;
  const g = row.original;
  if (g.title.toLowerCase().includes(q)) return true;
  if (g.developer?.toLowerCase().includes(q)) return true;
  if (g.publisher?.toLowerCase().includes(q)) return true;
  if (g.parsedGenres.some((genre) => genre.toLowerCase().includes(q))) return true;
  return false;
};
gameGlobalFilterFn.autoRemove = (val: string) => !val?.trim();

// ---- Cell sub-components ----

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ariaLabel?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={onChange}
      aria-label={ariaLabel}
      className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
    />
  );
}

function TitleCell({ game }: { game: GameRow }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        to="/game/$platform/$slug"
        params={getGameSlugs(game.platform, game.title)}
        className="w-8 h-10 rounded bg-gray-700 flex-shrink-0 overflow-hidden"
        style={{ viewTransitionName: `game-cover-${game.id}` }}
      >
        {game.coverUrl ? (
          <img src={getCoverUrl(game.id, game.coverUrl)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <GamepadIcon className="w-4 h-4" />
          </div>
        )}
      </Link>
      <Link
        to="/game/$platform/$slug"
        params={getGameSlugs(game.platform, game.title)}
        className="font-medium hover:text-blue-400 transition"
      >
        {game.title}
      </Link>
      {game.updateAvailable && (
        <span className="text-xs bg-orange-500 px-1.5 py-0.5 rounded flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Update
        </span>
      )}
    </div>
  );
}

function RatingBadge({ value }: { value: number | null | undefined }) {
  if (!value) return <span className="text-gray-500">{'—'}</span>;
  const cls =
    value >= 95 ? 'bg-sky-500' :
    value >= 90 ? 'bg-green-700' :
    value >= 85 ? 'bg-green-600' :
    value >= 80 ? 'bg-green-500' :
    value >= 70 ? 'bg-yellow-600' :
    value >= 60 ? 'bg-orange-600' : 'bg-red-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${cls}`}>{value}%</span>;
}

function StatusBadge({ status }: { status: GameRow['status'] }) {
  const cls =
    status === 'downloaded' ? 'bg-green-600' :
    status === 'downloading' ? 'bg-blue-600' : 'bg-yellow-600';
  const label =
    status === 'downloaded' ? 'Downloaded' :
    status === 'downloading' ? 'Downloading' : 'Wanted';
  return <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function StoreCell({ game }: { game: GameRow }) {
  if ((game.stores?.length ?? 0) === 0 && !game.store) {
    return <span className="text-gray-500">{'—'}</span>;
  }
  return <StoreIcon stores={game.stores} store={game.store} />;
}

function RowActions({
  game,
  meta,
}: {
  game: GameRow;
  meta: LibraryTableMeta;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button
        onClick={() => meta.onToggleMonitor(game.id)}
        className="p-1.5 rounded hover:bg-gray-600 transition"
        title={game.monitored ? 'Unmonitor' : 'Monitor'}
      >
        {game.monitored ? <EyeIcon /> : <EyeSlashIcon />}
      </button>
      <button
        onClick={() => meta.onSearch(game)}
        className="p-1.5 rounded hover:bg-gray-600 transition"
        title="Search"
      >
        <MagnifyingGlassIcon />
      </button>
      <button
        onClick={() => meta.onEdit(game)}
        className="p-1.5 rounded hover:bg-gray-600 transition"
        title="Edit"
      >
        <PencilIcon />
      </button>
      <button
        onClick={() => meta.onDelete(game)}
        className="p-1.5 rounded hover:bg-red-600 transition"
        title="Delete"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ---- Column definitions ----

export const libraryColumns: ColumnDef<GameRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <IndeterminateCheckbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        ariaLabel="Select all rows"
      />
    ),
    cell: ({ row }) => (
      <IndeterminateCheckbox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        ariaLabel={`Select ${row.original.title}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    enableGlobalFilter: false,
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => <TitleCell game={row.original} />,
    sortingFn: 'alphanumeric',
  },
  {
    id: 'year',
    accessorKey: 'year',
    header: 'Year',
    cell: ({ getValue }) => {
      const v = getValue<number | undefined>();
      return v ? <span className="text-gray-400">{v}</span> : <span className="text-gray-400">{'—'}</span>;
    },
    sortingFn: 'basic',
    enableGlobalFilter: false,
  },
  {
    id: 'rating',
    accessorKey: 'totalRating',
    header: 'Rating',
    cell: ({ getValue }) => <RatingBadge value={getValue<number | null | undefined>()} />,
    sortingFn: 'basic',
    enableGlobalFilter: false,
  },
  {
    id: 'genres',
    accessorFn: (row) => row.parsedGenres,
    header: 'Genres',
    cell: ({ getValue }) => {
      const genres = getValue<string[]>();
      return <span className="text-gray-400 truncate inline-block max-w-[160px]">{genres.slice(0, 2).join(', ') || '—'}</span>;
    },
    filterFn: arrayIncludesAnyFn,
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    id: 'monitored',
    accessorKey: 'monitored',
    header: () => <EyeIcon className="w-4 h-4 mx-auto" />,
    cell: ({ getValue }) =>
      getValue<boolean>() ? (
        <EyeIcon className="w-4 h-4 mx-auto text-green-400" />
      ) : (
        <EyeSlashIcon className="w-4 h-4 mx-auto text-gray-500" />
      ),
    sortingFn: monitoredSortFn,
    filterFn: monitoredFilterFn,
    enableGlobalFilter: false,
  },
  {
    id: 'stores',
    accessorFn: (row) => row.stores ?? [],
    header: 'Store',
    cell: ({ row }) => <StoreCell game={row.original} />,
    sortingFn: storeSortFn,
    filterFn: storeFilterFn,
    enableGlobalFilter: false,
  },
  {
    id: 'libraryId',
    accessorKey: 'libraryId',
    header: 'Library',
    filterFn: libraryFilterFn,
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    id: 'gameModes',
    accessorFn: (row) => row.parsedGameModes,
    header: 'Modes',
    filterFn: arrayIncludesAnyFn,
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue<GameRow['status']>()} />,
    sortingFn: statusSortFn,
    filterFn: statusFilterFn,
    enableGlobalFilter: false,
  },
  {
    id: 'addedAt',
    accessorKey: 'addedAt',
    header: 'Added',
    cell: ({ getValue }) => {
      const v = getValue<string | undefined>();
      if (!v) return <span className="text-gray-500">{'—'}</span>;
      const d = new Date(v);
      return <span className="text-gray-400">{d.toLocaleDateString()}</span>;
    },
    sortingFn: addedAtSortFn,
    enableGlobalFilter: false,
  },
  {
    id: 'actions',
    header: () => <span className="text-right block">Actions</span>,
    cell: ({ row, table }) => (
      <RowActions game={row.original} meta={table.options.meta as LibraryTableMeta} />
    ),
    enableSorting: false,
    enableHiding: false,
    enableGlobalFilter: false,
  },
];

export const DEFAULT_HIDDEN_COLUMNS = {
  libraryId: false,
  gameModes: false,
  addedAt: false,
} as const;
