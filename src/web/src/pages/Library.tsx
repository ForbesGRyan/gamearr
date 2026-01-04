import { useState, useEffect } from 'react';
import GameCard from '../components/GameCard';
import AddGameModal from '../components/AddGameModal';
import SearchReleasesModal from '../components/SearchReleasesModal';
import MatchFolderModal from '../components/MatchFolderModal';
import EditGameModal from '../components/EditGameModal';
import StoreSelector from '../components/StoreSelector';
import { api } from '../api/client';

interface Game {
  id: number;
  title: string;
  year?: number;
  coverUrl?: string;
  monitored: boolean;
  status: 'wanted' | 'downloading' | 'downloaded';
  platform: string;
  store?: string | null;
}

interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  parsedYear?: number;
  matched: boolean;
  gameId?: number;
  path: string;
}

interface AutoMatchSuggestion {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  platforms?: string[];
}

type Tab = 'games' | 'scan';

function Library() {
  const [activeTab, setActiveTab] = useState<Tab>('games');
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<LibraryFolder | null>(null);
  const [isScanLoaded, setIsScanLoaded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState<Game | null>(null);
  const [autoMatchSuggestions, setAutoMatchSuggestions] = useState<Record<string, AutoMatchSuggestion>>({});
  const [isAutoMatching, setIsAutoMatching] = useState<Record<string, boolean>>({});
  const [selectedStore, setSelectedStore] = useState<Record<string, string | null>>({});

  const loadGames = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getGames();

      if (response.success && response.data) {
        setGames(response.data as Game[]);
      } else {
        setError(response.error || 'Failed to load games');
      }
    } catch (err) {
      setError('Failed to load games');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  // Load cached scan when switching to scan tab
  useEffect(() => {
    if (activeTab === 'scan') {
      loadCachedScan();
    }
  }, [activeTab]);

  const handleToggleMonitor = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/games/${id}/toggle-monitor`, {
        method: 'POST',
      });

      if (response.ok) {
        loadGames(); // Reload games
      }
    } catch (err) {
      console.error('Failed to toggle monitor:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await api.deleteGame(id);

      if (response.success) {
        loadGames(); // Reload games
      }
    } catch (err) {
      console.error('Failed to delete game:', err);
    }
  };

  const handleSearch = (game: Game) => {
    setSelectedGame(game);
    setIsSearchModalOpen(true);
  };

  const loadCachedScan = async () => {
    if (isScanLoaded) return; // Only load once

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/library/scan');
      const data = await response.json();

      if (data.success && data.data) {
        const { folders } = data.data;
        setLibraryFolders(folders);
        setIsScanLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load cached scan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanLibrary = async () => {
    setIsScanning(true);
    setScanMessage(null);
    setError(null);

    try {
      const response = await api.scanLibrary();

      if (response.success && response.data) {
        const { count, matchedCount, unmatchedCount, folders } = response.data as {
          count: number;
          matchedCount: number;
          unmatchedCount: number;
          folders: LibraryFolder[];
        };

        setLibraryFolders(folders);
        setIsScanLoaded(true);
        setScanMessage(
          `Scanned ${count} folder${count !== 1 ? 's' : ''} (${matchedCount} matched, ${unmatchedCount} unmatched)`
        );

        setTimeout(() => setScanMessage(null), 5000);
      } else {
        setError(response.error || 'Library scan failed');
      }
    } catch (err) {
      setError('Failed to scan library. Check that library path is configured in Settings.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleMatchFolder = (folder: LibraryFolder) => {
    setSelectedFolder(folder);
    setIsMatchModalOpen(true);
  };

  const handleFolderMatched = () => {
    // Reload games and re-scan library
    loadGames();
    handleScanLibrary();
  };

  const handleIgnoreFolder = async (folderPath: string) => {
    try {
      const response = await fetch('/api/v1/library/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });

      const data = await response.json();

      if (data.success) {
        // Remove folder from list
        setLibraryFolders((prev) => prev.filter((f) => f.path !== folderPath));
        setScanMessage('Folder ignored successfully');
        setTimeout(() => setScanMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to ignore folder');
      }
    } catch (err) {
      setError('Failed to ignore folder');
    }
  };

  const handleEdit = (game: Game) => {
    setSelectedGameForEdit(game);
    setIsEditModalOpen(true);
  };

  const handleAutoMatch = async (folder: LibraryFolder) => {
    setIsAutoMatching((prev) => ({ ...prev, [folder.path]: true }));
    setError(null);

    try {
      const response = await api.autoMatchFolder(folder.parsedTitle, folder.parsedYear);

      if (response.success && response.data) {
        setAutoMatchSuggestions((prev) => ({
          ...prev,
          [folder.path]: response.data as AutoMatchSuggestion,
        }));
      } else {
        setError(response.error || 'Failed to auto-match folder');
      }
    } catch (err) {
      setError('Failed to auto-match folder');
    } finally {
      setIsAutoMatching((prev) => ({ ...prev, [folder.path]: false }));
    }
  };

  const handleConfirmAutoMatch = async (folder: LibraryFolder) => {
    const suggestion = autoMatchSuggestions[folder.path];
    if (!suggestion) return;

    try {
      // Convert suggestion to IGDB game format
      const igdbGame = {
        id: suggestion.igdbId,
        name: suggestion.title,
        first_release_date: suggestion.year
          ? new Date(`${suggestion.year}-01-01`).getTime() / 1000
          : null,
        cover: suggestion.coverUrl ? { url: suggestion.coverUrl } : null,
        platforms: suggestion.platforms ? suggestion.platforms.map((p) => ({ name: p })) : [],
      };

      const response = await api.matchLibraryFolder(
        folder.path,
        folder.folderName,
        igdbGame,
        selectedStore[folder.path] || null
      );

      if (response.success) {
        // Remove from suggestions
        setAutoMatchSuggestions((prev) => {
          const newSuggestions = { ...prev };
          delete newSuggestions[folder.path];
          return newSuggestions;
        });

        // Remove from library folders list
        setLibraryFolders((prev) => prev.filter((f) => f.path !== folder.path));

        setScanMessage(`Successfully matched "${folder.folderName}" to ${suggestion.title}`);
        setTimeout(() => setScanMessage(null), 5000);

        // Reload games
        loadGames();
      } else {
        setError(response.error || 'Failed to match folder');
      }
    } catch (err) {
      setError('Failed to match folder');
    }
  };

  const handleCancelAutoMatch = (folder: LibraryFolder) => {
    setAutoMatchSuggestions((prev) => {
      const newSuggestions = { ...prev };
      delete newSuggestions[folder.path];
      return newSuggestions;
    });
  };

  const handleEditAutoMatch = (folder: LibraryFolder) => {
    handleMatchFolder(folder);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Library</h2>
          <p className="text-gray-400 mt-1">
            {games.length} {games.length === 1 ? 'game' : 'games'} in library
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'games' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
            >
              Add Game
            </button>
          )}
          {activeTab === 'scan' && (
            <button
              onClick={handleScanLibrary}
              disabled={isScanning}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScanning ? 'Scanning...' : 'Refresh Scan'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2 border-b-2 transition ${
              activeTab === 'games'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            Games
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-4 py-2 border-b-2 transition ${
              activeTab === 'scan'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            Import
            {libraryFolders.length > 0 && (
              <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {libraryFolders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="mb-6 p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded text-green-200">
          {scanMessage}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}

      {/* Games Tab */}
      {activeTab === 'games' && (
        <>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">Loading games...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">
                No games in your library yet. Click "Add Game" to get started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {games.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onToggleMonitor={handleToggleMonitor}
                  onDelete={handleDelete}
                  onSearch={handleSearch}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Library Scan Tab */}
      {activeTab === 'scan' && (
        <>
          {!isScanLoaded ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg mb-4">
                Scan your library to find and import unmatched game folders.
              </p>
              <button
                onClick={handleScanLibrary}
                disabled={isScanning}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded transition disabled:opacity-50"
              >
                {isScanning ? 'Scanning...' : 'Scan Library Now'}
              </button>
            </div>
          ) : libraryFolders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">
                No unmatched folders found. All folders have been imported or ignored!
              </p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">
                Folders to Import ({libraryFolders.length})
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                These folders aren't linked to any games yet. Click "Match" to search and link each
                folder to a game, or "Ignore" to hide it.
              </p>
              <div className="space-y-3">
                {libraryFolders.map((folder) => {
                  const suggestion = autoMatchSuggestions[folder.path];
                  const isMatching = isAutoMatching[folder.path];

                  return (
                    <div key={folder.path} className="bg-gray-700 rounded p-4">
                      {/* Folder Info */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{folder.folderName}</div>
                          <div className="text-sm text-gray-400">
                            Parsed: {folder.parsedTitle}
                            {folder.parsedYear && ` (${folder.parsedYear})`}
                          </div>
                        </div>
                        {!suggestion && (
                          <div className="flex gap-2">
                            <button
                              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleAutoMatch(folder)}
                              disabled={isMatching}
                            >
                              {isMatching ? 'Searching...' : 'Auto Match'}
                            </button>
                            <button
                              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm"
                              onClick={() => handleMatchFolder(folder)}
                            >
                              Manual Match
                            </button>
                            <button
                              className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition text-sm"
                              onClick={() => handleIgnoreFolder(folder.path)}
                            >
                              Ignore
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Auto-Match Suggestion Card */}
                      {suggestion && (
                        <div className="mt-4 p-4 bg-gray-800 rounded border border-green-600">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-20 h-28 rounded flex-shrink-0 bg-gray-700">
                              {suggestion.coverUrl ? (
                                <img
                                  src={suggestion.coverUrl}
                                  alt={suggestion.title}
                                  className="w-full h-full object-cover rounded"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                                  🎮
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-green-400 text-sm font-medium mb-1">
                                Suggested Match
                              </div>
                              <h4 className="font-semibold text-lg">
                                {suggestion.title}
                                {suggestion.year && (
                                  <span className="text-gray-400 ml-2">({suggestion.year})</span>
                                )}
                              </h4>
                              {suggestion.platforms && (
                                <p className="text-sm text-gray-400 mt-1">
                                  {suggestion.platforms.slice(0, 3).join(', ')}
                                </p>
                              )}
                              {suggestion.summary && (
                                <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                                  {suggestion.summary}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mb-4">
                            <StoreSelector
                              value={selectedStore[folder.path] || null}
                              onChange={(store) =>
                                setSelectedStore((prev) => ({ ...prev, [folder.path]: store }))
                              }
                              label="Digital Store (Optional)"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              Select a store if you own this game digitally.
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm flex-1"
                              onClick={() => handleConfirmAutoMatch(folder)}
                            >
                              Confirm Match
                            </button>
                            <button
                              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm"
                              onClick={() => handleEditAutoMatch(folder)}
                            >
                              Edit Match
                            </button>
                            <button
                              className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition text-sm"
                              onClick={() => handleCancelAutoMatch(folder)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <AddGameModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGameAdded={loadGames}
      />

      <SearchReleasesModal
        isOpen={isSearchModalOpen}
        onClose={() => {
          setIsSearchModalOpen(false);
          setSelectedGame(null);
        }}
        game={selectedGame}
      />

      <MatchFolderModal
        isOpen={isMatchModalOpen}
        onClose={() => {
          setIsMatchModalOpen(false);
          setSelectedFolder(null);
        }}
        onFolderMatched={handleFolderMatched}
        folder={selectedFolder}
      />

      <EditGameModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedGameForEdit(null);
        }}
        onGameUpdated={loadGames}
        game={selectedGameForEdit}
      />
    </div>
  );
}

export default Library;
