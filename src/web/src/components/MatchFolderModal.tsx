import { useState, useEffect } from 'react';
import { api } from '../api/client';
import StoreSelector from './StoreSelector';

interface SearchResult {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  platforms?: string[];
  genres?: string[];
  totalRating?: number;
  developer?: string;
  publisher?: string;
  gameModes?: string[];
  similarGames?: Array<{
    igdbId: number;
    name: string;
    coverUrl?: string;
  }>;
}

interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  parsedYear?: number;
  matched: boolean;
  gameId?: number;
  path: string;
}

interface MatchFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderMatched: () => void;
  folder: LibraryFolder | null;
}

function MatchFolderModal({ isOpen, onClose, onFolderMatched, folder }: MatchFolderModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  // Pre-fill search with parsed title when folder changes
  useEffect(() => {
    if (folder) {
      setSearchQuery(folder.parsedTitle);
      // Auto-search when opening
      handleAutoSearch(folder.parsedTitle);
    }
  }, [folder]);

  if (!isOpen || !folder) return null;

  const handleAutoSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await api.searchGames(query);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAutoSearch(searchQuery);
  };

  const handleMatchGame = async (game: SearchResult) => {
    setIsMatching(true);
    setError(null);

    try {
      // Pass the full SearchResult directly - library route handles both formats
      // and will store all metadata (summary, genres, rating, developer, etc.)
      const response = await api.matchLibraryFolder(folder.path, folder.folderName, game, selectedStore);

      if (response.success) {
        onFolderMatched();
        onClose();
        setSearchQuery('');
        setSearchResults([]);
      } else {
        setError(response.error || 'Failed to match folder');
      }
    } catch (err) {
      setError('Failed to match folder');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-600" style={{ backgroundColor: 'rgb(17, 24, 39)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600" style={{ backgroundColor: 'rgb(31, 41, 55)' }}>
          <div>
            <h2 className="text-2xl font-bold text-white">Match Library Folder</h2>
            <p className="text-sm text-gray-300 mt-1">
              Folder: <span className="font-mono">{folder.folderName}</span>
            </p>
          </div>
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

          <div className="mt-4">
            <StoreSelector value={selectedStore} onChange={setSelectedStore} label="Digital Store (Optional)" />
            <p className="text-xs text-gray-400 mt-1">
              Select a store if you own this game digitally (game will be marked as already owned).
            </p>
          </div>

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
              {isSearching ? 'Searching...' : 'Search for games to match this folder'}
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

                  {/* Match Button */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleMatchGame(game)}
                      disabled={isMatching}
                      className="px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      style={{ backgroundColor: 'rgb(22, 163, 74)' }}
                      onMouseEnter={(e) => !isMatching && (e.currentTarget.style.backgroundColor = 'rgb(21, 128, 61)')}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(22, 163, 74)'}
                    >
                      {isMatching ? 'Matching...' : 'Match'}
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

export default MatchFolderModal;
