import { useState, useEffect } from 'react';
import { api, GrabbedRelease, Release } from '../../api/client';
import { formatBytes } from '../../utils/formatters';
import { MobileCard, MobileCardButton } from '../MobileCard';

type SortField = 'title' | 'indexer' | 'size' | 'seeders' | 'publishedAt';
type SortDirection = 'asc' | 'desc';

interface GameReleasesSectionProps {
  gameId: number;
  releases: GrabbedRelease[];
  onReleaseGrabbed?: () => void;
}

function GameReleasesSection({ gameId, releases, onReleaseGrabbed }: GameReleasesSectionProps) {
  const [availableReleases, setAvailableReleases] = useState<Release[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [grabbingId, setGrabbingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortField, setSortField] = useState<SortField>('seeders');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Auto-search for releases on mount
  useEffect(() => {
    searchReleases();
  }, [gameId]);

  const searchReleases = async () => {
    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await api.searchReleases(gameId);
      if (response.success && response.data) {
        setAvailableReleases(response.data);
      } else {
        setSearchError(response.error || 'Failed to search for releases');
      }
    } catch (err) {
      setSearchError('Failed to search for releases');
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const handleGrab = async (release: Release) => {
    setGrabbingId(release.guid);
    try {
      const response = await api.grabRelease(gameId, release);
      if (response.success) {
        // Remove from available list
        setAvailableReleases((prev) => prev.filter((r) => r.guid !== release.guid));
        onReleaseGrabbed?.();
      }
    } finally {
      setGrabbingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: GrabbedRelease['status']) => {
    const statusColors = {
      pending: 'bg-yellow-600/30 text-yellow-300',
      downloading: 'bg-blue-600/30 text-blue-300',
      completed: 'bg-green-600/30 text-green-300',
      failed: 'bg-red-600/30 text-red-300',
    };
    return (
      <span className={`${statusColors[status]} px-2 py-0.5 rounded text-xs font-medium`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getStatusInfo = (status: GrabbedRelease['status']) => {
    const statusMap: Record<GrabbedRelease['status'], { label: string; color: 'green' | 'blue' | 'yellow' | 'red' | 'gray' }> = {
      pending: { label: 'Pending', color: 'yellow' },
      downloading: { label: 'Downloading', color: 'blue' },
      completed: { label: 'Completed', color: 'green' },
      failed: { label: 'Failed', color: 'red' },
    };
    return statusMap[status];
  };

  const getSeederColor = (seeders: number) => {
    if (seeders >= 20) return 'text-green-400';
    if (seeders >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedReleases = () => {
    return [...availableReleases].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === 'publishedAt') {
        aValue = new Date(a.publishedAt).getTime();
        bValue = new Date(b.publishedAt).getTime();
      } else {
        aValue = a[sortField] ?? '';
        bValue = b[sortField] ?? '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-600 ml-1">&#x21C5;</span>;
    }
    return sortDirection === 'asc' ? <span className="ml-1">&uarr;</span> : <span className="ml-1">&darr;</span>;
  };

  const sortedReleases = getSortedReleases();

  return (
    <div className="space-y-6">
      {/* Available Releases */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Available Releases</h3>
          <button
            onClick={searchReleases}
            disabled={isSearching}
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 min-h-[44px] md:min-h-0 md:py-1.5 rounded transition disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Refresh'}
          </button>
        </div>

        {searchError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4 text-red-300">
            {searchError}
          </div>
        )}

        {isSearching ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
            <p className="text-gray-400">Searching indexers for releases...</p>
          </div>
        ) : availableReleases.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">
              {hasSearched
                ? 'No releases found from indexers.'
                : 'Loading releases...'}
            </p>
            {hasSearched && (
              <p className="text-gray-500 text-sm mt-2">
                Try checking your Prowlarr configuration or search manually.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="md:hidden space-y-3">
              {sortedReleases.map((release) => (
                <MobileCard
                  key={release.guid}
                  title={release.title}
                  subtitle={release.quality || undefined}
                  fields={[
                    { label: 'Size', value: formatBytes(release.size) },
                    { label: 'Seeders', value: <span className={getSeederColor(release.seeders)}>{release.seeders}</span> },
                    { label: 'Indexer', value: release.indexer },
                    { label: 'Date', value: formatDate(release.publishedAt) },
                  ]}
                  actions={
                    <MobileCardButton
                      onClick={() => handleGrab(release)}
                      variant="primary"
                      disabled={grabbingId === release.guid}
                    >
                      {grabbingId === release.guid ? 'Grabbing...' : 'Grab'}
                    </MobileCardButton>
                  }
                />
              ))}
            </div>

            {/* Desktop view */}
            <div className="hidden md:block bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th
                      onClick={() => handleSort('title')}
                      className="text-left px-4 py-3 text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition select-none"
                    >
                      Title{getSortIcon('title')}
                    </th>
                    <th
                      onClick={() => handleSort('indexer')}
                      className="text-left px-4 py-3 text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition select-none"
                    >
                      Indexer{getSortIcon('indexer')}
                    </th>
                    <th
                      onClick={() => handleSort('size')}
                      className="text-right px-4 py-3 text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition select-none"
                    >
                      Size{getSortIcon('size')}
                    </th>
                    <th
                      onClick={() => handleSort('seeders')}
                      className="text-right px-4 py-3 text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition select-none"
                    >
                      Seeders{getSortIcon('seeders')}
                    </th>
                    <th
                      onClick={() => handleSort('publishedAt')}
                      className="text-right px-4 py-3 text-sm font-medium text-gray-300 cursor-pointer hover:text-white transition select-none"
                    >
                      Date{getSortIcon('publishedAt')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {sortedReleases.map((release) => (
                    <tr key={release.guid} className="hover:bg-gray-700/50 transition">
                      <td className="px-4 py-3">
                        <span className="text-white truncate block max-w-md" title={release.title}>
                          {release.title}
                        </span>
                        {release.quality && (
                          <span className="bg-blue-900 text-blue-200 px-2 py-0.5 rounded text-xs mt-1 inline-block">
                            {release.quality}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{release.indexer}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatBytes(release.size)}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${
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
                      <td className="px-4 py-3 text-right text-gray-400 text-sm">
                        {formatDate(release.publishedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleGrab(release)}
                          disabled={grabbingId === release.guid}
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 min-h-[36px] rounded text-sm transition disabled:opacity-50"
                        >
                          {grabbingId === release.guid ? 'Grabbing...' : 'Grab'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Grabbed Releases */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Grabbed Releases</h3>
        {releases.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No releases have been grabbed for this game yet.</p>
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="md:hidden space-y-3">
              {releases.map((release) => (
                <MobileCard
                  key={release.id}
                  title={release.title}
                  subtitle={release.quality || undefined}
                  status={getStatusInfo(release.status)}
                  fields={[
                    { label: 'Size', value: formatBytes(release.size || 0) },
                    { label: 'Indexer', value: release.indexer },
                    { label: 'Grabbed', value: formatDate(release.grabbedAt) },
                  ]}
                />
              ))}
            </div>

            {/* Desktop view */}
            <div className="hidden md:block bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Title</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Indexer</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Quality</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Size</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-300">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Grabbed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {releases.map((release) => (
                    <tr key={release.id} className="hover:bg-gray-700/50 transition">
                      <td className="px-4 py-3">
                        <span className="text-white truncate block max-w-md" title={release.title}>
                          {release.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{release.indexer}</td>
                      <td className="px-4 py-3">
                        {release.quality ? (
                          <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">{release.quality}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatBytes(release.size || 0)}</td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(release.status)}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-sm">
                        {formatDate(release.grabbedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GameReleasesSection;
