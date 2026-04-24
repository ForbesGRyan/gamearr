import { useState, useEffect } from 'react';
import { useSearchGames, useAddGame, useUpdateGameStores } from '../queries';
import StoreSelector from './StoreSelector';
import LibrarySelector from './LibrarySelector';
import { CloseIcon, GamepadIcon } from './Icons';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AddGameModal({ isOpen, onClose }: AddGameModalProps) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);

  const searchQueryHook = useSearchGames(searchQuery, {
    enabled: searchQuery.trim().length > 0,
  });
  const addGameMutation = useAddGame();
  const updateStoresMutation = useUpdateGameStores();

  const searchResults = searchQueryHook.data ?? [];
  const isSearching = searchQueryHook.isFetching;
  const isAdding = addGameMutation.isPending || updateStoresMutation.isPending;

  const searchError = searchQueryHook.error
    ? ((searchQueryHook.error as Error).message || 'Search failed')
    : null;
  const displayError = error ?? searchError;

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setError(null);
    setSearchQuery(searchInput.trim());
  };

  const handleAddGame = async (igdbId: number) => {
    setError(null);

    try {
      // Add the game first (using first store for legacy field)
      const added = await addGameMutation.mutateAsync({
        igdbId,
        monitored: true,
        store: selectedStores[0] || null,
        libraryId: selectedLibraryId ?? undefined,
      });

      // If multiple stores selected, update stores via the dedicated endpoint
      if (selectedStores.length > 0) {
        await updateStoresMutation.mutateAsync({
          id: added.id,
          stores: selectedStores,
        });
      }

      onClose();
      setSearchInput('');
      setSearchQuery('');
      setSelectedStores([]);
      setSelectedLibraryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add game');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-game-modal-title"
    >
      <div className="fixed inset-0 md:inset-auto md:relative md:max-w-4xl md:max-h-[90vh] w-full h-full md:w-auto md:h-auto bg-gray-900 md:rounded-lg flex flex-col shadow-2xl border-0 md:border border-gray-600">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-gray-700 flex items-center justify-between p-4 md:p-6 border-b border-gray-600 md:rounded-t-lg flex-shrink-0 z-10">
          <h2 id="add-game-modal-title" className="text-xl md:text-2xl font-bold text-white">Add Game</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <CloseIcon className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Form */}
          <div className="p-4 md:p-6 border-b border-gray-600">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2" role="search">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search for a game..."
                className="bg-gray-700 flex-1 px-4 py-2 min-h-[44px] rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
                aria-label="Search for games"
              />
              <button
                type="submit"
                disabled={isSearching || !searchInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 min-h-[44px] rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <StoreSelector value={selectedStores} onChange={setSelectedStores} label="Digital Stores (Optional)" />
                <p className="text-xs text-gray-400 mt-1">
                  If you select stores, the game will be marked as already owned.
                </p>
              </div>
              <LibrarySelector
                value={selectedLibraryId}
                onChange={setSelectedLibraryId}
                label="Library (Optional)"
                optional={true}
              />
            </div>

            {displayError && (
              <div className="bg-red-900 mt-3 p-3 border border-red-700 rounded text-red-200 text-sm">
                {displayError}
              </div>
            )}
          </div>

          {/* Search Results */}
          <div className="p-4 md:p-6">
            {searchResults.length === 0 ? (
              <div className="text-center text-gray-200 py-12">
                {isSearching ? 'Searching...' : 'Search for games to add to your library'}
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((game) => (
                  <div
                    key={game.igdbId}
                    className="bg-gray-700 hover:bg-gray-600 flex gap-4 rounded-lg p-4 transition border border-gray-600"
                  >
                    {/* Cover */}
                    <div className="bg-gray-600 w-16 h-22 md:w-20 md:h-28 rounded flex-shrink-0">
                      {game.coverUrl ? (
                        <img
                          src={game.coverUrl}
                          alt={`Cover art for ${game.title}`}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400" aria-label={`No cover art for ${game.title}`}>
                          <GamepadIcon className="w-8 h-8" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg text-white">
                        {game.title}
                        {game.year && (
                          <span className="text-gray-300 ml-2">({game.year})</span>
                        )}
                      </h3>
                      {game.platforms && (
                        <p className="text-sm text-gray-300 mt-1">
                          {game.platforms.slice(0, 3).join(', ')}
                        </p>
                      )}
                      {game.summary && (
                        <p className="text-sm text-gray-200 mt-2 line-clamp-2 hidden md:block">
                          {game.summary}
                        </p>
                      )}
                    </div>

                    {/* Add Button */}
                    <div className="flex-shrink-0 flex items-center">
                      <button
                        onClick={() => handleAddGame(game.igdbId)}
                        disabled={isAdding}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 min-h-[44px] rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
                        aria-label={`Add ${game.title} to library`}
                      >
                        {isAdding ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full md:w-auto bg-gray-600 hover:bg-gray-500 px-4 py-2 min-h-[44px] rounded transition text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddGameModal;
