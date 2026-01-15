import { MagnifyingGlassIcon } from '../Icons';
import type { Filters, SortColumn, SortDirection, StatusFilter, MonitoredFilter, LibraryInfo } from './types';

interface LibraryFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSortChange: (column: SortColumn, direction: SortDirection) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  allGenres: string[];
  allGameModes: string[];
  activeFilterCount: number;
  filteredCount: number;
  totalCount: number;
  libraries?: LibraryInfo[];
}

export function LibraryFilterBar({
  searchQuery,
  onSearchChange,
  sortColumn,
  sortDirection,
  onSortChange,
  filters,
  onFiltersChange,
  allGenres,
  allGameModes,
  activeFilterCount,
  filteredCount,
  totalCount,
  libraries = [],
}: LibraryFilterBarProps) {
  const toggleGenreFilter = (genre: string) => {
    onFiltersChange({
      ...filters,
      genres: filters.genres.includes(genre)
        ? filters.genres.filter((g) => g !== genre)
        : [...filters.genres, genre],
    });
  };

  const toggleGameModeFilter = (mode: string) => {
    onFiltersChange({
      ...filters,
      gameModes: filters.gameModes.includes(mode)
        ? filters.gameModes.filter((m) => m !== mode)
        : [...filters.gameModes, mode],
    });
  };

  const clearFilters = () => {
    onSearchChange('');
    onFiltersChange({
      status: 'all',
      monitored: 'all',
      genres: [],
      gameModes: [],
      libraryId: 'all',
    });
  };

  return (
    <div className="mb-6 bg-gray-800 rounded-lg p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-auto">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded pl-9 pr-8 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto sm:min-w-[200px]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1 flex items-center justify-center"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-sm text-gray-400 shrink-0">Sort:</label>
          <select
            value={`${sortColumn}-${sortDirection}`}
            onChange={(e) => {
              const [col, dir] = e.target.value.split('-') as [SortColumn, SortDirection];
              onSortChange(col, dir);
            }}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
            <option value="year-desc">Year (Newest)</option>
            <option value="year-asc">Year (Oldest)</option>
            <option value="rating-desc">Rating (Highest)</option>
            <option value="rating-asc">Rating (Lowest)</option>
            <option value="monitored-asc">Monitored first</option>
            <option value="monitored-desc">Unmonitored first</option>
            <option value="store-asc">Store (A-Z)</option>
            <option value="store-desc">Store (Z-A)</option>
            <option value="status-asc">Status (Wanted first)</option>
            <option value="status-desc">Status (Downloaded first)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-sm text-gray-400 shrink-0">Status:</label>
          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as StatusFilter })}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="all">All</option>
            <option value="wanted">Wanted</option>
            <option value="downloading">Downloading</option>
            <option value="downloaded">Downloaded</option>
          </select>
        </div>

        {/* Monitored Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-sm text-gray-400 shrink-0">Monitored:</label>
          <select
            value={filters.monitored}
            onChange={(e) => onFiltersChange({ ...filters, monitored: e.target.value as MonitoredFilter })}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="all">All</option>
            <option value="monitored">Monitored</option>
            <option value="unmonitored">Unmonitored</option>
          </select>
        </div>

        {/* Library Filter */}
        {libraries.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-400 shrink-0">Library:</label>
            <select
              value={filters.libraryId}
              onChange={(e) => {
                const value = e.target.value;
                onFiltersChange({
                  ...filters,
                  libraryId: value === 'all' ? 'all' : parseInt(value, 10),
                });
              }}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
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

        {/* Genre Filter */}
        {allGenres.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-400 shrink-0">Genres:</label>
            <div className="relative flex-1 sm:flex-none">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleGenreFilter(e.target.value);
                }}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
              >
                <option value="">
                  {filters.genres.length > 0 ? `${filters.genres.length} selected` : 'Select...'}
                </option>
                {allGenres.map((genre) => (
                  <option key={genre} value={genre}>
                    {filters.genres.includes(genre) ? `[x] ${genre}` : genre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Game Modes Filter */}
        {allGameModes.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-400 shrink-0">Modes:</label>
            <div className="relative flex-1 sm:flex-none">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleGameModeFilter(e.target.value);
                }}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
              >
                <option value="">
                  {filters.gameModes.length > 0 ? `${filters.gameModes.length} selected` : 'Select...'}
                </option>
                {allGameModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {filters.gameModes.includes(mode) ? `[x] ${mode}` : mode}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="w-full sm:w-auto sm:ml-auto text-sm px-3 py-2 sm:py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {(filters.genres.length > 0 || filters.gameModes.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700">
          {filters.genres.map((genre) => (
            <button
              key={genre}
              onClick={() => toggleGenreFilter(genre)}
              className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 transition"
              aria-label={`Remove ${genre} filter`}
            >
              {genre}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
          {filters.gameModes.map((mode) => (
            <button
              key={mode}
              onClick={() => toggleGameModeFilter(mode)}
              className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 transition"
              aria-label={`Remove ${mode} filter`}
            >
              {mode}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Results Count */}
      {activeFilterCount > 0 && (
        <div className="text-sm text-gray-400 mt-3">
          Showing {filteredCount} of {totalCount} games
        </div>
      )}
    </div>
  );
}
