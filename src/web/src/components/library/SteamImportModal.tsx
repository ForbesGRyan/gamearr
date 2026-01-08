import { MagnifyingGlassIcon } from '../Icons';
import type { SteamGame, SteamImportProgress } from './types';

interface SteamImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  onErrorDismiss: () => void;
  games: SteamGame[];
  filteredGames: SteamGame[];
  selectedGames: Set<number>;
  onToggleGame: (appId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onImport: () => void;
  isImporting: boolean;
  importProgress: SteamImportProgress;
  // Filter state
  searchQuery: string;
  onSearchChange: (query: string) => void;
  minPlaytime: number;
  onMinPlaytimeChange: (hours: number) => void;
  showOwned: boolean;
  onShowOwnedChange: (show: boolean) => void;
}

export function SteamImportModal({
  isOpen,
  onClose,
  isLoading,
  error,
  onErrorDismiss,
  games,
  filteredGames,
  selectedGames,
  onToggleGame,
  onSelectAll,
  onClearSelection,
  onImport,
  isImporting,
  importProgress,
  searchQuery,
  onSearchChange,
  minPlaytime,
  onMinPlaytimeChange,
  showOwned,
  onShowOwnedChange,
}: SteamImportModalProps) {
  if (!isOpen) return null;

  const importableCount = filteredGames.filter((g) => !g.alreadyInLibrary).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl border border-gray-600">
        <div className="bg-gray-700 p-4 border-b border-gray-600 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.07.16-1.5.44l-5.23-2.16C2.31 6.67 6.63 2 12 2m6.19 8.25c0-1.31-1.07-2.38-2.38-2.38s-2.38 1.07-2.38 2.38 1.07 2.38 2.38 2.38 2.38-1.07 2.38-2.38m-12.7 5.85c0 1.1.9 1.99 1.99 1.99.89 0 1.64-.58 1.9-1.38l-1.73-.71c-.41.13-.86.06-1.21-.21a1.35 1.35 0 0 1-.25-1.9l-1.33-.55c-.49.47-.77 1.11-.77 1.8l.4-.04z"/>
            </svg>
            Import from Steam
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-400">Loading Steam library...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-red-400 font-medium">{error.split('\n')[0]}</p>
                  {error.includes('\n') && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <ul className="text-sm text-red-300 space-y-1">
                        {error.split('\n').slice(1).map((err, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">-</span>
                            <span>{err}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!error.includes('Imported') && (
                    <p className="text-sm text-gray-400 mt-2">
                      Make sure you have configured your Steam API key and Steam ID in Settings.
                    </p>
                  )}
                </div>
                <button
                  onClick={onErrorDismiss}
                  className="text-gray-400 hover:text-white ml-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No games found in your Steam library.</p>
            </div>
          ) : (
            <>
              {/* Filter Controls */}
              <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search games..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="w-full bg-gray-600 border border-gray-500 rounded pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Min Playtime */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 whitespace-nowrap">Min playtime:</label>
                    <select
                      value={minPlaytime}
                      onChange={(e) => onMinPlaytimeChange(Number(e.target.value))}
                      className="bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Any</option>
                      <option value={1}>1+ hours</option>
                      <option value={5}>5+ hours</option>
                      <option value={10}>10+ hours</option>
                      <option value={25}>25+ hours</option>
                      <option value={50}>50+ hours</option>
                      <option value={100}>100+ hours</option>
                    </select>
                  </div>

                  {/* Show already owned */}
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={showOwned}
                      onChange={(e) => onShowOwnedChange(e.target.checked)}
                      className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600"
                    />
                    <span className="text-gray-300">Show already imported</span>
                  </label>
                </div>
              </div>

              {/* Stats and Select All */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-400">
                  {filteredGames.length === games.length
                    ? `${games.length} games`
                    : `${filteredGames.length} of ${games.length} games`}
                  {' - '}
                  {importableCount} available to import
                </p>
                <div className="flex items-center gap-3">
                  {selectedGames.size > 0 && (
                    <button
                      onClick={onClearSelection}
                      className="text-sm text-gray-400 hover:text-gray-300"
                    >
                      Clear selection
                    </button>
                  )}
                  <button
                    onClick={onSelectAll}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Select all ({importableCount})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredGames.map((game) => (
                  <div
                    key={game.appId}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                      game.alreadyInLibrary
                        ? 'bg-gray-700/30 border-gray-700 opacity-50 cursor-not-allowed'
                        : selectedGames.has(game.appId)
                        ? 'bg-blue-900/30 border-blue-600'
                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => !game.alreadyInLibrary && onToggleGame(game.appId)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGames.has(game.appId)}
                      disabled={game.alreadyInLibrary}
                      onChange={() => {}}
                      className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600"
                    />
                    <img
                      src={game.headerImageUrl}
                      alt=""
                      className="w-24 h-11 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{game.name}</p>
                      <p className="text-xs text-gray-400">
                        {game.playtimeMinutes > 0
                          ? `${Math.round(game.playtimeMinutes / 60)} hours played`
                          : 'Never played'}
                        {game.alreadyInLibrary && ' - Already in library'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-700 p-4 border-t border-gray-600 flex items-center justify-between rounded-b-lg">
          {isImporting ? (
            <div className="flex-1 mr-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300 truncate max-w-md">
                  {importProgress.currentGame || 'Importing...'}
                </span>
                {importProgress.total > 0 && (
                  <span className="text-sm text-gray-400 ml-2">
                    {importProgress.current}/{importProgress.total}
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: importProgress.total > 0
                      ? `${(importProgress.current / importProgress.total) * 100}%`
                      : '100%',
                    animation: importProgress.total === 0 ? 'pulse 2s infinite' : 'none',
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {selectedGames.size} game{selectedGames.size !== 1 ? 's' : ''} selected
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition disabled:opacity-50"
            >
              {isImporting ? 'Close' : 'Cancel'}
            </button>
            {!isImporting && (
              <button
                onClick={onImport}
                disabled={selectedGames.size === 0}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50"
              >
                Import {selectedGames.size} Game{selectedGames.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
