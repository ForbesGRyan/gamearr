import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Game } from '../../api/client';
import { GamepadIcon, TrashIcon, MagnifyingGlassIcon } from '../Icons';

interface GameDetailHeaderProps {
  game: Game;
  onDelete: () => void;
}

function GameDetailHeader({ game, onDelete }: GameDetailHeaderProps) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSearchReleases = () => {
    navigate(`/search?q=${encodeURIComponent(game.title)}`);
  };

  const getStatusBadge = () => {
    const statusColors = {
      wanted: 'bg-orange-600',
      downloading: 'bg-blue-600',
      downloaded: 'bg-green-600',
    };
    return (
      <span className={`${statusColors[game.status]} px-2 py-1 rounded text-sm font-medium`}>
        {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
      </span>
    );
  };

  return (
    <div className="flex gap-6 mb-6">
      {/* Cover Image */}
      <div className="w-48 flex-shrink-0">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.title}
            className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-700 rounded-lg flex items-center justify-center">
            <GamepadIcon className="w-16 h-16 text-gray-500" />
          </div>
        )}
      </div>

      {/* Game Info */}
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-white mb-2">
          {game.title}
          {game.year && (
            <span className="text-gray-400 font-normal ml-2">({game.year})</span>
          )}
        </h1>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="bg-gray-700 px-2 py-1 rounded text-sm">{game.platform}</span>
          {getStatusBadge()}
          {game.store && (
            <span className="bg-purple-600/50 px-2 py-1 rounded text-sm">{game.store}</span>
          )}
          {!game.monitored && (
            <span className="bg-gray-600 px-2 py-1 rounded text-sm">Unmonitored</span>
          )}
          {game.updateAvailable && (
            <span className="bg-blue-600 px-2 py-1 rounded text-sm">Update Available</span>
          )}
        </div>

        {/* Developer/Publisher */}
        {(game.developer || game.publisher) && (
          <p className="text-gray-400 mb-4">
            {game.developer && <span>Developed by <span className="text-gray-200">{game.developer}</span></span>}
            {game.developer && game.publisher && <span className="mx-2">|</span>}
            {game.publisher && <span>Published by <span className="text-gray-200">{game.publisher}</span></span>}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSearchReleases}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 min-h-[44px] rounded transition"
          >
            <MagnifyingGlassIcon className="w-5 h-5" />
            Search Releases
          </button>

          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Delete game?</span>
              <button
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="bg-red-600 hover:bg-red-700 px-3 py-2 min-h-[44px] rounded transition"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-gray-600 hover:bg-gray-500 px-3 py-2 min-h-[44px] rounded transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 px-4 py-2 min-h-[44px] rounded transition"
            >
              <TrashIcon className="w-5 h-5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameDetailHeader;
