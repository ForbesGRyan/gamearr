import StoreIcon from './StoreIcon';

interface Game {
  id: number;
  title: string;
  year?: number;
  coverUrl?: string;
  monitored: boolean;
  status: 'wanted' | 'downloading' | 'downloaded';
  platform: string;
  store?: string | null;
  updateAvailable?: boolean;
}

interface GameCardProps {
  game: Game;
  onToggleMonitor: (id: number) => void;
  onDelete: (id: number) => void;
  onSearch?: (game: Game) => void;
  onEdit?: (game: Game) => void;
}

function GameCard({ game, onToggleMonitor, onDelete, onSearch, onEdit }: GameCardProps) {
  const statusColors = {
    wanted: 'bg-yellow-600',
    downloading: 'bg-blue-600',
    downloaded: 'bg-green-600',
  };

  const statusLabels = {
    wanted: 'Wanted',
    downloading: 'Downloading',
    downloaded: 'Downloaded',
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition group">
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-gray-700">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl">
            🎮
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`${statusColors[game.status]} px-2 py-1 rounded text-xs font-semibold`}
          >
            {statusLabels[game.status]}
          </span>
        </div>

        {/* Update Available Badge */}
        {game.updateAvailable && (
          <div className="absolute top-2 left-2">
            <span className="bg-orange-500 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Update
            </span>
          </div>
        )}

        {/* Monitored Badge */}
        {!game.monitored && !game.updateAvailable && (
          <div className="absolute top-2 left-2">
            <span className="bg-gray-900 px-2 py-1 rounded text-xs font-semibold">
              Unmonitored
            </span>
          </div>
        )}

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => onToggleMonitor(game.id)}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded transition text-sm"
                title={game.monitored ? 'Unmonitor' : 'Monitor'}
              >
                {game.monitored ? '👁️' : '👁️‍🗨️'}
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(game)}
                  className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded transition text-sm"
                  title="Edit"
                >
                  ✏️
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Delete "${game.title}"?`)) {
                    onDelete(game.id);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded transition text-sm"
                title="Delete"
              >
                🗑️
              </button>
            </div>
            {onSearch && (
              <button
                onClick={() => onSearch(game)}
                className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded transition text-sm w-full"
                title="Search for releases"
              >
                🔍 Search
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Game Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate" title={game.title}>
          {game.title}
        </h3>
        <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
          <span>{game.year || 'Unknown'}</span>
          <span>{game.platform}</span>
        </div>
        {game.store && (
          <div className="mt-2">
            <StoreIcon store={game.store} />
          </div>
        )}
      </div>
    </div>
  );
}

export default GameCard;
