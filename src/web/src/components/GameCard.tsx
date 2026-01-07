import { useState } from 'react';
import StoreIcon from './StoreIcon';
import ConfirmModal from './ConfirmModal';

// SVG Icon Components
const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeSlashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const MagnifyingGlassIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusColors = {
    wanted: 'bg-orange-500',
    downloading: 'bg-blue-600',
    downloaded: 'bg-green-600',
  };

  // Pulsing indicator for downloading games
  const downloadingClass = game.status === 'downloading'
    ? 'ring-2 ring-blue-500 ring-opacity-50 animate-pulse'
    : '';

  const statusLabels = {
    wanted: 'Wanted',
    downloading: 'Downloading',
    downloaded: 'Downloaded',
  };

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition group ${downloadingClass}`}>
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
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
                {game.monitored ? <EyeIcon /> : <EyeSlashIcon />}
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(game)}
                  className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded transition text-sm"
                  title="Edit"
                >
                  <PencilIcon />
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded transition text-sm"
                title="Delete"
              >
                <TrashIcon />
              </button>
            </div>
            {onSearch && (
              <button
                onClick={() => onSearch(game)}
                className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded transition text-sm w-full flex items-center justify-center gap-1"
                title="Search for releases"
              >
                <MagnifyingGlassIcon /> Search
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

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Game"
        message={`Are you sure you want to delete "${game.title}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          onDelete(game.id);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export default GameCard;
