import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, Release, SearchResult } from '../api/client';
import GameSelectionModal from '../components/GameSelectionModal';
import StoreSelector from '../components/StoreSelector';
import LibrarySelector from '../components/LibrarySelector';
import { GamepadIcon } from '../components/Icons';
import { formatBytes, formatDate } from '../utils/formatters';
import { getGameDetailPath } from '../utils/slug';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

type SearchMode = 'games' | 'releases';
type SortField = 'title' | 'indexer' | 'size' | 'seeders' | 'publishedAt' | 'category';
type SortDirection = 'asc' | 'desc';

// Common Prowlarr category mappings
const CATEGORY_NAMES: Record<number, string> = {
  4000: 'PC',
  4010: 'PC/0day',
  4020: 'PC/ISO',
  4030: 'PC/Mac',
  4040: 'PC/iOS',
  4050: 'PC/Android',
  4060: 'PC/Games',
  1000: 'Console',
  1010: 'Console/NDS',
  1020: 'Console/PSP',
  1030: 'Console/Wii',
  1040: 'Console/Xbox',
  1050: 'Console/Xbox 360',
  1060: 'Console/Wiiware',
  1070: 'Console/Xbox One',
  1080: 'Console/PS3',
  1090: 'Console/PS4',
  1100: 'Console/PSVita',
  1110: 'Console/Switch',
  1120: 'Console/PS5',
  1130: 'Console/Xbox X',
};

function getCategoryName(categories?: number[]): string {
  if (!categories || categories.length === 0) return '-';
  // Return the first recognized category name, or the category ID
  for (const cat of categories) {
    if (CATEGORY_NAMES[cat]) {
      return CATEGORY_NAMES[cat];
    }
  }
  // If no recognized category, return the first one as a number
  return `Cat: ${categories[0]}`;
}

