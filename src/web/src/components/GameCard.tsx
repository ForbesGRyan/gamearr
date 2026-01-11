import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import StoreIcon from './StoreIcon';
import ConfirmModal from './ConfirmModal';
import { EyeIcon, EyeSlashIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, GamepadIcon, RefreshIcon } from './Icons';
import { getGameDetailPath } from '../utils/slug';

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
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  priority?: boolean; // True for first few cards to load eagerly
}

function GameCard({ game, onToggleMonitor, onDelete, onSearch, selected, onToggleSelect, priority = false }: GameCardProps) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleNavigateToDetail = () => {
    navigate(getGameDetailPath(game.platform, game.title));
  };

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

  const selectedClass = selected ? 'ring-2 ring-blue-500' : '';

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition group ${downloadingClass} ${selectedClass}`}>
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-gray-700">
        <button
          onClick={handleNavigateToDetail}
          className="w-full h-full cursor-pointer"
          aria-label={`View ${game.title}`}
        >
          {game.coverUrl ? (
            <img
              src={game.coverUrl}
              alt={game.title}
              className="w-full h-full object-cover"
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl">
              <GamepadIcon className="w-12 h-12" />
            </div>
          )}
        </button>

        {/* Selection Checkbox - z-20 to stay above hover overlay */}
        {onToggleSelect && (
          <label className={`absolute top-1 left-1 z-20 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <input
              type="checkbox"
              checked={selected || false}
              onChange={() => onToggleSelect(game.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded bg-gray-800/80 border-gray-500 text-blue-600 focus:ring-blue-500 cursor-pointer"
              aria-label={`Select ${game.title}`}
            />
          </label>
        )}

        {/* Badges - all on right side */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {/* Status Badge */}
          <span
            className={`${statusColors[game.status]} px-2 py-1 rounded text-xs font-semibold`}
          >
            {statusLabels[game.status]}
          </span>

          {/* Update Available Badge */}
          {game.updateAvailable && (
            <span className="bg-orange-500 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
              <RefreshIcon className="w-3 h-3" />
              Update
            </span>
          )}

          {/* Unmonitored Badge */}
          {!game.monitored && !game.updateAvailable && (
            <span className="bg-gray-900 px-2 py-1 rounded text-xs font-semibold">
              Unmonitored
            </span>
          )}
        </div>

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition flex items-center justify-center opacity-0 group-hover:opacity-100" role="group" aria-label={`Actions for ${game.title}`}>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => onToggleMonitor(game.id)}
                className="bg-blue-600 hover:bg-blue-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded transition text-sm"
                title={game.monitored ? 'Unmonitor' : 'Monitor'}
                aria-label={game.monitored ? `Unmonitor ${game.title}` : `Monitor ${game.title}`}
              >
                {game.monitored ? <EyeIcon aria-hidden="true" /> : <EyeSlashIcon aria-hidden="true" />}
              </button>
              <button
                onClick={handleNavigateToDetail}
                className="bg-purple-600 hover:bg-purple-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded transition text-sm"
                title="View Details"
                aria-label={`View details for ${game.title}`}
              >
                <PencilIcon aria-hidden="true" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded transition text-sm"
                title="Delete"
                aria-label={`Delete ${game.title}`}
              >
                <TrashIcon aria-hidden="true" />
              </button>
            </div>
            {onSearch && (
              <button
                onClick={() => onSearch(game)}
                className="bg-green-600 hover:bg-green-700 px-4 min-h-[44px] rounded transition text-sm w-full flex items-center justify-center gap-1"
                title="Search for releases"
                aria-label={`Search releases for ${game.title}`}
              >
                <MagnifyingGlassIcon aria-hidden="true" /> Search
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Game Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate" title={game.title}>
          <button
            onClick={handleNavigateToDetail}
            className="hover:text-blue-400 transition text-left w-full truncate"
          >
            {game.title}
          </button>
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

// Custom comparison function to prevent unnecessary re-renders
// Only re-render when game data or selected state changes
function arePropsEqual(prevProps: GameCardProps, nextProps: GameCardProps): boolean {
  // Compare game object properties that affect rendering
  const prevGame = prevProps.game;
  const nextGame = nextProps.game;

  if (prevGame.id !== nextGame.id) return false;
  if (prevGame.title !== nextGame.title) return false;
  if (prevGame.year !== nextGame.year) return false;
  if (prevGame.coverUrl !== nextGame.coverUrl) return false;
  if (prevGame.monitored !== nextGame.monitored) return false;
  if (prevGame.status !== nextGame.status) return false;
  if (prevGame.platform !== nextGame.platform) return false;
  if (prevGame.store !== nextGame.store) return false;
  if (prevGame.updateAvailable !== nextGame.updateAvailable) return false;

  // Compare selected state
  if (prevProps.selected !== nextProps.selected) return false;

  // Callback functions don't need comparison - they're stable via useCallback in parent
  return true;
}

export default memo(GameCard, arePropsEqual);
