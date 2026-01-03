import { useState } from 'react';
import { api } from '../api/client';
import GameSelectionModal from '../components/GameSelectionModal';

interface Release {
  guid: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  downloadUrl: string;
  publishedAt: string;
  quality?: string;
}

type SortField = 'title' | 'indexer' | 'size' | 'seeders' | 'publishedAt' | 'quality';
type SortDirection = 'asc' | 'desc';

function Search() {
  const [query, setQuery] = useState('');
  const [releases, setReleases] = useState<Release[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortField, setSortField] = useState<SortField>('seeders');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const response = await api.manualSearchReleases(query);

      if (response.success && response.data) {
        setReleases(response.data as any);
      } else {
        setError(response.error || 'Failed to search for releases');
      }
    } catch (err) {
      setError('Failed to search for releases');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for new field
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedReleases = () => {
    const sorted = [...releases].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date comparison
      if (sortField === 'publishedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Compare values
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-600">⇅</span>;
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
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
        setTimeout(() => setSuccessMessage(null), 5000);
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
        <h2 className="text-3xl font-bold mb-2">Manual Search</h2>
        <p className="text-gray-400">
          Search for game releases across all configured indexers
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for games, releases, or keywords..."
            className="flex-1 px-4 py-3 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
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
          <p className="text-gray-400 text-lg">Searching indexers...</p>
        </div>
      ) : hasSearched ? (
        releases.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 text-lg mb-2">No releases found</p>
            <p className="text-gray-500 text-sm">
              Try adjusting your search terms or check your Prowlarr configuration
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {releases.length} release{releases.length !== 1 ? 's' : ''} found
              </h3>
              <div className="text-sm text-gray-400">
                Click column headers to sort
              </div>
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
                        onClick={() => handleSort('quality')}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                      >
                        <div className="flex items-center gap-2">
                          Quality {getSortIcon('quality')}
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
                      <tr
                        key={release.guid}
                        className="hover:bg-gray-750 transition"
                      >
                        <td className="px-4 py-3">
                          <div
                            className="text-sm font-medium text-white truncate max-w-md"
                            title={release.title}
                          >
                            {release.title}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-400">
                            {release.indexer}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {release.quality ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold bg-blue-900 text-blue-200 rounded">
                              {release.quality}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">-</span>
                          )}
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
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-400 text-lg mb-2">Ready to search</p>
          <p className="text-gray-500 text-sm">
            Enter a game title or keywords above to search across all indexers
          </p>
        </div>
      )}

      {/* Game Selection Modal */}
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
