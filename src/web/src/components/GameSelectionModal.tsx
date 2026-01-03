import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Game {
  id: number;
  title: string;
  year?: number;
  coverUrl?: string;
  monitored: boolean;
  status: 'wanted' | 'downloading' | 'downloaded';
  platform: string;
}

interface GameSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gameId: number) => void;
  releaseName: string;
}

function GameSelectionModal({ isOpen, onClose, onSelect, releaseName }: GameSelectionModalProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGames();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGames(games);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredGames(
        games.filter((game) =>
          game.title.toLowerCase().includes(query) ||
          game.platform.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, games]);

  const loadGames = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getGames();

      if (response.success && response.data) {
        const gameList = response.data as Game[];
        setGames(gameList);
        setFilteredGames(gameList);
      } else {
        setError(response.error || 'Failed to load games');
      }
    } catch (err) {
      setError('Failed to load games');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (gameId: number) => {
    onSelect(gameId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Select Game</h3>
              <p className="text-sm text-gray-400">
                Choose which game this release is for:
              </p>
              <p className="text-sm text-blue-400 mt-1 truncate" title={releaseName}>
                {releaseName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition ml-4"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Game List */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading games...</p>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">
                {searchQuery ? 'No games match your search' : 'No games in library. Add games first!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleSelect(game.id)}
                  className="w-full flex items-center gap-4 p-3 bg-gray-700 hover:bg-gray-650 rounded transition text-left"
                >
                  {game.coverUrl ? (
                    <img
                      src={game.coverUrl}
                      alt={game.title}
                      className="w-12 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-gray-600 rounded flex items-center justify-center text-gray-500 text-xs">
                      No Cover
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">
                      {game.title}
                    </div>
                    <div className="text-sm text-gray-400">
                      {game.platform}
                      {game.year && ` • ${game.year}`}
                    </div>
                    <div className="text-xs mt-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded ${
                          game.status === 'downloaded'
                            ? 'bg-green-900 text-green-200'
                            : game.status === 'downloading'
                            ? 'bg-blue-900 text-blue-200'
                            : 'bg-yellow-900 text-yellow-200'
                        }`}
                      >
                        {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-500">→</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameSelectionModal;