function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial mode from URL params, default to 'games'
  const initialMode = (searchParams.get('tab') as SearchMode) || 'games';
  const [searchMode, setSearchMode] = useState<SearchMode>(
    initialMode === 'releases' ? 'releases' : 'games'
  );

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Sync mode with URL params (for back/forward navigation)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as SearchMode;
    if (tabParam === 'releases' && searchMode !== 'releases') {
      setSearchMode('releases');
      setHasSearched(false);
      setGameResults([]);
      setReleases([]);
    } else if (tabParam !== 'releases' && searchMode === 'releases') {
      setSearchMode('games');
      setHasSearched(false);
      setGameResults([]);
      setReleases([]);
    }
  }, [searchParams]);

  // Games search state
  const [gameResults, setGameResults] = useState<SearchResult[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<number, string>>({});

  // Releases search state
  const [releases, setReleases] = useState<Release[]>([]);
  const [sortField, setSortField] = useState<SortField>('seeders');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      if (searchMode === 'games') {
        const response = await api.searchGames(query);
        if (response.success && response.data) {
          setGameResults(response.data);
        } else {
          setError(response.error || 'Failed to search for games');
          setGameResults([]);
        }
      } else {
        const response = await api.manualSearchReleases(query);
        if (response.success && response.data) {
          setReleases(response.data);
        } else {
          setError(response.error || 'Failed to search for releases');
          setReleases([]);
        }
      }
    } catch (err) {
      setError(`Failed to search for ${searchMode}`);
      if (searchMode === 'games') {
        setGameResults([]);
      } else {
        setReleases([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearchParams({ tab: mode });
    setHasSearched(false);
    setGameResults([]);
    setReleases([]);
    setError(null);
    setSuccessMessage(null);
  };

  // Games mode handlers
  const handleAddGame = async (game: SearchResult, shouldSearchReleases: boolean = false) => {
    setAddingGameId(game.igdbId);
    setError(null);

    // Use selected platform, or default to first platform if available
    const platform = selectedPlatforms[game.igdbId] || game.platforms?.[0];

    try {
      const response = await api.addGame({
        igdbId: game.igdbId,
        monitored: true,
        store: selectedStore,
        libraryId: selectedLibraryId ?? undefined,
        platform,
      });

      if (response.success && response.data) {
        setSuccessMessage(`Added "${game.title}" to your library`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);

        if (shouldSearchReleases) {
          // Navigate to the game detail page
          navigate(getGameDetailPath(response.data.platform, response.data.title));
        }
      } else {
        setError(response.error || 'Failed to add game');
      }
    } catch (err) {
      setError('Failed to add game');
    } finally {
      setAddingGameId(null);
    }
  };

  // Releases mode handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedReleases = () => {
    const sorted = [...releases].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'category') {
        // Sort by first category number
        aValue = a.categories?.[0] ?? 99999;
        bValue = b.categories?.[0] ?? 99999;
      } else if (sortField === 'publishedAt') {
        aValue = new Date(a[sortField]).getTime();
        bValue = new Date(b[sortField]).getTime();
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-600">&#x21C5;</span>;
    }
    return sortDirection === 'asc' ? <span>&uarr;</span> : <span>&darr;</span>;
  };

  const handleGrabRelease = (release: Release) => {
    setSelectedRelease(release);
    setIsGameModalOpen(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleGameSelected = async (gameId: number) => {
    if (!selectedRelease) return;

    try {
      const response = await api.grabRelease(gameId, selectedRelease);

      if (response.success) {
        setSuccessMessage(`Successfully grabbed "${selectedRelease.title}"`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(response.error || 'Failed to grab release');
      }
    } catch (err) {
      setError('Failed to grab release');
    } finally {
      setSelectedRelease(null);
    }
  };

  const sortedReleases = getSortedReleases();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Search</h2>
        <p className="text-gray-400">
          {searchMode === 'games'
            ? 'Search for games on IGDB to add to your library'
            : 'Search for game releases across all configured indexers'}
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="border-b border-gray-700 mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => handleModeChange('games')}
            className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
              searchMode === 'games'
                ? 'text-blue-400 border-blue-500'
                : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
            }`}
          >
            Games
          </button>
          <button
            onClick={() => handleModeChange('releases')}
            className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
              searchMode === 'releases'
                ? 'text-blue-400 border-blue-500'
                : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
            }`}
          >
            Releases
          </button>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchMode === 'games'
                  ? 'Search for games on IGDB...'
                  : 'Search for releases, keywords...'
              }
              className="w-full pl-10 pr-4 py-3 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Games mode options */}
        {searchMode === 'games' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <StoreSelector
                value={selectedStore}
                onChange={setSelectedStore}
                label="Digital Store (Optional)"
              />
              <p className="text-xs text-gray-400 mt-1">
                If you select a store, the game will be marked as already owned.
              </p>
            </div>
            <LibrarySelector
              value={selectedLibraryId}
              onChange={setSelectedLibraryId}
              label="Library (Optional)"
              optional={true}
            />
          </div>
        )}
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded text-green-200">
          {successMessage}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400 text-lg">
            {searchMode === 'games' ? 'Searching IGDB...' : 'Searching indexers...'}
          </p>
        </div>
      ) : searchMode === 'games' ? (
        // Games Results
        hasSearched ? (
          gameResults.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-300 mb-2">No games found</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                We couldn't find any games matching "{query}" on IGDB. Try different search terms.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="text-xl font-semibold">
                  {gameResults.length} game{gameResults.length !== 1 ? 's' : ''} found
                </h3>
              </div>

              <div className="space-y-3">
                {gameResults.map((game) => (
                  <div
                    key={game.igdbId}
                    className="bg-gray-800 hover:bg-gray-750 flex gap-4 rounded-lg p-4 transition border border-gray-700"
                  >
                    {/* Cover */}
                    <div className="bg-gray-700 w-20 h-28 rounded flex-shrink-0">
                      {game.coverUrl ? (
                        <img
                          src={game.coverUrl}
                          alt={`Cover art for ${game.title}`}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          <GamepadIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-white">
                        {game.title}
                        {game.year && (
                          <span className="text-gray-400 ml-2">({game.year})</span>
                        )}
                      </h3>
                      {game.platforms && game.platforms.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          {game.platforms.length === 1 ? (
                            <span className="text-sm text-gray-400">{game.platforms[0]}</span>
                          ) : (
                            <>
                              <label className="text-sm text-gray-400">Platform:</label>
                              <select
                                value={selectedPlatforms[game.igdbId] || game.platforms[0]}
                                onChange={(e) => setSelectedPlatforms(prev => ({
                                  ...prev,
                                  [game.igdbId]: e.target.value
                                }))}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                              >
                                {game.platforms.map((platform) => (
                                  <option key={platform} value={platform}>
                                    {platform}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      )}
                      {game.developer && (
                        <p className="text-sm text-gray-500 mt-1">
                          {game.developer}
                          {game.publisher && game.publisher !== game.developer && ` / ${game.publisher}`}
                        </p>
                      )}
                      {game.summary && (
                        <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                          {game.summary}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex flex-col gap-2">
                      <button
                        onClick={() => handleAddGame(game, false)}
                        disabled={addingGameId === game.igdbId}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
                      >
                        {addingGameId === game.igdbId ? 'Adding...' : 'Add to Library'}
                      </button>
                      <button
                        onClick={() => handleAddGame(game, true)}
                        disabled={addingGameId === game.igdbId}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
                      >
                        {addingGameId === game.igdbId ? 'Adding...' : 'Add & Search'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
              <GamepadIcon className="w-full h-full" />
            </div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">Search for games</h3>
            <p className="text-gray-500 mb-6">
              Enter a game title above to search IGDB and add it to your library
            </p>
          </div>
        )
      ) : (
        // Releases Results
        hasSearched ? (
          releases.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-300 mb-2">No releases found</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                We couldn't find any releases for "{query}". Try different search terms, check
                your Prowlarr configuration, or the game may not be available on your indexers.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">
                  {releases.length} release{releases.length !== 1 ? 's' : ''} found
                </h3>
                <div className="text-sm text-gray-400">Click column headers to sort</div>
              </div>

              {/* Table */}
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-900">
                      <tr>
                        <th
                          onClick={() => handleSort('title')}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                        >
                          <div className="flex items-center gap-2">
                            Title {getSortIcon('title')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('indexer')}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                        >
                          <div className="flex items-center gap-2">
                            Indexer {getSortIcon('indexer')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('category')}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                        >
                          <div className="flex items-center gap-2">
                            Category {getSortIcon('category')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('size')}
                          className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                        >
                          <div className="flex items-center justify-end gap-2">
                            Size {getSortIcon('size')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('seeders')}
                          className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                        >
                          <div className="flex items-center justify-end gap-2">
                            Seeders {getSortIcon('seeders')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('publishedAt')}
                          className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                        >
                          <div className="flex items-center justify-end gap-2">
                            Date {getSortIcon('publishedAt')}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {sortedReleases.map((release) => (
                        <tr key={release.guid} className="hover:bg-gray-750 transition">
                          <td className="px-4 py-3">
                            <div
                              className="text-sm font-medium text-white truncate max-w-md"
                              title={release.title}
                            >
                              {release.title}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-400">{release.indexer}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold bg-blue-900 text-blue-200 rounded">
                              {getCategoryName(release.categories)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-gray-300">
                              {formatBytes(release.size)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`text-sm font-medium ${
                                release.seeders >= 20
                                  ? 'text-green-400'
                                  : release.seeders >= 5
                                  ? 'text-yellow-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {release.seeders}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-gray-400">
                              {formatDate(release.publishedAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleGrabRelease(release)}
                              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded transition text-sm text-white"
                            >
                              Grab
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                className="w-full h-full"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">Ready to search</h3>
            <p className="text-gray-500 mb-6">
              Enter a game title or keywords above to search across all your configured indexers
            </p>
          </div>
        )
      )}

      {/* Game Selection Modal (for releases) */}
      <GameSelectionModal
        isOpen={isGameModalOpen}
        onClose={() => {
          setIsGameModalOpen(false);
          setSelectedRelease(null);
        }}
        onSelect={handleGameSelected}
        releaseName={selectedRelease?.title || ''}
      />
    </div>
  );
}

export default Search;
