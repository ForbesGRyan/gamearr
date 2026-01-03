import { useState } from 'react';
import { api } from '../api/client';

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

  // Debug: log whenever searchResults changes
  console.log('Current searchResults:', searchResults, 'Length:', searchResults.length);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await api.searchGames(searchQuery);

      // Debug logging
      console.log('Search response:', response);
      console.log('Response data:', response.data);

      if (response.success && response.data) {
        setSearchResults(response.data as SearchResult[]);
        console.log('Search results set:', response.data);
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
      const response = await api.addGame({ igdbId, monitored: true });

      if (response.success) {
        onGameAdded();
        onClose();
        setSearchQuery('');
        setSearchResults([]);
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
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-600" style={{ backgroundColor: 'rgb(17, 24, 39)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600" style={{ backgroundColor: 'rgb(31, 41, 55)' }}>
          <h2 className="text-2xl font-bold text-white">Add Game</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Search Form */}
        <div className="p-6 border-b border-gray-600">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a game..."
              className="flex-1 px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
              style={{ backgroundColor: 'rgb(55, 65, 81)' }}
              autoFocus
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              onMouseEnter={(e) => !isSearching && searchQuery.trim() && (e.currentTarget.style.backgroundColor = 'rgb(29, 78, 216)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37, 99, 235)'}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && (
            <div className="mt-3 p-3 border border-red-700 rounded text-red-200 text-sm" style={{ backgroundColor: 'rgb(127, 29, 29)' }}>
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
                  className="flex gap-4 rounded-lg p-4 transition border border-gray-600"
                  style={{ backgroundColor: 'rgb(55, 65, 81)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(75, 85, 99)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(55, 65, 81)'}
                >
                  {/* Cover */}
                  <div className="w-20 h-28 rounded flex-shrink-0" style={{ backgroundColor: 'rgb(75, 85, 99)' }}>
                    {game.coverUrl ? (
                      <img
                        src={game.coverUrl}
                        alt={game.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                        🎮
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
                      className="px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      style={{ backgroundColor: 'rgb(22, 163, 74)' }}
                      onMouseEnter={(e) => !isAdding && (e.currentTarget.style.backgroundColor = 'rgb(21, 128, 61)')}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(22, 163, 74)'}
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
