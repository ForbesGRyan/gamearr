import { useState, useEffect, useMemo, useCallback } from 'react';
import GameCard from '../components/GameCard';
import AddGameModal from '../components/AddGameModal';
import SearchReleasesModal from '../components/SearchReleasesModal';
import MatchFolderModal from '../components/MatchFolderModal';
import EditGameModal from '../components/EditGameModal';
import ConfirmModal from '../components/ConfirmModal';
import StoreIcon from '../components/StoreIcon';
import StoreSelector from '../components/StoreSelector';
import { api, SteamGame } from '../api/client';
import { EyeIcon, EyeSlashIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, GamepadIcon } from '../components/Icons';
import { formatBytes, formatTimestamp } from '../utils/formatters';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

// Import library-specific components
import {
  LibraryFilterBar,
  LibraryPagination,
  BulkActionToolbar,
  SteamImportModal,
  LibraryHealthTab,
  LibraryScanTab,
} from '../components/library';
import type {
  Game,
  SimilarGame,
  LibraryFolder,
  AutoMatchSuggestion,
  LooseFile,
  DuplicateGroup,
  ViewMode,
  SortColumn,
  SortDirection,
  Filters,
  LibraryInfo,
} from '../components/library';

type Tab = 'games' | 'scan' | 'health';

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
    libraryId: 'all',
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
  const [looseFileSortColumn, setLooseFileSortColumn] = useState<'name' | 'size' | 'type' | 'modified'>('name');
  const [looseFileSortDirection, setLooseFileSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sorted loose files
  const sortedLooseFiles = useMemo(() => {
    return [...looseFiles].sort((a, b) => {
      let comparison = 0;
      switch (looseFileSortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.extension.localeCompare(b.extension);
          break;
        case 'modified':
          comparison = a.modifiedAt - b.modifiedAt;
          break;
      }
      return looseFileSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [looseFiles, looseFileSortColumn, looseFileSortDirection]);

  const handleLooseFileSort = (column: 'name' | 'size' | 'type' | 'modified') => {
    if (looseFileSortColumn === column) {
      setLooseFileSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLooseFileSortColumn(column);
      setLooseFileSortDirection('asc');
    }
  };

  // Delete confirmation modal state
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [organizeError, setOrganizeError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection state
  const [selectedGameIds, setSelectedGameIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('library-page-size');
    return saved ? parseInt(saved, 10) : 25;
  });

  // Steam import state
  const [isSteamModalOpen, setIsSteamModalOpen] = useState(false);
  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [isLoadingSteam, setIsLoadingSteam] = useState(false);
  const [steamError, setSteamError] = useState<string | null>(null);
  const [selectedSteamGames, setSelectedSteamGames] = useState<Set<number>>(new Set());
  const [isImportingSteam, setIsImportingSteam] = useState(false);
  const [steamImportProgress, setSteamImportProgress] = useState({ current: 0, total: 0, currentGame: '' });
  // Steam filter state
  const [steamSearchQuery, setSteamSearchQuery] = useState('');
  const [steamMinPlaytime, setSteamMinPlaytime] = useState<number>(0); // in hours
  const [steamShowOwned, setSteamShowOwned] = useState(true); // show already in library

  // Libraries state
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);

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
        case 'monitored':
          comparison = (a.monitored === b.monitored) ? 0 : (a.monitored ? -1 : 1);
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

  // Extract unique genres and game modes from all games (memoized)
  const allGenres = useMemo((): string[] => {
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
  }, [games]);

  const allGameModes = useMemo((): string[] => {
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
  }, [games]);

  // Get filtered and sorted games (memoized)
  const filteredAndSortedGames = useMemo((): Game[] => {
    let filtered = games;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((game) => {
        // Search in title
        if (game.title.toLowerCase().includes(query)) return true;
        // Search in developer
        if (game.developer?.toLowerCase().includes(query)) return true;
        // Search in publisher
        if (game.publisher?.toLowerCase().includes(query)) return true;
        // Search in genres
        if (game.genres) {
          try {
            const genres = JSON.parse(game.genres) as string[];
            if (genres.some(g => g.toLowerCase().includes(query))) return true;
          } catch {}
        }
        return false;
      });
    }

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

    // Filter by library
    if (filters.libraryId !== 'all') {
      filtered = filtered.filter((game) => game.libraryId === filters.libraryId);
    }

    return getSortedGames(filtered);
  }, [games, searchQuery, filters, sortColumn, sortDirection]);

  // Keep backward-compatible function names for existing code
  const getAllGenres = () => allGenres;
  const getAllGameModes = () => allGameModes;
  const getFilteredAndSortedGames = () => filteredAndSortedGames;

  // Get paginated games (memoized)
  const paginatedGames = useMemo((): Game[] => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedGames.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedGames, currentPage, pageSize]);

  // Keep backward-compatible function name for existing code
  const getPaginatedGames = () => paginatedGames;

  // Get total pages (memoized)
  const totalPages = useMemo((): number => {
    return Math.ceil(filteredAndSortedGames.length / pageSize);
  }, [filteredAndSortedGames.length, pageSize]);

  // Keep backward-compatible function name for existing code
  const getTotalPages = () => totalPages;

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    localStorage.setItem('library-page-size', newSize.toString());
  };

  // Reset to page 1 when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Count active filters (memoized)
  const activeFilterCount = useMemo((): number => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (filters.status !== 'all') count++;
    if (filters.monitored !== 'all') count++;
    if (filters.libraryId !== 'all') count++;
    count += filters.genres.length;
    count += filters.gameModes.length;
    return count;
  }, [searchQuery, filters]);

  // Keep backward-compatible function name for existing code
  const getActiveFilterCount = () => activeFilterCount;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      status: 'all',
      monitored: 'all',
      genres: [],
      gameModes: [],
      libraryId: 'all',
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

  // Bulk selection helpers
  const toggleGameSelection = useCallback((gameId: number) => {
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  }, []);

  const selectAllGames = () => {
    const filteredGames = getFilteredAndSortedGames();
    setSelectedGameIds(new Set(filteredGames.map((g) => g.id)));
  };

  const clearSelection = () => {
    setSelectedGameIds(new Set());
  };

  const isAllSelected = () => {
    const filteredGames = getFilteredAndSortedGames();
    return filteredGames.length > 0 && filteredGames.every((g) => selectedGameIds.has(g.id));
  };

  const isSomeSelected = () => {
    const filteredGames = getFilteredAndSortedGames();
    return filteredGames.some((g) => selectedGameIds.has(g.id)) && !isAllSelected();
  };

  // Bulk action handlers
  const handleBulkMonitor = async (monitor: boolean) => {
    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedGameIds).map((id) =>
        api.updateGame(id, { monitored: monitor })
      );
      await Promise.all(promises);
      await loadGames();
      clearSelection();
    } catch (err) {
      console.error('Failed to update games:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedGameIds).map((id) => api.deleteGame(id));
      await Promise.all(promises);
      await loadGames();
      clearSelection();
    } catch (err) {
      console.error('Failed to delete games:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Steam import handlers
  const handleOpenSteamImport = async () => {
    setIsSteamModalOpen(true);
    setIsLoadingSteam(true);
    setSteamError(null);
    setSelectedSteamGames(new Set());

    try {
      const response = await api.getSteamOwnedGames();
      if (response.success && response.data) {
        setSteamGames(response.data);
      } else {
        setSteamError(response.error || 'Failed to load Steam games');
      }
    } catch (err) {
      setSteamError('Failed to connect to Steam');
    } finally {
      setIsLoadingSteam(false);
    }
  };

  const handleToggleSteamGame = (appId: number) => {
    setSelectedSteamGames((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  // Filter Steam games based on search, playtime, and owned status (memoized)
  const filteredSteamGames = useMemo(() => {
    return steamGames.filter((game) => {
      // Search filter
      if (steamSearchQuery.trim()) {
        const query = steamSearchQuery.toLowerCase();
        if (!game.name.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Playtime filter (convert minutes to hours)
      const playtimeHours = game.playtimeMinutes / 60;
      if (playtimeHours < steamMinPlaytime) {
        return false;
      }
      // Show owned filter
      if (!steamShowOwned && game.alreadyInLibrary) {
        return false;
      }
      return true;
    });
  }, [steamGames, steamSearchQuery, steamMinPlaytime, steamShowOwned]);

  const handleSelectAllSteamGames = () => {
    const importableGames = filteredSteamGames.filter((g) => !g.alreadyInLibrary);
    setSelectedSteamGames(new Set(importableGames.map((g) => g.appId)));
  };

  const handleImportSteamGames = async () => {
    if (selectedSteamGames.size === 0) return;

    setIsImportingSteam(true);
    const appIds = Array.from(selectedSteamGames);
    const total = appIds.length;

    setSteamImportProgress({ current: 0, total, currentGame: 'Starting import...' });

    try {
      // Use streaming import with progress updates
      await api.importSteamGamesStream(
        appIds,
        // Progress callback - receives game-by-game updates
        (data) => {
          const statusText = data.status === 'searching' ? 'Searching...' :
            data.status === 'imported' ? 'Imported' :
            data.status === 'skipped' ? 'Skipped' : 'Error';
          setSteamImportProgress({
            current: data.current,
            total: data.total,
            currentGame: `${data.game} (${statusText})`,
          });
        },
        // Complete callback
        async (result) => {
          // Update the steam games list to mark imported ones
          setSteamGames(prev => prev.map(g =>
            appIds.includes(g.appId) ? { ...g, alreadyInLibrary: true } : g
          ));

          // Clear selection and reload library
          setSelectedSteamGames(new Set());
          await loadGames();

          // Show summary with full error list
          const summary = `Imported ${result.imported}, skipped ${result.skipped}.`;
          const errorList = result.errors?.length ? `\n${result.errors.join('\n')}` : '';
          if (result.imported > 0 || result.skipped > 0 || result.errors?.length) {
            setSteamError(summary + errorList);
          }

          setIsImportingSteam(false);
          setSteamImportProgress({ current: 0, total: 0, currentGame: '' });
        },
        // Error callback
        (message) => {
          setSteamError(message);
          setIsImportingSteam(false);
          setSteamImportProgress({ current: 0, total: 0, currentGame: '' });
        }
      );
    } catch (err) {
      setSteamError('Failed to import games');
      setIsImportingSteam(false);
      setSteamImportProgress({ current: 0, total: 0, currentGame: '' });
    }
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

  const loadLibraries = async () => {
    try {
      const response = await api.getLibraries();
      if (response.success && response.data) {
        setLibraries(response.data.map(lib => ({
          id: lib.id,
          name: lib.name,
          platform: lib.platform,
        })));
      }
    } catch (err) {
      console.error('Failed to load libraries:', err);
    }
  };

  useEffect(() => {
    loadGames();
    loadLibraries();
    // Load scan and health data in background for badge counts
    loadScanData();
    loadHealthData();
  }, []);

  // Refresh scan data when switching to scan tab
  useEffect(() => {
    if (activeTab === 'scan') {
      loadScanData();
    }
  }, [activeTab]);

  // Refresh health data when switching to health tab
  useEffect(() => {
    if (activeTab === 'health') {
      loadHealthData();
    }
  }, [activeTab]);

  // Reset pagination when filters/search/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sortColumn, sortDirection]);

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
    setOrganizeError(null);
    try {
      const response = await api.organizeLooseFile(filePath);
      if (response.success) {
        // Remove the file from the list
        setLooseFiles((prev) => prev.filter((f) => f.path !== filePath));
      } else {
        setOrganizeError(response.error || 'Failed to organize file');
      }
    } catch (err) {
      console.error('Failed to organize file:', err);
      setOrganizeError('Failed to organize file');
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

  // Visible duplicates (memoized)
  const visibleDuplicates = useMemo(() => {
    return duplicates.filter((group) => {
      const key = group.games.map((g) => g.id).sort().join('-');
      return !dismissedDuplicates.has(key);
    });
  }, [duplicates, dismissedDuplicates]);

  // Keep backward-compatible function name for existing code
  const getVisibleDuplicates = () => visibleDuplicates;

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

  const handleToggleMonitor = useCallback(async (id: number) => {
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
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    try {
      const response = await api.deleteGame(id);

      if (response.success) {
        loadGames(); // Reload games
      }
    } catch (err) {
      console.error('Failed to delete game:', err);
    }
  }, []);

  const handleSearch = useCallback((game: Game) => {
    setSelectedGame(game);
    setIsSearchModalOpen(true);
  }, []);

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

        setTimeout(() => setScanMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
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
        setTimeout(() => setScanMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(data.error || 'Failed to ignore folder');
      }
    } catch (err) {
      setError('Failed to ignore folder');
    }
  };

  const handleEdit = useCallback((game: Game) => {
    setSelectedGameForEdit(game);
    setIsEditModalOpen(true);
  }, []);

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
        setTimeout(() => setScanMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);

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

      {/* Bulk Action Toolbar - fixed at bottom when games are selected */}
      {activeTab === 'games' && selectedGameIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-900/95 border-t border-blue-700 p-3 flex items-center justify-between z-40 backdrop-blur-sm">
          <div className="flex items-center gap-4 ml-4">
            <span className="text-sm font-medium">
              {selectedGameIds.size} game{selectedGameIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-300 hover:text-white transition"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => handleBulkMonitor(true)}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
            >
              <EyeIcon className="w-4 h-4" />
              Monitor
            </button>
            <button
              onClick={() => handleBulkMonitor(false)}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
            >
              <EyeSlashIcon className="w-4 h-4" />
              Unmonitor
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar and Sort Dropdown - only show on games tab when there are games */}
      {activeTab === 'games' && games.length > 0 && (
        <div className="mb-6 bg-gray-800 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search Input */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Sort:</label>
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
                <option value="monitored-asc">Monitored first</option>
                <option value="monitored-desc">Unmonitored first</option>
                <option value="store-asc">Store (A-Z)</option>
                <option value="store-desc">Store (Z-A)</option>
                <option value="status-asc">Status (Wanted first)</option>
                <option value="status-desc">Status (Downloaded first)</option>
              </select>
            </div>

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

            {/* Library Filter */}
            {libraries.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Library:</label>
                <select
                  value={filters.libraryId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters((prev) => ({
                      ...prev,
                      libraryId: value === 'all' ? 'all' : parseInt(value, 10),
                    }));
                  }}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Libraries</option>
                  {libraries.map((lib) => (
                    <option key={lib.id} value={lib.id}>
                      {lib.name}
                      {lib.platform ? ` (${lib.platform})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-300 mb-2">No games yet</h3>
              <p className="text-gray-500 mb-6">Add your first game to start building your library</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition"
              >
                Add Game
              </button>
            </div>
          ) : (
            <>
              {/* Poster View */}
              {viewMode === 'posters' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {getPaginatedGames().map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onToggleMonitor={handleToggleMonitor}
                      onDelete={handleDelete}
                      onSearch={handleSearch}
                      onEdit={handleEdit}
                      selected={selectedGameIds.has(game.id)}
                      onToggleSelect={toggleGameSelection}
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
                        <th className="w-10 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isAllSelected()}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeSelected();
                            }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                selectAllGames();
                              } else {
                                clearSelection();
                              }
                            }}
                            className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                          />
                        </th>
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
                        <th className="text-left px-4 py-3 font-medium w-40">
                          Genres
                        </th>
                        <th
                          className="text-center px-2 py-3 font-medium w-12 cursor-pointer hover:bg-gray-600 transition select-none"
                          onClick={() => handleSort('monitored')}
                          title="Monitored"
                        >
                          <EyeIcon className="w-4 h-4 mx-auto" />
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
                      {getPaginatedGames().map((game) => (
                        <tr
                          key={game.id}
                          className={`hover:bg-gray-700/50 transition ${selectedGameIds.has(game.id) ? 'bg-blue-900/30' : ''}`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedGameIds.has(game.id)}
                              onChange={() => toggleGameSelection(game.id)}
                              className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-10 rounded bg-gray-700 flex-shrink-0 overflow-hidden">
                                {game.coverUrl ? (
                                  <img src={game.coverUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <GamepadIcon className="w-4 h-4" />
                                  </div>
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
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{game.year || '—'}</td>
                          <td className="px-4 py-3">
                            {game.totalRating ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                                game.totalRating >= 95 ? 'bg-sky-500' :
                                game.totalRating >= 90 ? 'bg-green-700' :
                                game.totalRating >= 85 ? 'bg-green-600' :
                                game.totalRating >= 80 ? 'bg-green-500' :
                                game.totalRating >= 70 ? 'bg-yellow-600' :
                                game.totalRating >= 60 ? 'bg-orange-600' : 'bg-red-600'
                              }`}>
                                {game.totalRating}%
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 truncate max-w-[160px]">
                            {game.genres ? (
                              (() => {
                                try {
                                  const genres = JSON.parse(game.genres) as string[];
                                  return genres.slice(0, 2).join(', ') || '—';
                                } catch {
                                  return '—';
                                }
                              })()
                            ) : '—'}
                          </td>
                          <td className="px-2 py-3 text-center">
                            {game.monitored ? (
                              <EyeIcon className="w-4 h-4 mx-auto text-green-400" />
                            ) : (
                              <EyeSlashIcon className="w-4 h-4 mx-auto text-gray-500" />
                            )}
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
                                {game.monitored ? <EyeIcon /> : <EyeSlashIcon />}
                              </button>
                              <button
                                onClick={() => handleSearch(game)}
                                className="p-1.5 rounded hover:bg-gray-600 transition"
                                title="Search"
                              >
                                <MagnifyingGlassIcon />
                              </button>
                              <button
                                onClick={() => handleEdit(game)}
                                className="p-1.5 rounded hover:bg-gray-600 transition"
                                title="Edit"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                onClick={() => setGameToDelete(game)}
                                className="p-1.5 rounded hover:bg-red-600 transition"
                                title="Delete"
                              >
                                <TrashIcon />
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
                  {getPaginatedGames().map((game) => {
                    // Parse JSON fields
                    const genres = game.genres ? JSON.parse(game.genres) as string[] : [];
                    const gameModes = game.gameModes ? JSON.parse(game.gameModes) as string[] : [];
                    const similarGames = game.similarGames ? JSON.parse(game.similarGames) as SimilarGame[] : [];

                    return (
                      <div
                        key={game.id}
                        className={`bg-gray-800 rounded-lg p-5 hover:ring-1 hover:ring-gray-600 transition ${selectedGameIds.has(game.id) ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <div className="flex gap-5">
                          {/* Checkbox */}
                          <div className="flex-shrink-0 pt-1">
                            <input
                              type="checkbox"
                              checked={selectedGameIds.has(game.id)}
                              onChange={() => toggleGameSelection(game.id)}
                              className="w-5 h-5 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800 cursor-pointer"
                            />
                          </div>
                          {/* Cover & Rating */}
                          <div className="flex-shrink-0">
                            <div className="w-32 h-44 rounded-lg bg-gray-700 overflow-hidden shadow-lg">
                              {game.coverUrl ? (
                                <img src={game.coverUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                  <GamepadIcon className="w-10 h-10" />
                                </div>
                              )}
                            </div>
                            {game.totalRating && (
                              <div className="mt-3 text-center">
                                <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold text-white ${
                                  game.totalRating >= 95 ? 'bg-sky-500' :
                                  game.totalRating >= 90 ? 'bg-green-700' :
                                  game.totalRating >= 85 ? 'bg-green-600' :
                                  game.totalRating >= 80 ? 'bg-green-500' :
                                  game.totalRating >= 70 ? 'bg-yellow-600' :
                                  game.totalRating >= 60 ? 'bg-orange-600' : 'bg-red-600'
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
                                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                                            <GamepadIcon className="w-4 h-4" />
                                          </div>
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
                                className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center gap-1.5"
                              >
                                {game.monitored ? <><EyeIcon /> Unmonitor</> : <><EyeSlashIcon /> Monitor</>}
                              </button>
                              <button
                                onClick={() => handleSearch(game)}
                                className="text-sm px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 transition flex items-center gap-1.5"
                              >
                                <MagnifyingGlassIcon /> Search
                              </button>
                              <button
                                onClick={() => handleEdit(game)}
                                className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center gap-1.5"
                              >
                                <PencilIcon /> Edit
                              </button>
                              <button
                                onClick={() => setGameToDelete(game)}
                                className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-red-600 transition flex items-center gap-1.5"
                              >
                                <TrashIcon /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {getFilteredAndSortedGames().length > 0 && (
                <div className="mt-6 flex items-center justify-between bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                      Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, getFilteredAndSortedGames().length)} of {getFilteredAndSortedGames().length} games
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400">Per page:</label>
                      <select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm">
                      Page {currentPage} of {getTotalPages()}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(getTotalPages(), p + 1))}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(getTotalPages())}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Library Scan Tab */}
      {activeTab === 'scan' && (
        <LibraryScanTab
          isScanLoaded={isScanLoaded}
          isScanning={isScanning}
          libraryFolders={libraryFolders}
          autoMatchSuggestions={autoMatchSuggestions}
          isAutoMatching={isAutoMatching}
          selectedStore={selectedStore}
          onScanLibrary={handleScanLibrary}
          onAutoMatch={handleAutoMatch}
          onManualMatch={handleMatchFolder}
          onIgnoreFolder={handleIgnoreFolder}
          onConfirmAutoMatch={handleConfirmAutoMatch}
          onEditAutoMatch={handleEditAutoMatch}
          onCancelAutoMatch={handleCancelAutoMatch}
          onStoreChange={(folderPath, store) =>
            setSelectedStore((prev) => ({ ...prev, [folderPath]: store }))
          }
          onOpenSteamImport={handleOpenSteamImport}
        />
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
                  <div className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg">
                    <div className="w-10 h-10 text-green-500 flex-shrink-0">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-200 font-medium">No duplicates detected</p>
                      <p className="text-gray-400 text-sm">Your library doesn't have any games with similar titles that might be duplicates.</p>
                    </div>
                  </div>
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
                                  <p>Size: {formatBytes(game.size)}</p>
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
                  <div className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg">
                    <div className="w-10 h-10 text-green-500 flex-shrink-0">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-200 font-medium">No loose files found</p>
                      <p className="text-gray-400 text-sm">All files in your library folder are properly organized within game folders.</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-3 pr-4">
                            <button onClick={() => handleLooseFileSort('name')} className="hover:text-white flex items-center gap-1">
                              Name {looseFileSortColumn === 'name' && (looseFileSortDirection === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="pb-3 pr-4">
                            <button onClick={() => handleLooseFileSort('size')} className="hover:text-white flex items-center gap-1">
                              Size {looseFileSortColumn === 'size' && (looseFileSortDirection === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="pb-3 pr-4">
                            <button onClick={() => handleLooseFileSort('type')} className="hover:text-white flex items-center gap-1">
                              Type {looseFileSortColumn === 'type' && (looseFileSortDirection === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="pb-3 pr-4">
                            <button onClick={() => handleLooseFileSort('modified')} className="hover:text-white flex items-center gap-1">
                              Modified {looseFileSortColumn === 'modified' && (looseFileSortDirection === 'asc' ? '↑' : '↓')}
                            </button>
                          </th>
                          <th className="pb-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLooseFiles.map((file) => (
                          <tr key={file.path} className="border-b border-gray-700 hover:bg-gray-750">
                            <td className="py-3 pr-4">
                              <span className="font-medium truncate block max-w-md" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-xs text-gray-500 block truncate max-w-lg" title={file.path}>
                                {file.path}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-400">
                              {formatBytes(file.size)}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="uppercase text-xs bg-gray-600 px-2 py-1 rounded">
                                {file.extension.replace('.', '')}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-400">
                              {formatTimestamp(file.modifiedAt)}
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

      <ConfirmModal
        isOpen={gameToDelete !== null}
        title="Delete Game"
        message={gameToDelete ? `Are you sure you want to delete "${gameToDelete.title}"?` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (gameToDelete) {
            handleDelete(gameToDelete.id);
            setGameToDelete(null);
          }
        }}
        onCancel={() => setGameToDelete(null)}
      />

      <ConfirmModal
        isOpen={organizeError !== null}
        title="Error"
        message={organizeError || ''}
        confirmText="OK"
        cancelText=""
        variant="danger"
        onConfirm={() => setOrganizeError(null)}
        onCancel={() => setOrganizeError(null)}
      />

      {/* Steam Import Modal */}
      {isSteamModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl border border-gray-600">
            <div className="bg-gray-700 p-4 border-b border-gray-600 flex items-center justify-between rounded-t-lg">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.07.16-1.5.44l-5.23-2.16C2.31 6.67 6.63 2 12 2m6.19 8.25c0-1.31-1.07-2.38-2.38-2.38s-2.38 1.07-2.38 2.38 1.07 2.38 2.38 2.38 2.38-1.07 2.38-2.38m-12.7 5.85c0 1.1.9 1.99 1.99 1.99.89 0 1.64-.58 1.9-1.38l-1.73-.71c-.41.13-.86.06-1.21-.21a1.35 1.35 0 0 1-.25-1.9l-1.33-.55c-.49.47-.77 1.11-.77 1.8l.4-.04z"/>
                </svg>
                Import from Steam
              </h2>
              <button
                onClick={() => setIsSteamModalOpen(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {isLoadingSteam ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-gray-400">Loading Steam library...</p>
                  </div>
                </div>
              ) : steamError ? (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-red-400 font-medium">{steamError.split('\n')[0]}</p>
                      {steamError.includes('\n') && (
                        <div className="mt-2 max-h-32 overflow-y-auto">
                          <ul className="text-sm text-red-300 space-y-1">
                            {steamError.split('\n').slice(1).map((error, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span>
                                <span>{error}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!steamError.includes('Imported') && (
                        <p className="text-sm text-gray-400 mt-2">
                          Make sure you have configured your Steam API key and Steam ID in Settings.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSteamError(null)}
                      className="text-gray-400 hover:text-white ml-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : steamGames.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No games found in your Steam library.</p>
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
                          value={steamSearchQuery}
                          onChange={(e) => setSteamSearchQuery(e.target.value)}
                          className="w-full bg-gray-600 border border-gray-500 rounded pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {steamSearchQuery && (
                          <button
                            onClick={() => setSteamSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            &times;
                          </button>
                        )}
                      </div>

                      {/* Min Playtime */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400 whitespace-nowrap">Min playtime:</label>
                        <select
                          value={steamMinPlaytime}
                          onChange={(e) => setSteamMinPlaytime(Number(e.target.value))}
                          className="bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={0}>Any</option>
                          <option value={1}>1+ hours</option>
                          <option value={5}>5+ hours</option>
                          <option value={10}>10+ hours</option>
                          <option value={25}>25+ hours</option>
                          <option value={50}>50+ hours</option>
                          <option value={100}>100+ hours</option>
                        </select>
                      </div>

                      {/* Show already owned */}
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={steamShowOwned}
                          onChange={(e) => setSteamShowOwned(e.target.checked)}
                          className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600"
                        />
                        <span className="text-gray-300">Show already imported</span>
                      </label>
                    </div>
                  </div>

                  {/* Stats and Select All */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-400">
                      {filteredSteamGames.length === steamGames.length
                        ? `${steamGames.length} games`
                        : `${filteredSteamGames.length} of ${steamGames.length} games`}
                      {' • '}
                      {filteredSteamGames.filter((g) => !g.alreadyInLibrary).length} available to import
                    </p>
                    <div className="flex items-center gap-3">
                      {selectedSteamGames.size > 0 && (
                        <button
                          onClick={() => setSelectedSteamGames(new Set())}
                          className="text-sm text-gray-400 hover:text-gray-300"
                        >
                          Clear selection
                        </button>
                      )}
                      <button
                        onClick={handleSelectAllSteamGames}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        Select all ({filteredSteamGames.filter((g) => !g.alreadyInLibrary).length})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredSteamGames.map((game) => (
                      <div
                        key={game.appId}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                          game.alreadyInLibrary
                            ? 'bg-gray-700/30 border-gray-700 opacity-50 cursor-not-allowed'
                            : selectedSteamGames.has(game.appId)
                            ? 'bg-blue-900/30 border-blue-600'
                            : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                        }`}
                        onClick={() => !game.alreadyInLibrary && handleToggleSteamGame(game.appId)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSteamGames.has(game.appId)}
                          disabled={game.alreadyInLibrary}
                          onChange={() => {}}
                          className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600"
                        />
                        <img
                          src={game.headerImageUrl}
                          alt=""
                          className="w-24 h-11 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{game.name}</p>
                          <p className="text-xs text-gray-400">
                            {game.playtimeMinutes > 0
                              ? `${Math.round(game.playtimeMinutes / 60)} hours played`
                              : 'Never played'}
                            {game.alreadyInLibrary && ' • Already in library'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-gray-700 p-4 border-t border-gray-600 flex items-center justify-between rounded-b-lg">
              {isImportingSteam ? (
                <div className="flex-1 mr-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300 truncate max-w-md">
                      {steamImportProgress.currentGame || 'Importing...'}
                    </span>
                    {steamImportProgress.total > 0 && (
                      <span className="text-sm text-gray-400 ml-2">
                        {steamImportProgress.current}/{steamImportProgress.total}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: steamImportProgress.total > 0
                          ? `${(steamImportProgress.current / steamImportProgress.total) * 100}%`
                          : '100%',
                        animation: steamImportProgress.total === 0 ? 'pulse 2s infinite' : 'none',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  {selectedSteamGames.size} game{selectedSteamGames.size !== 1 ? 's' : ''} selected
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSteamModalOpen(false)}
                  disabled={isImportingSteam}
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition disabled:opacity-50"
                >
                  {isImportingSteam ? 'Close' : 'Cancel'}
                </button>
                {!isImportingSteam && (
                  <button
                    onClick={handleImportSteamGames}
                    disabled={selectedSteamGames.size === 0}
                    className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    Import {selectedSteamGames.size} Game{selectedSteamGames.size !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Library;
