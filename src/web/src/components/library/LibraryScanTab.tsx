import { useState, useMemo } from 'react';
import { GamepadIcon, MagnifyingGlassIcon } from '../Icons';
import StoreSelector from '../StoreSelector';
import { LibraryPagination } from './LibraryPagination';
import type { LibraryFolder, AutoMatchSuggestion } from './types';
import type { Library } from '../../api/client';

type SortField = 'name' | 'year' | 'path' | 'library';
type SortDirection = 'asc' | 'desc';
type SuggestionFilter = 'all' | 'suggested' | 'not_suggested';

interface LibraryScanTabProps {
  isScanLoaded: boolean;
  isScanning: boolean;
  libraryFolders: LibraryFolder[];
  autoMatchSuggestions: Record<string, AutoMatchSuggestion>;
  isAutoMatching: Record<string, boolean>;
  selectedStore: Record<string, string | undefined>;
  libraries: Library[];
  selectedLibrary: Record<string, number | undefined>;
  isBackgroundAutoMatching: boolean;
  backgroundAutoMatchProgress: { current: number; total: number };
  onScanLibrary: () => void;
  onAutoMatch: (folder: LibraryFolder) => void;
  onManualMatch: (folder: LibraryFolder) => void;
  onIgnoreFolder: (folderPath: string) => void;
  onConfirmAutoMatch: (folder: LibraryFolder) => void;
  onEditAutoMatch: (folder: LibraryFolder) => void;
  onCancelAutoMatch: (folder: LibraryFolder) => void;
  onCancelBackgroundAutoMatch: () => void;
  onStoreChange: (folderPath: string, store: string | undefined) => void;
  onLibraryChange: (folderPath: string, libraryId: number | undefined) => void;
  onOpenSteamImport: () => void;
}

