import { useEffect, useRef } from 'react';
import type { Table } from '@tanstack/react-table';
import type { GameRow } from './libraryColumns';
import type { LibraryInfo } from './types';

interface FilterPopoverProps {
  table: Table<GameRow>;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  allGenres: string[];
  allGameModes: string[];
  allStores: string[];
  libraries: LibraryInfo[];
}

const STATUS_OPTIONS = [
  { value: undefined, label: 'All' },
  { value: 'wanted', label: 'Wanted' },
  { value: 'downloading', label: 'Downloading' },
  { value: 'downloaded', label: 'Downloaded' },
] as const;

const MONITORED_OPTIONS = [
  { value: undefined, label: 'All' },
  { value: 'monitored', label: 'Monitored' },
  { value: 'unmonitored', label: 'Unmonitored' },
] as const;

function ToggleGroup<T extends string | undefined>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-md text-sm transition border ${
                active
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-700/60 border-gray-600 text-gray-200 hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChipPicker({
  label,
  options,
  selected,
  onToggle,
  emptyHint,
  activeColor,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyHint?: string;
  activeColor: string;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5">{selected.length}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-full text-xs transition border ${
                active
                  ? `${activeColor} text-white border-transparent`
                  : 'bg-gray-700/60 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {emptyHint && options.length === 0 && (
        <div className="text-xs text-gray-500 italic">{emptyHint}</div>
      )}
    </div>
  );
}

export function FilterPopover({
  table,
  open,
  onClose,
  anchorRef,
  allGenres,
  allGameModes,
  allStores,
  libraries,
}: FilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click — but ignore clicks on the trigger button (anchor),
  // because that button itself toggles the popover.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const pop = popoverRef.current;
      const anchor = anchorRef.current;
      const target = e.target as Node;
      if (pop?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const status = (table.getColumn('status')?.getFilterValue() as string | undefined);
  const monitored = (table.getColumn('monitored')?.getFilterValue() as string | undefined);
  const libraryRaw = table.getColumn('libraryId')?.getFilterValue();
  const libraryId =
    libraryRaw === undefined || libraryRaw === null ? 'all' : (libraryRaw as number);
  const genres = (table.getColumn('genres')?.getFilterValue() as string[] | undefined) ?? [];
  const modes = (table.getColumn('gameModes')?.getFilterValue() as string[] | undefined) ?? [];
  const stores = (table.getColumn('stores')?.getFilterValue() as string[] | undefined) ?? [];

  const setColFilter = (id: string, value: unknown) => {
    table.getColumn(id)?.setFilterValue(value);
  };

  const toggleArr = (id: string, current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setColFilter(id, next.length ? next : undefined);
  };

  const clearAll = () => {
    table.resetColumnFilters();
  };

  const hasAny = !!status || !!monitored || libraryId !== 'all' || genres.length || modes.length || stores.length;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Filter games"
      className="absolute z-30 mt-2 right-0 w-[min(calc(100vw-2rem),32rem)] max-h-[min(70vh,640px)] overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 space-y-4"
    >
      <ToggleGroup
        label="Status"
        options={STATUS_OPTIONS}
        value={status as 'wanted' | 'downloading' | 'downloaded' | undefined}
        onChange={(v) => setColFilter('status', v)}
      />

      <ToggleGroup
        label="Monitored"
        options={MONITORED_OPTIONS}
        value={monitored as 'monitored' | 'unmonitored' | undefined}
        onChange={(v) => setColFilter('monitored', v)}
      />

      {libraries.length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">Library</div>
          <select
            value={libraryId === 'all' ? 'all' : String(libraryId)}
            onChange={(e) => {
              const v = e.target.value;
              setColFilter('libraryId', v === 'all' ? undefined : parseInt(v, 10));
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Libraries</option>
            {libraries.map((lib) => (
              <option key={lib.id} value={lib.id}>
                {lib.name}
                {lib.platform ? ` (${lib.platform})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <ChipPicker
        label="Stores"
        options={allStores}
        selected={stores}
        onToggle={(v) => toggleArr('stores', stores, v)}
        activeColor="bg-green-600"
      />

      <ChipPicker
        label="Genres"
        options={allGenres}
        selected={genres}
        onToggle={(v) => toggleArr('genres', genres, v)}
        activeColor="bg-blue-600"
      />

      <ChipPicker
        label="Modes"
        options={allGameModes}
        selected={modes}
        onToggle={(v) => toggleArr('gameModes', modes, v)}
        activeColor="bg-purple-600"
      />

      <div className="flex items-center justify-between pt-2 border-t border-gray-700">
        <button
          type="button"
          onClick={clearAll}
          disabled={!hasAny}
          className="text-sm text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed transition"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md px-4 py-1.5 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
