import type { Table } from '@tanstack/react-table';
import type { GameRow } from './libraryColumns';
import type { LibraryInfo } from './types';

interface ActiveFilterChipsProps {
  table: Table<GameRow>;
  libraries: LibraryInfo[];
}

const STATUS_LABEL: Record<string, string> = {
  wanted: 'Wanted',
  downloading: 'Downloading',
  downloaded: 'Downloaded',
};

const STATUS_COLOR: Record<string, string> = {
  wanted: 'bg-yellow-600 hover:bg-yellow-500',
  downloading: 'bg-blue-600 hover:bg-blue-500',
  downloaded: 'bg-green-600 hover:bg-green-500',
};

const MONITORED_LABEL: Record<string, string> = {
  monitored: 'Monitored',
  unmonitored: 'Unmonitored',
};

function Chip({
  label,
  onRemove,
  color,
}: {
  label: string;
  onRemove: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={`text-xs ${color} text-white px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition shrink-0`}
      aria-label={`Remove ${label} filter`}
    >
      <span>{label}</span>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export function ActiveFilterChips({ table, libraries }: ActiveFilterChipsProps) {
  const status = table.getColumn('status')?.getFilterValue() as string | undefined;
  const monitored = table.getColumn('monitored')?.getFilterValue() as string | undefined;
  const libraryRaw = table.getColumn('libraryId')?.getFilterValue();
  const libraryId =
    libraryRaw === undefined || libraryRaw === null ? undefined : (libraryRaw as number);
  const genres = (table.getColumn('genres')?.getFilterValue() as string[] | undefined) ?? [];
  const modes = (table.getColumn('gameModes')?.getFilterValue() as string[] | undefined) ?? [];
  const stores = (table.getColumn('stores')?.getFilterValue() as string[] | undefined) ?? [];

  const libraryName = libraryId !== undefined ? libraries.find((l) => l.id === libraryId)?.name : undefined;

  const total =
    (status ? 1 : 0) +
    (monitored ? 1 : 0) +
    (libraryId !== undefined ? 1 : 0) +
    genres.length +
    modes.length +
    stores.length;

  if (total === 0) return null;

  const removeArr = (id: string, current: string[], value: string) => {
    const next = current.filter((v) => v !== value);
    table.getColumn(id)?.setFilterValue(next.length ? next : undefined);
  };

  return (
    <div className="flex gap-2 mt-3 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-1">
      {status && (
        <Chip
          label={`Status: ${STATUS_LABEL[status] ?? status}`}
          color={STATUS_COLOR[status] ?? 'bg-gray-600 hover:bg-gray-500'}
          onRemove={() => table.getColumn('status')?.setFilterValue(undefined)}
        />
      )}
      {monitored && (
        <Chip
          label={MONITORED_LABEL[monitored] ?? monitored}
          color="bg-slate-600 hover:bg-slate-500"
          onRemove={() => table.getColumn('monitored')?.setFilterValue(undefined)}
        />
      )}
      {libraryId !== undefined && (
        <Chip
          label={`Library: ${libraryName ?? libraryId}`}
          color="bg-indigo-600 hover:bg-indigo-500"
          onRemove={() => table.getColumn('libraryId')?.setFilterValue(undefined)}
        />
      )}
      {stores.map((s) => (
        <Chip
          key={`store-${s}`}
          label={s}
          color="bg-green-600 hover:bg-green-500"
          onRemove={() => removeArr('stores', stores, s)}
        />
      ))}
      {genres.map((g) => (
        <Chip
          key={`genre-${g}`}
          label={g}
          color="bg-blue-600 hover:bg-blue-500"
          onRemove={() => removeArr('genres', genres, g)}
        />
      ))}
      {modes.map((m) => (
        <Chip
          key={`mode-${m}`}
          label={m}
          color="bg-purple-600 hover:bg-purple-500"
          onRemove={() => removeArr('gameModes', modes, m)}
        />
      ))}
    </div>
  );
}
