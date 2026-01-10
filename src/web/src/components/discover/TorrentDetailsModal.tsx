import { TorrentRelease, GameSearchResult } from './types';
import { formatRelativeDate, formatBytes } from '../../utils/formatters';

interface TorrentDetailsModalProps {
  torrent: TorrentRelease;
  modalGameSearch: string;
  modalGameResults: GameSearchResult[];
  selectedGame: GameSearchResult | null;
  isSearchingGames: boolean;
  isAddingToLibrary: boolean;
  onClose: () => void;
  onGameSearchChange: (value: string) => void;
  onGameSearch: (e: React.FormEvent) => void;
  onSelectGame: (game: GameSearchResult) => void;
  onAddToLibrary: () => void;
}

export default function TorrentDetailsModal({
  torrent,
  modalGameSearch,
  modalGameResults,
  selectedGame,
  isSearchingGames,
  isAddingToLibrary,
  onClose,
  onGameSearchChange,
  onGameSearch,
  onSelectGame,
  onAddToLibrary,
}: TorrentDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white pr-4 break-words">
            {torrent.title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4">
          {/* Quality Badge */}
          {torrent.quality && (
            <div>
              <span className="inline-block bg-blue-600 text-white text-sm px-3 py-1 rounded">
                {torrent.quality}
              </span>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Indexer</div>
              <div className="text-white font-medium">{torrent.indexer}</div>
            </div>
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Size</div>
              <div className="text-white font-medium">{formatBytes(torrent.size)}</div>
            </div>
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Seeders</div>
              <div className={`font-medium ${torrent.seeders >= 10 ? 'text-green-400' : torrent.seeders >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                {torrent.seeders}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Leechers</div>
              <div className="text-white font-medium">{torrent.leechers}</div>
            </div>
            <div className="bg-gray-700/50 rounded p-3 col-span-2">
              <div className="text-xs text-gray-400 mb-1">Published</div>
              <div className="text-white font-medium">
                {formatRelativeDate(torrent.publishedAt)}
                <span className="text-gray-400 text-sm ml-2">
                  ({new Date(torrent.publishedAt).toLocaleDateString()})
                </span>
              </div>
            </div>
          </div>

          {/* View on Indexer Link */}
          {torrent.infoUrl && (
            <a
              href={torrent.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on Indexer
            </a>
          )}

          {/* Game Search Section */}
          <div className="border-t border-gray-700 pt-4 mt-2">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Add to Library</h4>
            <p className="text-xs text-gray-500 mb-3">Search for a game to assign this torrent to:</p>

            <form onSubmit={onGameSearch} className="flex gap-2 mb-3">
              <input
                type="text"
                value={modalGameSearch}
                onChange={(e) => onGameSearchChange(e.target.value)}
                placeholder="Search for a game..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isSearchingGames || !modalGameSearch.trim()}
                className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-2 rounded text-sm transition"
              >
                {isSearchingGames ? 'Searching...' : 'Search'}
              </button>
            </form>

            {/* Game Search Results */}
            {modalGameResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                {modalGameResults.map((game) => (
                  <button
                    key={game.igdbId}
                    onClick={() => onSelectGame(game)}
                    className={`w-full flex items-center gap-3 p-2 rounded transition text-left ${
                      selectedGame?.igdbId === game.igdbId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    {game.coverUrl ? (
                      <img src={game.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-14 bg-gray-600 rounded flex items-center justify-center text-gray-500 text-xs">
                        N/A
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{game.title}</div>
                      <div className="text-xs opacity-75">
                        {game.year || 'TBA'}
                        {game.developer && ` - ${game.developer}`}
                      </div>
                    </div>
                    {selectedGame?.igdbId === game.igdbId && (
                      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Selected Game Display */}
            {selectedGame && (
              <div className="bg-green-900/30 border border-green-700 rounded p-3 mb-3">
                <div className="text-xs text-green-400 mb-1">Selected Game:</div>
                <div className="font-medium text-white">{selectedGame.title} ({selectedGame.year || 'TBA'})</div>
              </div>
            )}

            {/* Add to Library Button */}
            <button
              onClick={onAddToLibrary}
              disabled={!selectedGame || !torrent.downloadUrl || isAddingToLibrary}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded transition"
            >
              {isAddingToLibrary ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add to Library & Download
                </>
              )}
            </button>
            {!selectedGame && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Search and select a game above to enable downloading
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
