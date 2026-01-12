import { Link } from 'react-router-dom';
import { getGameDetailPath } from '../../utils/slug';
import { getCoverUrl } from '../../utils/images';
import StoreIcon from '../StoreIcon';
import { EyeIcon, EyeSlashIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, GamepadIcon } from '../Icons';
import type { Game, SortColumn } from './types';

interface LibraryTableViewProps {
  games: Game[];
  selectedGameIds: Set<number>;
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  onSort: (column: SortColumn) => void;
  onToggleSelect: (gameId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleMonitor: (id: number) => void;
  onSearch: (game: Game) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
}

export function LibraryTableView({
  games,
  selectedGameIds,
  sortColumn,
  sortDirection,
  onSort,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  isAllSelected,
  isSomeSelected,
  onToggleMonitor,
  onSearch,
  onEdit,
  onDelete,
}: LibraryTableViewProps) {
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <span className="text-gray-500 ml-1">&#8597;</span>;
    }
    return <span className="text-blue-400 ml-1">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  return (
    <div className="hidden md:block bg-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSelectAll();
                  } else {
                    onClearSelection();
                  }
                }}
                className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
              />
            </th>
            <th
              className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-600 transition select-none"
              onClick={() => onSort('title')}
            >
              Title<SortIndicator column="title" />
            </th>
            <th
              className="text-left px-4 py-3 font-medium w-20 cursor-pointer hover:bg-gray-600 transition select-none"
              onClick={() => onSort('year')}
            >
              Year<SortIndicator column="year" />
            </th>
            <th
              className="text-left px-4 py-3 font-medium w-20 cursor-pointer hover:bg-gray-600 transition select-none"
              onClick={() => onSort('rating')}
            >
              Rating<SortIndicator column="rating" />
            </th>
            <th className="text-left px-4 py-3 font-medium w-40">
              Genres
            </th>
            <th
              className="text-center px-2 py-3 font-medium w-12 cursor-pointer hover:bg-gray-600 transition select-none"
              onClick={() => onSort('monitored')}
              title="Monitored"
            >
              <EyeIcon className="w-4 h-4 mx-auto" />
            </th>
            <th
              className="text-left px-4 py-3 font-medium w-24 cursor-pointer hover:bg-gray-600 transition select-none"
              onClick={() => onSort('store')}
            >
              Store<SortIndicator column="store" />
            </th>
            <th
              className="text-left px-4 py-3 font-medium w-28 cursor-pointer hover:bg-gray-600 transition select-none"
              onClick={() => onSort('status')}
            >
              Status<SortIndicator column="status" />
            </th>
            <th className="text-right px-4 py-3 font-medium w-32">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {games.map((game) => (
            <tr
              key={game.id}
              className={`hover:bg-gray-700/50 transition ${selectedGameIds.has(game.id) ? 'bg-blue-900/30' : ''}`}
            >
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedGameIds.has(game.id)}
                  onChange={() => onToggleSelect(game.id)}
                  className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Link
                    to={getGameDetailPath(game.platform, game.title)}
                    viewTransition
                    className="w-8 h-10 rounded bg-gray-700 flex-shrink-0 overflow-hidden"
                    style={{ viewTransitionName: `game-cover-${game.id}` }}
                  >
                    {game.coverUrl ? (
                      <img src={getCoverUrl(game.id, game.coverUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <GamepadIcon className="w-4 h-4" />
                      </div>
                    )}
                  </Link>
                  <Link
                    to={getGameDetailPath(game.platform, game.title)}
                    viewTransition
                    className="font-medium hover:text-blue-400 transition"
                  >
                    {game.title}
                  </Link>
                  {game.updateAvailable && (
                    <span className="text-xs bg-orange-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Update
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-400">{game.year || '\u2014'}</td>
              <td className="px-4 py-3">
                {game.totalRating ? (
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
                ) : (
                  <span className="text-gray-500">{'\u2014'}</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400 truncate max-w-[160px]">
                {game.genres ? (
                  (() => {
                    try {
                      const genres = JSON.parse(game.genres) as string[];
                      return genres.slice(0, 2).join(', ') || '\u2014';
                    } catch {
                      return '\u2014';
                    }
                  })()
                ) : '\u2014'}
              </td>
              <td className="px-2 py-3 text-center">
                {game.monitored ? (
                  <EyeIcon className="w-4 h-4 mx-auto text-green-400" />
                ) : (
                  <EyeSlashIcon className="w-4 h-4 mx-auto text-gray-500" />
                )}
              </td>
              <td className="px-4 py-3">
                {((game.stores?.length ?? 0) > 0 || game.store) ? <StoreIcon stores={game.stores} store={game.store} /> : <span className="text-gray-500">{'\u2014'}</span>}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  game.status === 'downloaded' ? 'bg-green-600' :
                  game.status === 'downloading' ? 'bg-blue-600' : 'bg-yellow-600'
                }`}>
                  {game.status === 'downloaded' ? 'Downloaded' :
                   game.status === 'downloading' ? 'Downloading' : 'Wanted'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => onToggleMonitor(game.id)}
                    className="p-1.5 rounded hover:bg-gray-600 transition"
                    title={game.monitored ? 'Unmonitor' : 'Monitor'}
                  >
                    {game.monitored ? <EyeIcon /> : <EyeSlashIcon />}
                  </button>
                  <button
                    onClick={() => onSearch(game)}
                    className="p-1.5 rounded hover:bg-gray-600 transition"
                    title="Search"
                  >
                    <MagnifyingGlassIcon />
                  </button>
                  <button
                    onClick={() => onEdit(game)}
                    className="p-1.5 rounded hover:bg-gray-600 transition"
                    title="Edit"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => onDelete(game)}
                    className="p-1.5 rounded hover:bg-red-600 transition"
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