export function LibraryScanTab({
  isScanLoaded,
  isScanning,
  libraryFolders,
  autoMatchSuggestions,
  isAutoMatching,
  selectedStore,
  libraries,
  selectedLibrary,
  isBackgroundAutoMatching,
  backgroundAutoMatchProgress,
  onScanLibrary,
  onAutoMatch,
  onManualMatch,
  onIgnoreFolder,
  onConfirmAutoMatch,
  onEditAutoMatch,
  onCancelAutoMatch,
  onCancelBackgroundAutoMatch,
  onStoreChange,
  onLibraryChange,
  onOpenSteamImport,
}: LibraryScanTabProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('library-scan-page-size');
    return saved ? parseInt(saved, 10) : 25;
  });

  // Search, sort, and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [suggestionFilter, setSuggestionFilter] = useState<SuggestionFilter>('all');
  const [hasYearFilter, setHasYearFilter] = useState<boolean | null>(null);
  const [hasVersionFilter, setHasVersionFilter] = useState<boolean | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<string>('all');

  // Get unique library names for filter dropdown
  const uniqueLibraryNames = useMemo(() => {
    const names = new Set<string>();
    libraryFolders.forEach(folder => {
      if (folder.libraryName) {
        names.add(folder.libraryName);
      }
    });
    return Array.from(names).sort();
  }, [libraryFolders]);

  // Filter and sort folders
  const filteredAndSortedFolders = useMemo(() => {
    let result = [...libraryFolders];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(folder =>
        folder.cleanedTitle.toLowerCase().includes(query) ||
        folder.folderName.toLowerCase().includes(query) ||
        folder.path.toLowerCase().includes(query)
      );
    }

    // Apply suggestion filter
    if (suggestionFilter !== 'all') {
      result = result.filter(folder => {
        const hasSuggestion = !!autoMatchSuggestions[folder.path];
        return suggestionFilter === 'suggested' ? hasSuggestion : !hasSuggestion;
      });
    }

    // Apply year filter
    if (hasYearFilter !== null) {
      result = result.filter(folder =>
        hasYearFilter ? !!folder.parsedYear : !folder.parsedYear
      );
    }

    // Apply version filter
    if (hasVersionFilter !== null) {
      result = result.filter(folder =>
        hasVersionFilter ? !!folder.parsedVersion : !folder.parsedVersion
      );
    }

    // Apply library filter
    if (libraryFilter !== 'all') {
      result = result.filter(folder => folder.libraryName === libraryFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.cleanedTitle.localeCompare(b.cleanedTitle);
          break;
        case 'year':
          const yearA = a.parsedYear || 0;
          const yearB = b.parsedYear || 0;
          comparison = yearA - yearB;
          break;
        case 'path':
          comparison = a.path.localeCompare(b.path);
          break;
        case 'library':
          const libA = a.libraryName || '';
          const libB = b.libraryName || '';
          comparison = libA.localeCompare(libB);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [libraryFolders, searchQuery, sortField, sortDirection, suggestionFilter, hasYearFilter, hasVersionFilter, libraryFilter, autoMatchSuggestions]);

  // Calculate paginated folders from filtered results
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAndSortedFolders.length / pageSize));
  }, [filteredAndSortedFolders.length, pageSize]);

  const paginatedFolders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedFolders.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedFolders, currentPage, pageSize]);

  // Reset to page 1 when filters change or folders change significantly
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    localStorage.setItem('library-scan-page-size', newSize.toString());
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSuggestionFilter('all');
    setHasYearFilter(null);
    setHasVersionFilter(null);
    setLibraryFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || suggestionFilter !== 'all' || hasYearFilter !== null || hasVersionFilter !== null || libraryFilter !== 'all';

  return (
    <>
      {/* Import Sources */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Import from Steam</h3>
            <p className="text-sm text-gray-400">Import games from your Steam library</p>
          </div>
          <button
            onClick={onOpenSteamImport}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.07.16-1.5.44l-5.23-2.16C2.31 6.67 6.63 2 12 2m6.19 8.25c0-1.31-1.07-2.38-2.38-2.38s-2.38 1.07-2.38 2.38 1.07 2.38 2.38 2.38 2.38-1.07 2.38-2.38m-12.7 5.85c0 1.1.9 1.99 1.99 1.99.89 0 1.64-.58 1.9-1.38l-1.73-.71c-.41.13-.86.06-1.21-.21a1.35 1.35 0 0 1-.25-1.9l-1.33-.55c-.49.47-.77 1.11-.77 1.8l.4-.04z"/>
            </svg>
            Import from Steam
          </button>
        </div>
      </div>

      {!isScanLoaded ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-lg mb-4">
            Scan your library to find and import unmatched game folders.
          </p>
          <button
            onClick={onScanLibrary}
            disabled={isScanning}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded transition disabled:opacity-50"
          >
            {isScanning ? 'Scanning...' : 'Scan Library Now'}
          </button>
        </div>
      ) : libraryFolders.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-green-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">All folders imported</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Every folder in your library has been matched to a game or ignored. Add new games to your library folder and scan again to import them.
          </p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">
              Folders to Import ({filteredAndSortedFolders.length}{filteredAndSortedFolders.length !== libraryFolders.length ? ` of ${libraryFolders.length}` : ''})
            </h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-400 hover:text-blue-300 transition"
              >
                Clear filters
              </button>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-4">
            These folders aren't linked to any games yet. Review the auto-matched suggestions below,
            or use Manual Match to search for a specific game.
          </p>

          {/* Background Auto-Match Progress */}
          {isBackgroundAutoMatching && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-blue-300">
                    Auto-matching folders... ({backgroundAutoMatchProgress.current} of {backgroundAutoMatchProgress.total})
                  </span>
                </div>
                <button
                  onClick={onCancelBackgroundAutoMatch}
                  className="text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${backgroundAutoMatchProgress.total > 0
                      ? (backgroundAutoMatchProgress.current / backgroundAutoMatchProgress.total) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Search, Sort, and Filter Controls */}
          <div className="bg-gray-700 rounded-lg p-4 mb-4 space-y-3">
            {/* Search and Sort Row */}
            <div className="flex flex-wrap gap-3">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-gray-600 border border-gray-500 rounded pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Sort:</label>
                <select
                  value={sortField}
                  onChange={(e) => handleSortChange(e.target.value as SortField)}
                  className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="name">Name</option>
                  <option value="year">Year</option>
                  <option value="path">Path</option>
                  <option value="library">Library</option>
                </select>
                <button
                  onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white hover:bg-gray-500 transition"
                  title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm text-gray-400">Filter:</span>

              {/* Suggestion Status Filter */}
              <select
                value={suggestionFilter}
                onChange={(e) => {
                  setSuggestionFilter(e.target.value as SuggestionFilter);
                  setCurrentPage(1);
                }}
                className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Match Status</option>
                <option value="suggested">Ready to Confirm</option>
                <option value="not_suggested">Needs Review</option>
              </select>

              {/* Year Filter */}
              <select
                value={hasYearFilter === null ? 'all' : hasYearFilter ? 'yes' : 'no'}
                onChange={(e) => {
                  const val = e.target.value;
                  setHasYearFilter(val === 'all' ? null : val === 'yes');
                  setCurrentPage(1);
                }}
                className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Years</option>
                <option value="yes">Has Year</option>
                <option value="no">No Year</option>
              </select>

              {/* Version Filter */}
              <select
                value={hasVersionFilter === null ? 'all' : hasVersionFilter ? 'yes' : 'no'}
                onChange={(e) => {
                  const val = e.target.value;
                  setHasVersionFilter(val === 'all' ? null : val === 'yes');
                  setCurrentPage(1);
                }}
                className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Versions</option>
                <option value="yes">Has Version</option>
                <option value="no">No Version</option>
              </select>

              {/* Library Filter - only show if there are multiple libraries */}
              {uniqueLibraryNames.length > 1 && (
                <select
                  value={libraryFilter}
                  onChange={(e) => {
                    setLibraryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All Libraries</option>
                  {uniqueLibraryNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* No Results Message */}
          {filteredAndSortedFolders.length === 0 && hasActiveFilters && (
            <div className="text-center py-8 text-gray-400">
              <p>No folders match your search or filters.</p>
              <button
                onClick={clearFilters}
                className="mt-2 text-blue-400 hover:text-blue-300 transition"
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="space-y-3">
            {paginatedFolders.map((folder) => {
              const suggestion = autoMatchSuggestions[folder.path];
              const isMatching = isAutoMatching[folder.path];

              return (
                <div key={folder.path} className="bg-gray-700 rounded p-4">
                  {/* Folder Info */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span>
                          {folder.cleanedTitle}
                          {folder.parsedYear && ` (${folder.parsedYear})`}
                        </span>
                        {folder.parsedVersion && (
                          <span className="px-2 py-0.5 text-xs bg-blue-600 rounded">
                            v{folder.parsedVersion}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 truncate" title={folder.path}>
                        {folder.path}
                      </div>
                    </div>
                    {!suggestion && (
                      <div className="flex gap-2">
                        <button
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => onAutoMatch(folder)}
                          disabled={isMatching}
                        >
                          {isMatching ? 'Searching...' : 'Auto Match'}
                        </button>
                        <button
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm"
                          onClick={() => onManualMatch(folder)}
                        >
                          Manual Match
                        </button>
                        <button
                          className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition text-sm"
                          onClick={() => onIgnoreFolder(folder.path)}
                        >
                          Ignore
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Auto-Match Suggestion Card */}
                  {suggestion && (
                    <div className="mt-4 p-4 bg-gray-800 rounded border border-green-600">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-20 h-28 rounded flex-shrink-0 bg-gray-700">
                          {suggestion.coverUrl ? (
                            <img
                              src={suggestion.coverUrl}
                              alt={suggestion.title}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <GamepadIcon className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-green-400 text-sm font-medium mb-1">
                            Suggested Match
                          </div>
                          <h4 className="font-semibold text-lg">
                            {suggestion.title}
                            {suggestion.year && (
                              <span className="text-gray-400 ml-2">({suggestion.year})</span>
                            )}
                          </h4>
                          {suggestion.platforms && (
                            <p className="text-sm text-gray-400 mt-1">
                              {suggestion.platforms.slice(0, 3).join(', ')}
                            </p>
                          )}
                          {suggestion.summary && (
                            <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                              {suggestion.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mb-4 flex gap-4">
                        <div className="flex-1">
                          <StoreSelector
                            value={selectedStore[folder.path] || null}
                            onChange={(store) => onStoreChange(folder.path, store || undefined)}
                            label="Digital Store (Optional)"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Select a store if you own this game digitally.
                          </p>
                        </div>
                        {libraries.length > 0 && (
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Add to Library
                            </label>
                            <select
                              value={selectedLibrary[folder.path] || ''}
                              onChange={(e) => onLibraryChange(folder.path, e.target.value ? Number(e.target.value) : undefined)}
                              className="w-full bg-gray-600 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                            >
                              <option value="">No Library (General)</option>
                              {libraries.map((lib) => (
                                <option key={lib.id} value={lib.id}>
                                  {lib.name} {lib.platform ? `(${lib.platform})` : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                              Organize this game into a library.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm flex-1"
                          onClick={() => onConfirmAutoMatch(folder)}
                        >
                          Confirm Match
                        </button>
                        <button
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm"
                          onClick={() => onEditAutoMatch(folder)}
                        >
                          Edit Match
                        </button>
                        <button
                          className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition text-sm"
                          onClick={() => onCancelAutoMatch(folder)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <LibraryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredAndSortedFolders.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            itemLabel="folders"
          />
        </div>
      )}
    </>
  );
}
