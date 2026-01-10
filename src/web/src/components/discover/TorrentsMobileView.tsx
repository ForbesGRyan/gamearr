import { TorrentRelease } from './types';
import { MobileCard, MobileCardButton } from '../MobileCard';
import { formatRelativeDate, formatBytes } from '../../utils/formatters';

interface TorrentsMobileViewProps {
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

function getSeederStatus(seeders: number): { label: string; color: 'green' | 'yellow' | 'red' } {
  if (seeders >= 10) {
    return { label: 'Good', color: 'green' };
  } else if (seeders >= 1) {
    return { label: 'Low', color: 'yellow' };
  }
  return { label: 'Dead', color: 'red' };
}

export default function TorrentsMobileView({
  torrents,
  maxAge,
  isLoading,
  onSelectTorrent,
}: TorrentsMobileViewProps) {
  if (isLoading) {
    return (
      <div className="md:hidden flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (torrents.length === 0) {
    return (
      <div className="md:hidden bg-gray-800 rounded-lg p-12 text-center">
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
    );
  }

  return (
    <div className="md:hidden">
      {/* Results count */}
      <div className="mb-4 text-gray-400 text-sm">
        Showing {torrents.length} torrents from the {getMaxAgeLabel(maxAge)} sorted by seeders
      </div>

      {/* Torrent cards */}
      <div className="space-y-3">
        {torrents.map((torrent, index) => {
          const seederStatus = getSeederStatus(torrent.seeders);
          return (
            <MobileCard
              key={index}
              title={torrent.title}
              subtitle={torrent.quality}
              status={seederStatus}
              fields={[
                { label: 'Size', value: formatBytes(torrent.size) },
                { label: 'Age', value: formatRelativeDate(torrent.publishedAt) },
                {
                  label: 'Seeders',
                  value: (
                    <span className={torrent.seeders >= 10 ? 'text-green-400' : torrent.seeders >= 1 ? 'text-yellow-400' : 'text-red-400'}>
                      {torrent.seeders}
                    </span>
                  ),
                },
                {
                  label: 'Leechers',
                  value: <span className="text-gray-400">{torrent.leechers}</span>,
                },
                { label: 'Indexer', value: torrent.indexer },
              ]}
              actions={
                <MobileCardButton onClick={() => onSelectTorrent(torrent)} variant="primary">
                  Download
                </MobileCardButton>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
