import { MagnifyingGlassIcon } from '../Icons';
import type { Filters, SortColumn, SortDirection, StatusFilter, MonitoredFilter } from './types';

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
    });
  };

  return (
    <div className="mb-6 bg-gray-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              &times;
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Sort:</label>
          <select
            value={`${sortColumn}-${sortDirection}`}
            onChange={(e) => {
              const [col, dir] = e.target.value.split('-') as [SortColumn, SortDirection];
              onSortChange(col, dir);
            }}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Status:</label>
          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as StatusFilter })}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="wanted">Wanted</option>
            <option value="downloading">Downloading</option>
            <option value="downloaded">Downloaded</option>
          </select>
        </div>

        {/* Monitored Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Monitored:</label>
          <select
            value={filters.monitored}
            onChange={(e) => onFiltersChange({ ...filters, monitored: e.target.value as MonitoredFilter })}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="monitored">Monitored</option>
            <option value="unmonitored">Unmonitored</option>
          </select>
        </div>

        {/* Genre Filter */}
        {allGenres.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Genres:</label>
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleGenreFilter(e.target.value);
                }}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Modes:</label>
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleGameModeFilter(e.target.value);
                }}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="ml-auto text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center gap-1"
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
              className="text-xs bg-blue-600 hover:bg-blue-500 px-2.5 py-1 rounded-full flex items-center gap-1 transition"
            >
              {genre}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
          {filters.gameModes.map((mode) => (
            <button
              key={mode}
              onClick={() => toggleGameModeFilter(mode)}
              className="text-xs bg-purple-600 hover:bg-purple-500 px-2.5 py-1 rounded-full flex items-center gap-1 transition"
            >
              {mode}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
