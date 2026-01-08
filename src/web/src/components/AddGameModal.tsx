import { useState, useEffect } from 'react';
import { api } from '../api/client';
import StoreSelector from './StoreSelector';
import { CloseIcon, GamepadIcon } from './Icons';

interface SearchResult {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  platforms?: string[];
}

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameAdded: () => void;
}

function AddGameModal({ isOpen, onClose, onGameAdded }: AddGameModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await api.searchGames(searchQuery);

      if (response.success && response.data) {
        setSearchResults(response.data as SearchResult[]);
      } else {
        setError(response.error || 'Search failed');
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search games');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddGame = async (igdbId: number) => {
    setIsAdding(true);
    setError(null);

    try {
      const response = await api.addGame({ igdbId, monitored: true, store: selectedStore });

      if (response.success) {
        onGameAdded();
        onClose();
        setSearchQuery('');
        setSearchResults([]);
        setSelectedStore(null);
      } else {
        setError(response.error || 'Failed to add game');
      }
    } catch (err) {
      setError('Failed to add game');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-game-modal-title"
    >
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-600">
        {/* Header */}
        <div className="bg-gray-700 flex items-center justify-between p-6 border-b border-gray-600 rounded-t-lg">
          <h2 id="add-game-modal-title" className="text-2xl font-bold text-white">Add Game</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white"
            aria-label="Close modal"
          >
            <CloseIcon className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Search Form */}
        <div className="p-6 border-b border-gray-600">
          <form onSubmit={handleSearch} className="flex gap-2" role="search">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a game..."
              className="bg-gray-700 flex-1 px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
              autoFocus
              aria-label="Search for games"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="mt-4">
            <StoreSelector value={selectedStore} onChange={setSelectedStore} label="Digital Store (Optional)" />
            <p className="text-xs text-gray-400 mt-1">
              If you select a store, the game will be marked as already owned (no download needed).
            </p>
          </div>

          {error && (
            <div className="bg-red-900 mt-3 p-3 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto p-6">
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
                  <div className="bg-gray-600 w-20 h-28 rounded flex-shrink-0">
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
                    <h3 className="font-semibold text-lg text-white">
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
                      <p className="text-sm text-gray-200 mt-2 line-clamp-2">
                        {game.summary}
                      </p>
                    )}
                  </div>

                  {/* Add Button */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleAddGame(game.igdbId)}
                      disabled={isAdding}
                      className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
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
    </div>
  );
}

export default AddGameModal;
