import { useState, useEffect } from 'react';
import { api, Library } from '../api/client';
import StoreSelector from './StoreSelector';
import { CloseIcon, GamepadIcon } from './Icons';

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
  libraryName?: string;
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
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<number, string>>({});
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);

  // Load libraries on mount
  useEffect(() => {
    const loadLibraries = async () => {
      const response = await api.getLibraries();
      if (response.success && response.data) {
        setLibraries(response.data);
      }
    };
    if (isOpen) {
      loadLibraries();
    }
  }, [isOpen]);

  // Pre-fill search with parsed title when folder changes
  useEffect(() => {
    if (folder) {
      setSearchQuery(folder.parsedTitle);
      setSelectedPlatforms({});
      setSelectedLibraryId(null);
      // Auto-search when opening
      handleAutoSearch(folder.parsedTitle);
    }
  }, [folder]);

  // Auto-select library based on folder's library name
  useEffect(() => {
    if (folder?.libraryName && libraries.length > 0) {
      const matchingLibrary = libraries.find(
        lib => lib.name.toLowerCase() === folder.libraryName?.toLowerCase()
      );
      if (matchingLibrary) {
        setSelectedLibraryId(matchingLibrary.id);
      }
    }
  }, [folder, libraries]);

  // Initialize platform selection for search results (default to PC if available)
  useEffect(() => {
    const newSelections: Record<number, string> = {};
    for (const game of searchResults) {
      if (game.platforms && game.platforms.length > 0) {
        // Default to PC if available, otherwise first platform
        const pcPlatform = game.platforms.find(p =>
          p.toLowerCase().includes('pc') || p.toLowerCase().includes('windows')
        );
        newSelections[game.igdbId] = pcPlatform || game.platforms[0];
      }
    }
    setSelectedPlatforms(prev => ({ ...prev, ...newSelections }));
  }, [searchResults]);

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
      // Get selected platform for this game
      const platform = selectedPlatforms[game.igdbId] || game.platforms?.[0] || 'PC';

      // Pass the full SearchResult with selected platform
      const gameWithPlatform = {
        ...game,
        platforms: [platform], // Override with selected platform
      };

      const response = await api.matchLibraryFolder(folder.path, folder.folderName, gameWithPlatform, selectedStore, selectedLibraryId);

      if (response.success) {
        onFolderMatched();
        onClose();
        setSearchQuery('');
        setSearchResults([]);
        setSelectedPlatforms({});
        setSelectedLibraryId(null);
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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 md:p-4">
      <div className="fixed inset-0 md:inset-auto md:relative md:max-w-4xl md:max-h-[90vh] w-full h-full md:w-auto md:h-auto bg-gray-900 md:rounded-lg flex flex-col shadow-2xl border-0 md:border border-gray-600">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-gray-700 flex items-center justify-between p-4 md:p-6 border-b border-gray-600 md:rounded-t-lg flex-shrink-0 z-10">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">Match Library Folder</h2>
            <p className="text-sm text-gray-300 mt-1 truncate" title={folder.path}>
              <span className="font-mono">{folder.path}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Form */}
          <div className="p-4 md:p-6 border-b border-gray-600">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a game..."
                className="bg-gray-600 flex-1 px-4 py-2 min-h-[44px] rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 min-h-[44px] rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="mt-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <StoreSelector value={selectedStore} onChange={setSelectedStore} label="Digital Store (Optional)" />
                <p className="text-xs text-gray-400 mt-1">
                  Select a store if you own this game digitally.
                </p>
              </div>
              {libraries.length > 0 && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Add to Library
                  </label>
                  <select
                    value={selectedLibraryId || ''}
                    onChange={(e) => setSelectedLibraryId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-gray-600 border border-gray-600 rounded px-4 py-2 min-h-[44px] text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">No Library (General)</option>
                    {libraries.map((lib) => (
                      <option key={lib.id} value={lib.id}>
                        {lib.name} {lib.platform ? `(${lib.platform})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Organize this game into a library.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-900 mt-3 p-3 border border-red-700 rounded text-red-200 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Search Results */}
          <div className="p-4 md:p-6">
            {searchResults.length === 0 ? (
              <div className="text-center text-gray-200 py-12">
                {isSearching ? 'Searching...' : 'Search for games to match this folder'}
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((game) => (
                  <div
                    key={game.igdbId}
                    className="bg-gray-600 hover:bg-gray-500 flex gap-4 rounded-lg p-4 transition border border-gray-600"
                  >
                    {/* Cover */}
                    <div className="bg-gray-500 w-16 h-22 md:w-20 md:h-28 rounded flex-shrink-0">
                      {game.coverUrl ? (
                        <img
                          src={game.coverUrl}
                          alt={game.title}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <GamepadIcon className="w-8 h-8" />
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
                      {game.platforms && game.platforms.length > 1 ? (
                        <div className="mt-1">
                          <select
                            value={selectedPlatforms[game.igdbId] || game.platforms[0]}
                            onChange={(e) => setSelectedPlatforms(prev => ({
                              ...prev,
                              [game.igdbId]: e.target.value
                            }))}
                            className="bg-gray-700 text-sm text-gray-200 border border-gray-600 rounded px-2 py-1 min-h-[44px] focus:outline-none focus:border-blue-500"
                          >
                            {game.platforms.map((platform) => (
                              <option key={platform} value={platform}>
                                {platform}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : game.platforms && (
                        <p className="text-sm text-gray-300 mt-1">
                          {game.platforms[0]}
                        </p>
                      )}
                      {game.summary && (
                        <p className="text-sm text-gray-200 mt-2 line-clamp-2 hidden md:block">
                          {game.summary}
                        </p>
                      )}
                    </div>

                    {/* Match Button */}
                    <div className="flex-shrink-0 flex items-center">
                      <button
                        onClick={() => handleMatchGame(game)}
                        disabled={isMatching}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 min-h-[44px] rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
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

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full md:w-auto bg-gray-600 hover:bg-gray-500 px-4 py-2 min-h-[44px] rounded transition text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default MatchFolderModal;
