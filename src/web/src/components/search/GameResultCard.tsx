import { useMemo } from 'react';
import { SearchResult } from '../../api/client';
import { GamepadIcon } from '../Icons';
import { useLibraries } from '../../queries/libraries';

interface GameResultCardProps {
  game: SearchResult;
  addingGameId: number | null;
  selectedPlatform: string | undefined;
  onPlatformChange: (igdbId: number, platform: string) => void;
  selectedLibraryId: number | null;
  onLibraryChange: (libraryId: number | null) => void;
  onAddGame: (game: SearchResult, searchReleases: boolean) => void;
}

function GameResultCard({
  game,
  addingGameId,
  selectedPlatform,
  onPlatformChange,
  selectedLibraryId,
  onLibraryChange,
  onAddGame,
}: GameResultCardProps) {
  const isAdding = addingGameId === game.igdbId;
  const displayPlatform = selectedPlatform || game.platforms?.[0];

  const { data: librariesData } = useLibraries();
  const libraries = useMemo(
    () => (librariesData ?? []).filter((lib) => lib.downloadEnabled),
    [librariesData]
  );

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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
          {game.platforms && game.platforms.length > 0 && (
            <div className="flex items-center gap-2">
              {game.platforms.length === 1 ? (
                <>
                  <span className="text-sm text-gray-400">Platform:</span>
                  <span className="text-sm text-gray-300">{game.platforms[0]}</span>
                </>
              ) : (
                <>
                  <label htmlFor={`platform-${game.igdbId}`} className="text-sm text-gray-400">Platform:</label>
                  <select
                    id={`platform-${game.igdbId}`}
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
          {libraries.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor={`library-${game.igdbId}`} className="text-sm text-gray-400">Library:</label>
              <select
                id={`library-${game.igdbId}`}
                value={selectedLibraryId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onLibraryChange(v ? parseInt(v, 10) : null);
                }}
                title="Choose which library to add to. Defaults to auto-assign by platform."
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Auto-assign</option>
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                    {lib.platform ? ` (${lib.platform})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
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
          title="Add this game to your library. Stays on the search page."
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
        >
          {isAdding ? 'Adding...' : 'Add to Library'}
        </button>
        <button
          onClick={() => onAddGame(game, true)}
          disabled={isAdding}
          title="Add this game then open its detail page and search indexers for downloadable releases."
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
        >
          {isAdding ? 'Adding...' : 'Add & Find Releases'}
        </button>
      </div>
    </div>
  );
}

export default GameResultCard;
