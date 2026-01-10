import { SearchResult } from '../../api/client';
import { GamepadIcon } from '../Icons';

interface GameResultCardProps {
  game: SearchResult;
  addingGameId: number | null;
  selectedPlatform: string | undefined;
  onPlatformChange: (igdbId: number, platform: string) => void;
  onAddGame: (game: SearchResult, searchReleases: boolean) => void;
}

function GameResultCard({
  game,
  addingGameId,
  selectedPlatform,
  onPlatformChange,
  onAddGame,
}: GameResultCardProps) {
  const isAdding = addingGameId === game.igdbId;
  const displayPlatform = selectedPlatform || game.platforms?.[0];

  return (
    <div className="bg-gray-800 hover:bg-gray-750 flex gap-4 rounded-lg p-4 transition border border-gray-700">
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
          {game.year && <span className="text-gray-400 ml-2">({game.year})</span>}
        </h3>
        {game.platforms && game.platforms.length > 0 && (
          <div className="flex items-center gap-2 mt-1">
            {game.platforms.length === 1 ? (
              <span className="text-sm text-gray-400">{game.platforms[0]}</span>
            ) : (
              <>
                <label className="text-sm text-gray-400">Platform:</label>
                <select
                  value={displayPlatform}
                  onChange={(e) => onPlatformChange(game.igdbId, e.target.value)}
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
          <p className="text-sm text-gray-400 mt-2 line-clamp-2">{game.summary}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        <button
          onClick={() => onAddGame(game, false)}
          disabled={isAdding}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
        >
          {isAdding ? 'Adding...' : 'Add to Library'}
        </button>
        <button
          onClick={() => onAddGame(game, true)}
          disabled={isAdding}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
        >
          {isAdding ? 'Adding...' : 'Add & Search'}
        </button>
      </div>
    </div>
  );
}

export default GameResultCard;
