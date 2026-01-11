import { useNavigate } from 'react-router-dom';
import StoreIcon from '../StoreIcon';
import { EyeIcon, EyeSlashIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, GamepadIcon } from '../Icons';
import { getGameDetailPath } from '../../utils/slug';
import type { Game, SimilarGame } from './types';

interface LibraryOverviewGridProps {
  games: Game[];
  selectedGameIds: Set<number>;
  onToggleSelect: (gameId: number) => void;
  onToggleMonitor: (id: number) => void;
  onSearch: (game: Game) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
}

export function LibraryOverviewGrid({
  games,
  selectedGameIds,
  onToggleSelect,
  onToggleMonitor,
  onSearch,
  onEdit,
  onDelete,
}: LibraryOverviewGridProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {games.map((game) => {
        // Parse JSON fields
        const genres = game.genres ? JSON.parse(game.genres) as string[] : [];
        const gameModes = game.gameModes ? JSON.parse(game.gameModes) as string[] : [];
        const similarGames = game.similarGames ? JSON.parse(game.similarGames) as SimilarGame[] : [];

        return (
          <div
            key={game.id}
            className={`bg-gray-800 rounded-lg p-5 hover:ring-1 hover:ring-gray-600 transition ${selectedGameIds.has(game.id) ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="flex gap-5">
              {/* Checkbox */}
              <div className="flex-shrink-0 pt-1">
                <input
                  type="checkbox"
                  checked={selectedGameIds.has(game.id)}
                  onChange={() => onToggleSelect(game.id)}
                  className="w-5 h-5 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800 cursor-pointer"
                />
              </div>
              {/* Cover & Rating */}
              <div className="flex-shrink-0">
                <div
                  className="w-32 h-44 rounded-lg bg-gray-700 overflow-hidden shadow-lg cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                  onClick={() => navigate(getGameDetailPath(game.platform, game.title))}
                >
                  {game.coverUrl ? (
                    <img src={game.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <GamepadIcon className="w-10 h-10" />
                    </div>
                  )}
                </div>
                {game.totalRating && (
                  <div className="mt-3 text-center">
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold text-white ${
                      game.totalRating >= 95 ? 'bg-sky-500' :
                      game.totalRating >= 90 ? 'bg-green-700' :
                      game.totalRating >= 85 ? 'bg-green-600' :
                      game.totalRating >= 80 ? 'bg-green-500' :
                      game.totalRating >= 70 ? 'bg-yellow-600' :
                      game.totalRating >= 60 ? 'bg-orange-600' : 'bg-red-600'
                    }`}>
                      {game.totalRating}%
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      className="font-bold text-xl hover:text-blue-400 cursor-pointer transition"
                      onClick={() => navigate(getGameDetailPath(game.platform, game.title))}
                    >
                      {game.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                      <span>{game.year || 'Unknown year'}</span>
                      <span>&#8226;</span>
                      <span>{game.platform}</span>
                      {game.store && (
                        <>
                          <span>&#8226;</span>
                          <StoreIcon store={game.store} />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {game.updateAvailable && (
                      <span className="text-xs bg-orange-500 px-2 py-1 rounded flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Update Available
                      </span>
                    )}
                    {!game.monitored && (
                      <span className="text-xs bg-gray-600 px-2 py-1 rounded">Unmonitored</span>
                    )}
                    <span className={`px-3 py-1.5 rounded text-sm font-medium ${
                      game.status === 'downloaded' ? 'bg-green-600' :
                      game.status === 'downloading' ? 'bg-blue-600' : 'bg-yellow-600'
                    }`}>
                      {game.status === 'downloaded' ? 'Downloaded' :
                       game.status === 'downloading' ? 'Downloading' : 'Wanted'}
                    </span>
                  </div>
                </div>

                {/* Developer / Publisher */}
                {(game.developer || game.publisher) && (
                  <div className="flex gap-6 mt-2 text-sm">
                    {game.developer && (
                      <div>
                        <span className="text-gray-500">Developer: </span>
                        <span className="text-gray-300">{game.developer}</span>
                      </div>
                    )}
                    {game.publisher && game.publisher !== game.developer && (
                      <div>
                        <span className="text-gray-500">Publisher: </span>
                        <span className="text-gray-300">{game.publisher}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Genres & Game Modes */}
                {(genres.length > 0 || gameModes.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {genres.map((genre) => (
                      <span key={genre} className="text-xs bg-gray-700 px-2.5 py-1 rounded-full">
                        {genre}
                      </span>
                    ))}
                    {gameModes.map((mode) => (
                      <span key={mode} className="text-xs bg-blue-900 px-2.5 py-1 rounded-full">
                        {mode}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description */}
                {game.summary && (
                  <p className="text-sm text-gray-400 mt-3 leading-relaxed">{game.summary}</p>
                )}

                {/* Similar Games */}
                {similarGames.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Similar Games</p>
                    <div className="flex gap-3">
                      {similarGames.slice(0, 6).map((sg) => (
                        <div
                          key={sg.igdbId}
                          className="flex-shrink-0 w-14 group/similar cursor-pointer"
                          title={sg.name}
                        >
                          <div className="w-14 h-20 rounded bg-gray-700 overflow-hidden shadow">
                            {sg.coverUrl ? (
                              <img
                                src={sg.coverUrl}
                                alt={sg.name}
                                className="w-full h-full object-cover group-hover/similar:scale-110 transition"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <GamepadIcon className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 truncate text-center">{sg.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => onToggleMonitor(game.id)}
                    className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center gap-1.5"
                  >
                    {game.monitored ? <><EyeIcon /> Unmonitor</> : <><EyeSlashIcon /> Monitor</>}
                  </button>
                  <button
                    onClick={() => onSearch(game)}
                    className="text-sm px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 transition flex items-center gap-1.5"
                  >
                    <MagnifyingGlassIcon /> Search
                  </button>
                  <button
                    onClick={() => onEdit(game)}
                    className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center gap-1.5"
                  >
                    <PencilIcon /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(game)}
                    className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-red-600 transition flex items-center gap-1.5"
                  >
                    <TrashIcon /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
