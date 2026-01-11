import { MagnifyingGlassIcon } from '../Icons';
import type { GogGame, GogImportProgress } from './types';

interface GogImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  onErrorDismiss: () => void;
  games: GogGame[];
  filteredGames: GogGame[];
  selectedGames: Set<number>;
  onToggleGame: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onImport: () => void;
  isImporting: boolean;
  importProgress: GogImportProgress;
  // Filter state
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showOwned: boolean;
  onShowOwnedChange: (show: boolean) => void;
}

export function GogImportModal({
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
  showOwned,
  onShowOwnedChange,
}: GogImportModalProps) {
  if (!isOpen) return null;

  const importableCount = filteredGames.filter((g) => !g.alreadyInLibrary).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl border border-gray-600">
        <div className="bg-gray-700 p-4 border-b border-gray-600 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {/* GOG Logo */}
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-13v6l5.25 3.15.75-1.23-4.5-2.67V7H10z"/>
            </svg>
            Import from GOG
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
                <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-400">Loading GOG library...</p>
              </div>
            </div>
          ) : error ? (
            (() => {
              const isSuccess = error.startsWith('Imported');
              return (
                <div className={`${isSuccess ? 'bg-green-900/30 border-green-600' : 'bg-red-900/30 border-red-600'} border rounded-lg p-4`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={`${isSuccess ? 'text-green-400' : 'text-red-400'} font-medium`}>{error.split('\n')[0]}</p>
                      {error.includes('\n') && (
                        <div className="mt-2 max-h-32 overflow-y-auto">
                          <ul className={`text-sm ${isSuccess ? 'text-green-300' : 'text-red-300'} space-y-1`}>
                            {error.split('\n').slice(1).map((err, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className={`${isSuccess ? 'text-green-500' : 'text-red-500'} mt-0.5`}>-</span>
                                <span>{err}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!isSuccess && (
                        <p className="text-sm text-gray-400 mt-2">
                          Make sure you have configured your GOG refresh token in Settings.
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
              );
            })()
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No games found in your GOG library.</p>
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
                      className="w-full bg-gray-600 border border-gray-500 rounded pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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

                  {/* Show already owned */}
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={showOwned}
                      onChange={(e) => onShowOwnedChange(e.target.checked)}
                      className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-purple-600"
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
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Select all ({importableCount})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredGames.map((game) => (
                  <div
                    key={game.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                      game.alreadyInLibrary
                        ? 'bg-gray-700/30 border-gray-700 opacity-50 cursor-not-allowed'
                        : selectedGames.has(game.id)
                        ? 'bg-purple-900/30 border-purple-600'
                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => !game.alreadyInLibrary && onToggleGame(game.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGames.has(game.id)}
                      disabled={game.alreadyInLibrary}
                      onChange={() => {}}
                      className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-purple-600"
                    />
                    <img
                      src={game.imageUrl}
                      alt=""
                      className="w-24 h-11 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{game.title}</p>
                      <p className="text-xs text-gray-400">
                        {game.alreadyInLibrary ? 'Already in library' : 'GOG.com'}
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
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
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
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
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
