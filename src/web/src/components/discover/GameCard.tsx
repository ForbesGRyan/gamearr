import { PopularGame, MultiplayerInfo } from './types';

interface GameCardProps {
  popularGame: PopularGame;
  isAdding: boolean;
  onAddToLibrary: () => void;
  getMultiplayerBadges: (mp: MultiplayerInfo | undefined) => string[];
}

export default function GameCard({
  popularGame,
  isAdding,
  onAddToLibrary,
  getMultiplayerBadges,
}: GameCardProps) {
  const { game, rank, inLibrary } = popularGame;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition group relative">
      {/* Rank badge */}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded z-10">
        #{rank}
      </div>

      {/* In Library badge */}
      {inLibrary && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
          In Library
        </div>
      )}

      {/* Cover image */}
      <div className="aspect-[3/4] bg-gray-700 relative">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            No Cover
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-2">
          {!inLibrary && (
            <button
              onClick={onAddToLibrary}
              disabled={isAdding}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm px-4 py-2 min-h-[44px] rounded w-full"
            >
              {isAdding ? 'Adding...' : 'Add to Library'}
            </button>
          )}
          {game.totalRating && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
              game.totalRating >= 95 ? 'bg-sky-500' :
              game.totalRating >= 90 ? 'bg-green-700' :
              game.totalRating >= 85 ? 'bg-green-600' :
              game.totalRating >= 80 ? 'bg-green-500' :
              game.totalRating >= 70 ? 'bg-yellow-600' :
              game.totalRating >= 60 ? 'bg-orange-600' : 'bg-red-600'
            }`}>
              {game.totalRating}%
            </span>
          )}
          {game.developer && (
            <div className="text-gray-300 text-xs text-center truncate w-full">
              {game.developer}
            </div>
          )}
        </div>
      </div>

      {/* Game info */}
      <div className="p-2">
        <h3 className="font-medium text-sm truncate" title={game.title}>
          {game.title}
        </h3>
        <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
          <span>{game.year || 'TBA'}</span>
          {game.genres && game.genres.length > 0 && (
            <span className="truncate ml-2">{game.genres[0]}</span>
          )}
        </div>
        {/* Multiplayer badges */}
        {game.multiplayer && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {getMultiplayerBadges(game.multiplayer).slice(0, 2).map((badge, i) => (
              <span
                key={i}
                className="bg-purple-600/80 text-white text-[10px] px-1.5 py-0.5 rounded"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
