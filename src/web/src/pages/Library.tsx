import { useState, useEffect } from 'react';
import GameCard from '../components/GameCard';
import AddGameModal from '../components/AddGameModal';
import SearchReleasesModal from '../components/SearchReleasesModal';
import MatchFolderModal from '../components/MatchFolderModal';
import EditGameModal from '../components/EditGameModal';
import StoreSelector from '../components/StoreSelector';
import StoreIcon from '../components/StoreIcon';
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
  // Metadata fields
  summary?: string | null;
  genres?: string | null; // JSON string array
  totalRating?: number | null;
  developer?: string | null;
  publisher?: string | null;
  gameModes?: string | null; // JSON string array
  similarGames?: string | null; // JSON array of {igdbId, name, coverUrl}
  // Update tracking fields
  updateAvailable?: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
  updatePolicy?: 'notify' | 'auto' | 'ignore';
}

interface SimilarGame {
  igdbId: number;
  name: string;
  coverUrl?: string;
}

interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  cleanedTitle: string;
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
  // Extended metadata
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

interface LooseFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: number;
}

interface DuplicateGameInfo {
  id: number;
  title: string;
  year?: number;
  status: string;
  folderPath?: string;
  size?: number;
}

interface DuplicateGroup {
  games: DuplicateGameInfo[];
  similarity: number;
}

type Tab = 'games' | 'scan' | 'health';
type ViewMode = 'posters' | 'table' | 'overview';
type SortColumn = 'title' | 'year' | 'rating' | 'developer' | 'store' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'wanted' | 'downloading' | 'downloaded';
type MonitoredFilter = 'all' | 'monitored' | 'unmonitored';

interface Filters {
  status: StatusFilter;
  monitored: MonitoredFilter;
  genres: string[];
  gameModes: string[];
}

