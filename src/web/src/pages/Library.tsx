import { useState, useEffect } from 'react';
import GameCard from '../components/GameCard';
import AddGameModal from '../components/AddGameModal';
import SearchReleasesModal from '../components/SearchReleasesModal';
import MatchFolderModal from '../components/MatchFolderModal';
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

interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  parsedYear?: number;
  matched: boolean;
  gameId?: number;
  path: string;
}

function Library() {
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
        setScanMessage(
          `Found ${count} folder${count !== 1 ? 's' : ''} (${matchedCount} matched, ${unmatchedCount} unmatched)`
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Game Library</h2>
          <p className="text-gray-400 mt-1">
            {games.length} {games.length === 1 ? 'game' : 'games'} in library
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScanLibrary}
            disabled={isScanning}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? 'Scanning...' : 'Scan Library'}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
          >
            Add Game
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

      {libraryFolders.filter((f) => !f.matched).length > 0 && (
        <div className="mb-6 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">
            Unmatched Folders ({libraryFolders.filter((f) => !f.matched).length})
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            These folders were found in your library but aren't linked to any games yet. Click "Match"
            to search and link each folder to a game.
          </p>
          <div className="space-y-3">
            {libraryFolders
              .filter((f) => !f.matched)
              .map((folder) => (
                <div
                  key={folder.folderName}
                  className="bg-gray-700 rounded p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{folder.folderName}</div>
                    <div className="text-sm text-gray-400">
                      Parsed: {folder.parsedTitle}
                      {folder.parsedYear && ` (${folder.parsedYear})`}
                    </div>
                  </div>
                  <button
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm"
                    onClick={() => handleMatchFolder(folder)}
                  >
                    Match
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

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
            />
          ))}
        </div>
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
    </div>
  );
}

export default Library;
