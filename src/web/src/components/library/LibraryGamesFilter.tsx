import { useRef, useState } from 'react';
import type { Table } from '@tanstack/react-table';
import { MagnifyingGlassIcon } from '../Icons';
import { FilterPopover } from './FilterPopover';
import { SortPopover, getSortLabel } from './SortPopover';
import { ActiveFilterChips } from './ActiveFilterChips';
import type { GameRow } from './libraryColumns';
import type { LibraryInfo } from './types';

interface LibraryGamesFilterProps {
  table: Table<GameRow>;
  allGenres: string[];
  allGameModes: string[];
  allStores: string[];
  libraries: LibraryInfo[];
  filteredCount: number;
  totalCount: number;
  activeFilterCount: number;
}

function ChevronDown({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FilterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function SortIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
    </svg>
  );
}

export function LibraryGamesFilter({
  table,
  allGenres,
  allGameModes,
  allStores,
  libraries,
  filteredCount,
  totalCount,
  activeFilterCount,
}: LibraryGamesFilterProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filtersBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  const globalFilter = table.getState().globalFilter ?? '';
  const sorting = table.getState().sorting[0];
  const sortLabel = getSortLabel(sorting?.id, sorting?.desc ?? false);

  return (
    <div className="mb-4">
      <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
        <div className="flex flex-row items-stretch gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search games..."
              value={globalFilter}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {globalFilter && (
              <button
                onClick={() => table.setGlobalFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white"
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          {/* Filters button */}
          <div className="relative shrink-0">
            <button
              ref={filtersBtnRef}
              type="button"
              onClick={() => {
                setFiltersOpen((v) => !v);
                setSortOpen(false);
              }}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              className={`h-full inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition border ${
                activeFilterCount > 0
                  ? 'bg-blue-600/20 border-blue-500 text-blue-100 hover:bg-blue-600/30'
                  : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
              }`}
            >
              <FilterIcon />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white rounded-full text-[11px] font-semibold min-w-[1.25rem] px-1.5 py-0.5 leading-none inline-flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown />
            </button>
            <FilterPopover
              table={table}
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              anchorRef={filtersBtnRef}
              allGenres={allGenres}
              allGameModes={allGameModes}
              allStores={allStores}
              libraries={libraries}
            />
          </div>

          {/* Sort button */}
          <div className="relative shrink-0">
            <button
              ref={sortBtnRef}
              type="button"
              onClick={() => {
                setSortOpen((v) => !v);
                setFiltersOpen(false);
              }}
              aria-expanded={sortOpen}
              aria-haspopup="menu"
              className="h-full inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-gray-700 border border-gray-600 text-gray-200 hover:bg-gray-600 transition"
            >
              <SortIcon />
              <span className="hidden md:inline truncate max-w-[10rem]">{sortLabel}</span>
              <ChevronDown />
            </button>
            <SortPopover
              table={table}
              open={sortOpen}
              onClose={() => setSortOpen(false)}
              anchorRef={sortBtnRef}
            />
          </div>
        </div>

        <ActiveFilterChips table={table} libraries={libraries} />

        {activeFilterCount > 0 && (
          <div className="text-xs text-gray-400 mt-2">
            Showing {filteredCount} of {totalCount} games
          </div>
        )}
      </div>
    </div>
  );
}