function Library() {
  const [activeTab, setActiveTab] = useState<Tab>('games');
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('library-view-mode');
    return (saved as ViewMode) || 'posters';
  });
  const [sortColumn, setSortColumn] = useState<SortColumn>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    monitored: 'all',
    genres: [],
    gameModes: [],
  });
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

  // Health tab state
  const [looseFiles, setLooseFiles] = useState<LooseFile[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isHealthLoaded, setIsHealthLoaded] = useState(false);
  const [organizingFile, setOrganizingFile] = useState<string | null>(null);
  const [dismissedDuplicates, setDismissedDuplicates] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dismissed-duplicates');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('library-view-mode', mode);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedGames = (gamesToSort: Game[] = games) => {
    return [...gamesToSort].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'title':
          comparison = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
          break;
        case 'year':
          comparison = (a.year || 0) - (b.year || 0);
          break;
        case 'rating':
          comparison = (a.totalRating || 0) - (b.totalRating || 0);
          break;
        case 'developer':
          comparison = (a.developer || '').localeCompare(b.developer || '', undefined, { sensitivity: 'base' });
          break;
        case 'store':
          comparison = (a.store || '').localeCompare(b.store || '', undefined, { sensitivity: 'base' });
          break;
        case 'status':
          const statusOrder = { wanted: 0, downloading: 1, downloaded: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Extract unique genres and game modes from all games
  const getAllGenres = (): string[] => {
    const genreSet = new Set<string>();
    games.forEach((game) => {
      if (game.genres) {
        try {
          const parsed = JSON.parse(game.genres) as string[];
          parsed.forEach((g) => genreSet.add(g));
        } catch {
          // ignore parse errors
        }
      }
    });
    return Array.from(genreSet).sort();
  };

  const getAllGameModes = (): string[] => {
    const modeSet = new Set<string>();
    games.forEach((game) => {
      if (game.gameModes) {
        try {
          const parsed = JSON.parse(game.gameModes) as string[];
          parsed.forEach((m) => modeSet.add(m));
        } catch {
          // ignore parse errors
        }
      }
    });
    return Array.from(modeSet).sort();
  };

  // Get filtered and sorted games
  const getFilteredAndSortedGames = (): Game[] => {
    let filtered = games;

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter((game) => game.status === filters.status);
    }

    // Filter by monitored state
    if (filters.monitored !== 'all') {
      filtered = filtered.filter((game) =>
        filters.monitored === 'monitored' ? game.monitored : !game.monitored
      );
    }

    // Filter by genres
    if (filters.genres.length > 0) {
      filtered = filtered.filter((game) => {
        if (!game.genres) return false;
        try {
          const gameGenres = JSON.parse(game.genres) as string[];
          return filters.genres.some((g) => gameGenres.includes(g));
        } catch {
          return false;
        }
      });
    }

    // Filter by game modes
    if (filters.gameModes.length > 0) {
      filtered = filtered.filter((game) => {
        if (!game.gameModes) return false;
        try {
          const modes = JSON.parse(game.gameModes) as string[];
          return filters.gameModes.some((m) => modes.includes(m));
        } catch {
          return false;
        }
      });
    }

    return getSortedGames(filtered);
  };

  // Count active filters
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.monitored !== 'all') count++;
    count += filters.genres.length;
    count += filters.gameModes.length;
    return count;
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: 'all',
      monitored: 'all',
      genres: [],
      gameModes: [],
    });
  };

  // Toggle a genre filter
  const toggleGenreFilter = (genre: string) => {
    setFilters((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre],
    }));
  };

  // Toggle a game mode filter
  const toggleGameModeFilter = (mode: string) => {
    setFilters((prev) => ({
      ...prev,
      gameModes: prev.gameModes.includes(mode)
        ? prev.gameModes.filter((m) => m !== mode)
        : [...prev.gameModes, mode],
    }));
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <span className="text-gray-500 ml-1">↕</span>;
    }
    return <span className="text-blue-400 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const loadGames = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getGames();

      if (response.success && response.data) {
        // Sort games alphabetically by title
        const sortedGames = (response.data as Game[]).sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        );
        setGames(sortedGames);
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

  // Load scan data when switching to scan tab - always fetch fresh to stay in sync
  useEffect(() => {
    if (activeTab === 'scan') {
      loadScanData();
    }
  }, [activeTab]);

  // Load health data when switching to health tab
  useEffect(() => {
    if (activeTab === 'health' && !isHealthLoaded) {
      loadHealthData();
    }
  }, [activeTab]);

  const loadHealthData = async () => {
    setIsHealthLoading(true);
    try {
      const [duplicatesRes, looseFilesRes] = await Promise.all([
        api.getLibraryDuplicates(),
        api.getLibraryLooseFiles(),
      ]);

      if (duplicatesRes.success && duplicatesRes.data) {
        setDuplicates(duplicatesRes.data as DuplicateGroup[]);
      }

      if (looseFilesRes.success && looseFilesRes.data) {
        setLooseFiles(looseFilesRes.data as LooseFile[]);
      }

      setIsHealthLoaded(true);
    } catch (err) {
      console.error('Failed to load health data:', err);
    } finally {
      setIsHealthLoading(false);
    }
  };

  const handleOrganizeFile = async (filePath: string) => {
    setOrganizingFile(filePath);
    try {
      const response = await api.organizeLooseFile(filePath);
      if (response.success) {
        // Remove the file from the list
        setLooseFiles((prev) => prev.filter((f) => f.path !== filePath));
      } else {
        alert(response.error || 'Failed to organize file');
      }
    } catch (err) {
      console.error('Failed to organize file:', err);
      alert('Failed to organize file');
    } finally {
      setOrganizingFile(null);
    }
  };

  const handleDismissDuplicate = (group: DuplicateGroup) => {
    // Create a key from the game IDs
    const key = group.games.map((g) => g.id).sort().join('-');
    const newDismissed = new Set(dismissedDuplicates);
    newDismissed.add(key);
    setDismissedDuplicates(newDismissed);
    localStorage.setItem('dismissed-duplicates', JSON.stringify([...newDismissed]));
  };

  const getVisibleDuplicates = () => {
    return duplicates.filter((group) => {
      const key = group.games.map((g) => g.id).sort().join('-');
      return !dismissedDuplicates.has(key);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const loadScanData = async () => {
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
      console.error('Failed to load scan data:', err);
      setError('Failed to load library scan data');
    } finally {
      setIsLoading(false);
    }
  };

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
    // Reload games and refresh scan data from server
    loadGames();
    loadScanData();
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
        // Reload scan data from server to ensure consistency
        await loadScanData();
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
      // Pass the full GameSearchResult format directly (includes metadata)
      const response = await api.matchLibraryFolder(
        folder.path,
        folder.folderName,
        suggestion, // Send full suggestion with all metadata
        selectedStore[folder.path] || null
      );

      if (response.success) {
        // Clear suggestion for this folder
        setAutoMatchSuggestions((prev) => {
          const newSuggestions = { ...prev };
          delete newSuggestions[folder.path];
          return newSuggestions;
        });

        setScanMessage(`Successfully matched "${folder.folderName}" to ${suggestion.title}`);
        setTimeout(() => setScanMessage(null), 5000);

        // Reload games and scan data from server to ensure consistency
        loadGames();
        await loadScanData();
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
        <div className="flex gap-4 items-center">
          {/* View Mode Toggle - only show on games tab */}
          {activeTab === 'games' && (
            <div className="flex bg-gray-700 rounded overflow-hidden">
              <button
                onClick={() => handleViewModeChange('table')}
                className={`p-2 transition ${viewMode === 'table' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
                title="Table View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('posters')}
                className={`p-2 transition ${viewMode === 'posters' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
                title="Poster View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('overview')}
                className={`p-2 transition ${viewMode === 'overview' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
                title="Overview"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
            </div>
          )}
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
          {activeTab === 'health' && (
            <button
              onClick={() => {
                setIsHealthLoaded(false);
                loadHealthData();
              }}
              disabled={isHealthLoading}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isHealthLoading ? 'Scanning...' : 'Refresh'}
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
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 border-b-2 transition ${
              activeTab === 'health'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            Health
            {(getVisibleDuplicates().length > 0 || looseFiles.length > 0) && (
              <span className="ml-2 bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full">
                {getVisibleDuplicates().length + looseFiles.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar and Sort Dropdown - only show on games tab when there are games */}
      {activeTab === 'games' && games.length > 0 && (
        <div className="mb-6 bg-gray-800 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort Dropdown - shown for Poster and Overview views */}
            {(viewMode === 'posters' || viewMode === 'overview') && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Sort by:</label>
                <select
                  value={`${sortColumn}-${sortDirection}`}
                  onChange={(e) => {
                    const [col, dir] = e.target.value.split('-') as [SortColumn, SortDirection];
                    setSortColumn(col);
                    setSortDirection(dir);
                  }}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
                  <option value="year-desc">Year (Newest)</option>
                  <option value="year-asc">Year (Oldest)</option>
                  <option value="rating-desc">Rating (Highest)</option>
                  <option value="rating-asc">Rating (Lowest)</option>
                  <option value="developer-asc">Developer (A-Z)</option>
                  <option value="developer-desc">Developer (Z-A)</option>
                  <option value="store-asc">Store (A-Z)</option>
                  <option value="store-desc">Store (Z-A)</option>
                  <option value="status-asc">Status (Wanted first)</option>
                  <option value="status-desc">Status (Downloaded first)</option>
                </select>
              </div>
            )}

            {/* Divider */}
            {(viewMode === 'posters' || viewMode === 'overview') && (
              <div className="h-6 w-px bg-gray-600" />
            )}

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Status:</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as StatusFilter }))}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="wanted">Wanted</option>
                <option value="downloading">Downloading</option>
                <option value="downloaded">Downloaded</option>
              </select>
            </div>

            {/* Monitored Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Monitored:</label>
              <select
                value={filters.monitored}
                onChange={(e) => setFilters((prev) => ({ ...prev, monitored: e.target.value as MonitoredFilter }))}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="monitored">Monitored</option>
                <option value="unmonitored">Unmonitored</option>
              </select>
            </div>

            {/* Genre Filter */}
            {getAllGenres().length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Genres:</label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) toggleGenreFilter(e.target.value);
                    }}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {filters.genres.length > 0 ? `${filters.genres.length} selected` : 'Select...'}
                    </option>
                    {getAllGenres().map((genre) => (
                      <option key={genre} value={genre}>
                        {filters.genres.includes(genre) ? `[x] ${genre}` : genre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Game Modes Filter */}
            {getAllGameModes().length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Modes:</label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) toggleGameModeFilter(e.target.value);
                    }}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {filters.gameModes.length > 0 ? `${filters.gameModes.length} selected` : 'Select...'}
                    </option>
                    {getAllGameModes().map((mode) => (
                      <option key={mode} value={mode}>
                        {filters.gameModes.includes(mode) ? `[x] ${mode}` : mode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Clear Filters Button */}
            {getActiveFilterCount() > 0 && (
              <button
                onClick={clearFilters}
                className="ml-auto text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Filters ({getActiveFilterCount()})
              </button>
            )}
          </div>

          {/* Active Filter Chips */}
          {(filters.genres.length > 0 || filters.gameModes.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700">
              {filters.genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenreFilter(genre)}
                  className="text-xs bg-blue-600 hover:bg-blue-500 px-2.5 py-1 rounded-full flex items-center gap-1 transition"
                >
                  {genre}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {filters.gameModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => toggleGameModeFilter(mode)}
                  className="text-xs bg-purple-600 hover:bg-purple-500 px-2.5 py-1 rounded-full flex items-center gap-1 transition"
                >
                  {mode}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Results Count */}
          {getActiveFilterCount() > 0 && (
            <div className="text-sm text-gray-400 mt-3">
              Showing {getFilteredAndSortedGames().length} of {games.length} games
            </div>
          )}
        </div>
      )}

      {/* Floating error toast notification - doesn't affect page layout */}
      {error && (
        <div className="fixed top-4 left-4 z-50 p-4 bg-red-900 border border-red-700 rounded-lg shadow-lg text-red-200 max-w-md animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Floating toast notification - doesn't affect page layout */}
      {scanMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-900 border border-green-700 rounded-lg shadow-lg text-green-200 max-w-md animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{scanMessage}</span>
          </div>
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
            <>
              {/* Poster View */}
              {viewMode === 'posters' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {getFilteredAndSortedGames().map((game) => (
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

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th
                          className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-600 transition select-none"
                          onClick={() => handleSort('title')}
                        >
                          Title<SortIndicator column="title" />
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium w-20 cursor-pointer hover:bg-gray-600 transition select-none"
                          onClick={() => handleSort('year')}
                        >
                          Year<SortIndicator column="year" />
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium w-20 cursor-pointer hover:bg-gray-600 transition select-none"
                          onClick={() => handleSort('rating')}
                        >
                          Rating<SortIndicator column="rating" />
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium w-32 cursor-pointer hover:bg-gray-600 transition select-none"
                          onClick={() => handleSort('developer')}
                        >
                          Developer<SortIndicator column="developer" />
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium w-24 cursor-pointer hover:bg-gray-600 transition select-none"
                          onClick={() => handleSort('store')}
                        >
                          Store<SortIndicator column="store" />
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium w-28 cursor-pointer hover:bg-gray-600 transition select-none"
                          onClick={() => handleSort('status')}
                        >
                          Status<SortIndicator column="status" />
                        </th>
                        <th className="text-right px-4 py-3 font-medium w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {getFilteredAndSortedGames().map((game) => (
                        <tr key={game.id} className="hover:bg-gray-700/50 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-10 rounded bg-gray-700 flex-shrink-0 overflow-hidden">
                                {game.coverUrl ? (
                                  <img src={game.coverUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">🎮</div>
                                )}
                              </div>
                              <span className="font-medium">{game.title}</span>
                              {game.updateAvailable && (
                                <span className="text-xs bg-orange-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Update
                                </span>
                              )}
                              {!game.monitored && (
                                <span className="text-xs bg-gray-600 px-1.5 py-0.5 rounded">Unmonitored</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{game.year || '—'}</td>
                          <td className="px-4 py-3">
                            {game.totalRating ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                game.totalRating >= 75 ? 'bg-green-600' :
                                game.totalRating >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                              }`}>
                                {game.totalRating}%
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 truncate max-w-[200px]" title={game.developer || ''}>
                            {game.developer || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {game.store ? <StoreIcon store={game.store} /> : <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              game.status === 'downloaded' ? 'bg-green-600' :
                              game.status === 'downloading' ? 'bg-blue-600' : 'bg-yellow-600'
                            }`}>
                              {game.status === 'downloaded' ? 'Downloaded' :
                               game.status === 'downloading' ? 'Downloading' : 'Wanted'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleToggleMonitor(game.id)}
                                className="p-1.5 rounded hover:bg-gray-600 transition"
                                title={game.monitored ? 'Unmonitor' : 'Monitor'}
                              >
                                {game.monitored ? '👁️' : '👁️‍🗨️'}
                              </button>
                              <button
                                onClick={() => handleSearch(game)}
                                className="p-1.5 rounded hover:bg-gray-600 transition"
                                title="Search"
                              >
                                🔍
                              </button>
                              <button
                                onClick={() => handleEdit(game)}
                                className="p-1.5 rounded hover:bg-gray-600 transition"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${game.title}"?`)) {
                                    handleDelete(game.id);
                                  }
                                }}
                                className="p-1.5 rounded hover:bg-red-600 transition"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Overview View */}
              {viewMode === 'overview' && (
                <div className="space-y-4">
                  {getFilteredAndSortedGames().map((game) => {
                    // Parse JSON fields
                    const genres = game.genres ? JSON.parse(game.genres) as string[] : [];
                    const gameModes = game.gameModes ? JSON.parse(game.gameModes) as string[] : [];
                    const similarGames = game.similarGames ? JSON.parse(game.similarGames) as SimilarGame[] : [];

                    return (
                      <div key={game.id} className="bg-gray-800 rounded-lg p-5 hover:ring-1 hover:ring-gray-600 transition">
                        <div className="flex gap-5">
                          {/* Cover & Rating */}
                          <div className="flex-shrink-0">
                            <div className="w-32 h-44 rounded-lg bg-gray-700 overflow-hidden shadow-lg">
                              {game.coverUrl ? (
                                <img src={game.coverUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-3xl">🎮</div>
                              )}
                            </div>
                            {game.totalRating && (
                              <div className="mt-3 text-center">
                                <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold ${
                                  game.totalRating >= 75 ? 'bg-green-600' :
                                  game.totalRating >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                                }`}>
                                  {game.totalRating}%
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            {/* Header Row */}
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-bold text-xl">{game.title}</h3>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                  <span>{game.year || 'Unknown year'}</span>
                                  <span>•</span>
                                  <span>{game.platform}</span>
                                  {game.store && (
                                    <>
                                      <span>•</span>
                                      <StoreIcon store={game.store} />
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {game.updateAvailable && (
                                  <span className="text-xs bg-orange-500 px-2 py-1 rounded flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Update Available
                                  </span>
                                )}
                                {!game.monitored && (
                                  <span className="text-xs bg-gray-600 px-2 py-1 rounded">Unmonitored</span>
                                )}
                                <span className={`px-3 py-1.5 rounded text-sm font-medium ${
                                  game.status === 'downloaded' ? 'bg-green-600' :
                                  game.status === 'downloading' ? 'bg-blue-600' : 'bg-yellow-600'
                                }`}>
                                  {game.status === 'downloaded' ? 'Downloaded' :
                                   game.status === 'downloading' ? 'Downloading' : 'Wanted'}
                                </span>
                              </div>
                            </div>

                            {/* Developer / Publisher */}
                            {(game.developer || game.publisher) && (
                              <div className="flex gap-6 mt-2 text-sm">
                                {game.developer && (
                                  <div>
                                    <span className="text-gray-500">Developer: </span>
                                    <span className="text-gray-300">{game.developer}</span>
                                  </div>
                                )}
                                {game.publisher && game.publisher !== game.developer && (
                                  <div>
                                    <span className="text-gray-500">Publisher: </span>
                                    <span className="text-gray-300">{game.publisher}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Genres & Game Modes */}
                            {(genres.length > 0 || gameModes.length > 0) && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {genres.map((genre) => (
                                  <span key={genre} className="text-xs bg-gray-700 px-2.5 py-1 rounded-full">
                                    {genre}
                                  </span>
                                ))}
                                {gameModes.map((mode) => (
                                  <span key={mode} className="text-xs bg-blue-900 px-2.5 py-1 rounded-full">
                                    {mode}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Description */}
                            {game.summary && (
                              <p className="text-sm text-gray-400 mt-3 leading-relaxed">{game.summary}</p>
                            )}

                            {/* Similar Games */}
                            {similarGames.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-700">
                                <p className="text-xs text-gray-500 mb-2 font-medium">Similar Games</p>
                                <div className="flex gap-3">
                                  {similarGames.slice(0, 6).map((sg) => (
                                    <div
                                      key={sg.igdbId}
                                      className="flex-shrink-0 w-14 group/similar cursor-pointer"
                                      title={sg.name}
                                    >
                                      <div className="w-14 h-20 rounded bg-gray-700 overflow-hidden shadow">
                                        {sg.coverUrl ? (
                                          <img
                                            src={sg.coverUrl}
                                            alt={sg.name}
                                            className="w-full h-full object-cover group-hover/similar:scale-110 transition"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">🎮</div>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-400 mt-1 truncate text-center">{sg.name}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => handleToggleMonitor(game.id)}
                                className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition"
                              >
                                {game.monitored ? '👁️ Unmonitor' : '👁️‍🗨️ Monitor'}
                              </button>
                              <button
                                onClick={() => handleSearch(game)}
                                className="text-sm px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 transition"
                              >
                                🔍 Search
                              </button>
                              <button
                                onClick={() => handleEdit(game)}
                                className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${game.title}"?`)) {
                                    handleDelete(game.id);
                                  }
                                }}
                                className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-red-600 transition"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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
                          <div className="font-medium">
                            {folder.cleanedTitle}
                            {folder.parsedYear && ` (${folder.parsedYear})`}
                          </div>
                          <div className="text-sm text-gray-400">
                            Folder: {folder.folderName}
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

      {/* Health Tab */}
      {activeTab === 'health' && (
        <>
          {isHealthLoading && !isHealthLoaded ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">Scanning library health...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Duplicates Section */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Potential Duplicates
                  {getVisibleDuplicates().length > 0 && (
                    <span className="ml-2 bg-yellow-600 text-white text-sm px-2 py-0.5 rounded-full">
                      {getVisibleDuplicates().length}
                    </span>
                  )}
                </h3>

                {getVisibleDuplicates().length === 0 ? (
                  <p className="text-gray-400">No potential duplicates found. Your library looks clean!</p>
                ) : (
                  <div className="space-y-4">
                    {getVisibleDuplicates().map((group, index) => (
                      <div key={index} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-yellow-400 font-medium">
                            {group.similarity}% similar
                          </span>
                          <button
                            onClick={() => handleDismissDuplicate(group)}
                            className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-gray-600 transition"
                          >
                            Dismiss
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {group.games.map((game) => (
                            <div key={game.id} className="bg-gray-800 rounded p-3">
                              <h4 className="font-medium truncate" title={game.title}>
                                {game.title}
                              </h4>
                              <div className="text-sm text-gray-400 mt-1 space-y-1">
                                {game.year && <p>Year: {game.year}</p>}
                                <p>Status: <span className={`capitalize ${
                                  game.status === 'downloaded' ? 'text-green-400' :
                                  game.status === 'downloading' ? 'text-blue-400' : 'text-yellow-400'
                                }`}>{game.status}</span></p>
                                {game.size !== undefined && (
                                  <p>Size: {formatFileSize(game.size)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Loose Files Section */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Loose Files
                  {looseFiles.length > 0 && (
                    <span className="ml-2 bg-orange-600 text-white text-sm px-2 py-0.5 rounded-full">
                      {looseFiles.length}
                    </span>
                  )}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  These archive and ISO files are sitting directly in your library folder.
                  Click "Organize" to create a folder and move the file into it.
                </p>

                {looseFiles.length === 0 ? (
                  <p className="text-gray-400">No loose files found. Your library is well organized!</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-3 pr-4">Name</th>
                          <th className="pb-3 pr-4">Size</th>
                          <th className="pb-3 pr-4">Type</th>
                          <th className="pb-3 pr-4">Modified</th>
                          <th className="pb-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {looseFiles.map((file) => (
                          <tr key={file.path} className="border-b border-gray-700 hover:bg-gray-750">
                            <td className="py-3 pr-4">
                              <span className="font-medium truncate block max-w-md" title={file.name}>
                                {file.name}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-400">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="uppercase text-xs bg-gray-600 px-2 py-1 rounded">
                                {file.extension.replace('.', '')}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-400">
                              {formatDate(file.modifiedAt)}
                            </td>
                            <td className="py-3">
                              <button
                                onClick={() => handleOrganizeFile(file.path)}
                                disabled={organizingFile === file.path}
                                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition disabled:opacity-50"
                              >
                                {organizingFile === file.path ? 'Organizing...' : 'Organize'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
