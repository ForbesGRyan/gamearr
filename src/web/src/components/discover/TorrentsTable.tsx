import { TorrentRelease } from './types';
import { formatRelativeDate, formatBytes } from '../../utils/formatters';

interface TorrentsTableProps {
  torrents: TorrentRelease[];
  maxAge: number;
  isLoading: boolean;
  onSelectTorrent: (torrent: TorrentRelease) => void;
}

function getMaxAgeLabel(maxAge: number): string {
  switch (maxAge) {
    case 7:
      return 'last week';
    case 30:
      return 'last month';
    case 90:
      return 'last 3 months';
    case 365:
      return 'last year';
    default:
      return 'all time';
  }
}

export default function TorrentsTable({
  torrents,
  maxAge,
  isLoading,
  onSelectTorrent,
}: TorrentsTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Results count */}
      <div className="mb-4 text-gray-400">
        Showing {torrents.length} torrents from the {getMaxAgeLabel(maxAge)} sorted by seeders
      </div>

      {/* Torrents table */}
      {torrents.length > 0 ? (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Title</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300 w-24">Size</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-300 w-20">
                  <span className="flex items-center justify-center gap-1">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    S
                  </span>
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-300 w-20">
                  <span className="flex items-center justify-center gap-1">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    L
                  </span>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300 w-32">Indexer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300 w-28">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {torrents.map((torrent, index) => (
                <tr key={index} className="hover:bg-gray-700/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <button
                        onClick={() => onSelectTorrent(torrent)}
                        className="text-sm text-white truncate max-w-xl text-left hover:text-blue-400 transition"
                        title={torrent.title}
                      >
                        {torrent.title}
                      </button>
                      {torrent.quality && (
                        <span className="text-xs text-blue-400 mt-0.5">{torrent.quality}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{formatBytes(torrent.size)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-medium ${torrent.seeders >= 10 ? 'text-green-400' : torrent.seeders >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {torrent.seeders}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-400">{torrent.leechers}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{torrent.indexer}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatRelativeDate(torrent.publishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">No torrents found</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Try searching for a specific game or make sure Prowlarr is configured and connected.
          </p>
        </div>
      )}
    </>
  );
}
