import { Game } from '../../api/client';
import { StarIcon, GamepadIcon } from '../Icons';

interface GameMetadataSectionProps {
  game: Game;
}

interface SimilarGame {
  igdbId: number;
  name: string;
  coverUrl?: string;
}

function GameMetadataSection({ game }: GameMetadataSectionProps) {
  // Parse JSON arrays from the game object
  const genres = game.genres ? JSON.parse(game.genres) as string[] : [];
  const gameModes = game.gameModes ? JSON.parse(game.gameModes) as string[] : [];
  const similarGames = game.similarGames ? JSON.parse(game.similarGames) as SimilarGame[] : [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      {game.summary && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Summary</h3>
          <p className="text-gray-300 leading-relaxed">{game.summary}</p>
        </div>
      )}

      {/* Rating */}
      {game.totalRating !== undefined && game.totalRating !== null && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Rating</h3>
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="6"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke={game.totalRating >= 75 ? '#22c55e' : game.totalRating >= 50 ? '#eab308' : '#ef4444'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(game.totalRating / 100) * 176} 176`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-bold text-lg">
                {Math.round(game.totalRating)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <StarIcon
                  key={i}
                  className={`w-5 h-5 ${
                    i < Math.round(game.totalRating! / 20)
                      ? 'text-yellow-400'
                      : 'text-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Developer & Publisher */}
      {(game.developer || game.publisher) && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Credits</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {game.developer && (
              <div>
                <span className="text-sm text-gray-400">Developer</span>
                <p className="text-white">{game.developer}</p>
              </div>
            )}
            {game.publisher && (
              <div>
                <span className="text-sm text-gray-400">Publisher</span>
                <p className="text-white">{game.publisher}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Genres & Game Modes */}
      {(genres.length > 0 || gameModes.length > 0) && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {genres.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="bg-blue-600/30 text-blue-300 px-3 py-1 rounded-full text-sm"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {gameModes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Game Modes</h3>
                <div className="flex flex-wrap gap-2">
                  {gameModes.map((mode) => (
                    <span
                      key={mode}
                      className="bg-purple-600/30 text-purple-300 px-3 py-1 rounded-full text-sm"
                    >
                      {mode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Similar Games */}
      {similarGames.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Similar Games</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {similarGames.map((similar) => (
              <div
                key={similar.igdbId}
                className="flex-shrink-0 w-28"
              >
                {similar.coverUrl ? (
                  <img
                    src={similar.coverUrl}
                    alt={similar.name}
                    className="w-28 h-40 object-cover rounded-lg mb-2"
                  />
                ) : (
                  <div className="w-28 h-40 bg-gray-700 rounded-lg mb-2 flex items-center justify-center">
                    <GamepadIcon className="w-8 h-8 text-gray-500" />
                  </div>
                )}
                <p className="text-sm text-gray-300 truncate" title={similar.name}>
                  {similar.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Added Date */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Library Info</h3>
        <div className="text-gray-400">
          <span>Added to library: </span>
          <span className="text-white">{formatDate(game.addedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default GameMetadataSection;
