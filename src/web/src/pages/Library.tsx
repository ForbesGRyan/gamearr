import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddGameModal from '../components/AddGameModal';
import SearchReleasesModal from '../components/SearchReleasesModal';
import MatchFolderModal from '../components/MatchFolderModal';
import ConfirmModal from '../components/ConfirmModal';
import { api, SteamGame, GogGame } from '../api/client';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

// Import library-specific components and hooks
import {
  LibraryPagination,
  LibraryScanTab,
  LibraryHealthTab,
  LibraryTableView,
  LibraryMobileView,
  LibraryPosterGrid,
  LibraryOverviewGrid,
  LibraryEmptyState,
  LibraryHeader,
  LibraryTabs,
  LibraryGamesFilter,
  SteamImportModal,
  GogImportModal,
  BulkActionToolbar,
  LibraryToasts,
  useLibraryGames,
} from '../components/library';
import type {
  LibraryFolder,
  AutoMatchSuggestion,
  LooseFile,
  DuplicateGroup,
} from '../components/library';

type Tab = 'games' | 'scan' | 'health';

function Library() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive activeTab directly from URL - single source of truth
  const activeTab: Tab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'scan' || tabParam === 'health') {
      return tabParam;
    }
    return 'games';
  }, [searchParams]);

  // Handler to change tab - updates URL which updates activeTab
  const setActiveTab = useCallback((tab: Tab) => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'games') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Use custom hook for games state and handlers
  const {
    games,
    isLoading,
    error,
    setError,
    viewMode,
    sortColumn,
    sortDirection,
    filters,
    searchQuery,
    libraries,
    isModalOpen,
    setIsModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    selectedGame,
    setSelectedGame,
    gameToDelete,
    setGameToDelete,
    selectedGameIds,
    bulkActionLoading,
    isAllSelected,
    isSomeSelected,
    currentPage,
    setCurrentPage,
    pageSize,
    totalPages,
    allGenres,
    allGameModes,
    allStores,
    filteredAndSortedGames,
    paginatedGames,
    activeFilterCount,
    handleViewModeChange,
    handleSort,
    handleToggleMonitor,
    handleDelete,
    handleSearch,
    handleEdit,
    handlePageSizeChange,
    clearFilters,
    toggleGameSelection,
    selectAllGames,
    clearSelection,
    handleBulkMonitor,
    handleBulkDelete,
    loadGames,
    setSearchQuery,
    setFilters,
    setSort,
  } = useLibraryGames();

  // Match folder modal state
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<LibraryFolder | null>(null);

  // Scan tab state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [isScanLoaded, setIsScanLoaded] = useState(false);
  const [autoMatchSuggestions, setAutoMatchSuggestions] = useState<Record<string, AutoMatchSuggestion>>({});
  const [isAutoMatching, setIsAutoMatching] = useState<Record<string, boolean>>({});
  const [selectedStores, setSelectedStores] = useState<Record<string, string[]>>({});
  const [selectedLibraryForMatch, setSelectedLibraryForMatch] = useState<Record<string, number | undefined>>({});

  // Background auto-matching state
  const [isBackgroundAutoMatching, setIsBackgroundAutoMatching] = useState(false);
  const [backgroundAutoMatchProgress, setBackgroundAutoMatchProgress] = useState({ current: 0, total: 0 });
  const backgroundAutoMatchAbortRef = useRef(false);

  // Health tab state
  const [looseFiles, setLooseFiles] = useState<LooseFile[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isHealthLoaded, setIsHealthLoaded] = useState(false);

  // Tab counts (loaded on mount for badges)
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [healthCount, setHealthCount] = useState<number | null>(null);
  const [organizingFile, setOrganizingFile] = useState<string | null>(null);
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [dismissedDuplicates, setDismissedDuplicates] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dismissed-duplicates');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Steam import state
  const [isSteamModalOpen, setIsSteamModalOpen] = useState(false);
  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [isLoadingSteam, setIsLoadingSteam] = useState(false);
  const [steamError, setSteamError] = useState<string | null>(null);
  const [selectedSteamGames, setSelectedSteamGames] = useState<Set<number>>(new Set());
  const [isImportingSteam, setIsImportingSteam] = useState(false);
  const [steamImportProgress, setSteamImportProgress] = useState({ current: 0, total: 0, currentGame: '' });
  const [steamSearchQuery, setSteamSearchQuery] = useState('');
  const [steamMinPlaytime, setSteamMinPlaytime] = useState<number>(0);
  const [steamShowOwned, setSteamShowOwned] = useState(true);
  const [steamSortBy, setSteamSortBy] = useState<'playtime' | 'name'>('playtime');

  // GOG import state
  const [isGogModalOpen, setIsGogModalOpen] = useState(false);
  const [gogGames, setGogGames] = useState<GogGame[]>([]);
  const [isLoadingGog, setIsLoadingGog] = useState(false);
  const [gogError, setGogError] = useState<string | null>(null);
  const [selectedGogGames, setSelectedGogGames] = useState<Set<number>>(new Set());
  const [isImportingGog, setIsImportingGog] = useState(false);
  const [gogImportProgress, setGogImportProgress] = useState({ current: 0, total: 0, currentGame: '' });
  const [gogSearchQuery, setGogSearchQuery] = useState('');
  const [gogShowOwned, setGogShowOwned] = useState(true);

  // Computed values
  const visibleDuplicates = useMemo(() => {
    return duplicates.filter((group) => {
      const key = group.games.map((g) => g.id).sort().join('-');
      return !dismissedDuplicates.has(key);
    });
  }, [duplicates, dismissedDuplicates]);

  const filteredSteamGames = useMemo(() => {
    const filtered = steamGames.filter((game) => {
      if (steamSearchQuery.trim()) {
        const query = steamSearchQuery.toLowerCase();
        if (!game.name.toLowerCase().includes(query)) return false;
      }
      const playtimeHours = game.playtimeMinutes / 60;
      if (playtimeHours < steamMinPlaytime) return false;
      if (!steamShowOwned && game.alreadyInLibrary) return false;
      return true;
    });
    // Sort the filtered results
    return filtered.sort((a, b) => {
      if (steamSortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Default: sort by playtime (descending)
      return b.playtimeMinutes - a.playtimeMinutes;
    });
  }, [steamGames, steamSearchQuery, steamMinPlaytime, steamShowOwned, steamSortBy]);

  const filteredGogGames = useMemo(() => {
    return gogGames.filter((game) => {
      if (gogSearchQuery.trim()) {
        const query = gogSearchQuery.toLowerCase();
        if (!game.title.toLowerCase().includes(query)) return false;
      }
      if (!gogShowOwned && game.alreadyInLibrary) return false;
      return true;
    });
  }, [gogGames, gogSearchQuery, gogShowOwned]);

  // Data loading
  const loadScanData = useCallback(async () => {
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
    }
  }, []);

  const loadHealthData = useCallback(async () => {
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
  }, []);

  // Load scan count on mount (lightweight), but load full health data
  // so we can accurately compute visible count (excluding dismissed duplicates)
  useEffect(() => {
    const loadInitialData = async () => {
      // Load scan count (lightweight)
      const scanRes = await api.getLibraryScanCount();
      if (scanRes.success && scanRes.data) {
        setScanCount(scanRes.data.count);
      }
      // Load full health data so badge count excludes dismissed duplicates
      loadHealthData();
    };
    loadInitialData();
  }, [loadHealthData]);

  // Load full data only when tab is visited
  useEffect(() => {
    if (activeTab === 'scan' && !isScanLoaded) {
      loadScanData();
    }
  }, [activeTab, isScanLoaded, loadScanData]);

  useEffect(() => {
    if (activeTab === 'health' && !isHealthLoaded) {
      loadHealthData();
    }
  }, [activeTab, isHealthLoaded, loadHealthData]);

  // Scan handlers - parallel auto-matching with concurrency limit
  const runBackgroundAutoMatch = useCallback(async (folders: LibraryFolder[]) => {
    const foldersToMatch = folders.filter(f => !f.matched && !autoMatchSuggestions[f.path]);
    if (foldersToMatch.length === 0) return;

    setIsBackgroundAutoMatching(true);
    setBackgroundAutoMatchProgress({ current: 0, total: foldersToMatch.length });
    backgroundAutoMatchAbortRef.current = false;

    const CONCURRENCY_LIMIT = 5;
    let completedCount = 0;

    // Process folders in batches with concurrency limit
    const processFolder = async (folder: LibraryFolder) => {
      if (backgroundAutoMatchAbortRef.current) return;

      setIsAutoMatching((prev) => ({ ...prev, [folder.path]: true }));

      try {
        const response = await api.autoMatchFolder(folder.parsedTitle, folder.parsedYear);
        if (response.success && response.data) {
          setAutoMatchSuggestions((prev) => ({
            ...prev,
            [folder.path]: response.data as AutoMatchSuggestion,
          }));
          if (folder.libraryName) {
            const matchingLibrary = libraries.find(
              lib => lib.name.toLowerCase() === folder.libraryName?.toLowerCase()
            );
            if (matchingLibrary) {
              setSelectedLibraryForMatch((prev) => ({
                ...prev,
                [folder.path]: matchingLibrary.id,
              }));
            }
          }
        }
      } catch {
        // Silently continue on error
      } finally {
        setIsAutoMatching((prev) => ({ ...prev, [folder.path]: false }));
        completedCount++;
        setBackgroundAutoMatchProgress({ current: completedCount, total: foldersToMatch.length });
      }
    };

    // Process in batches with concurrency limit
    for (let i = 0; i < foldersToMatch.length; i += CONCURRENCY_LIMIT) {
      if (backgroundAutoMatchAbortRef.current) break;

      const batch = foldersToMatch.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processFolder));
    }

    setIsBackgroundAutoMatching(false);
  }, [autoMatchSuggestions, libraries]);

  const handleScanLibrary = useCallback(async () => {
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

        const unmatchedFolders = folders.filter(f => !f.matched);
        if (unmatchedFolders.length > 0) {
          setTimeout(() => {
            runBackgroundAutoMatch(unmatchedFolders);
          }, 500);
        }
      } else {
        setError(response.error || 'Library scan failed');
      }
    } catch {
      setError('Failed to scan library. Check that library path is configured in Settings.');
    } finally {
      setIsScanning(false);
    }
  }, [setError, runBackgroundAutoMatch]);

  const handleMatchFolder = useCallback((folder: LibraryFolder) => {
    setSelectedFolder(folder);
    setIsMatchModalOpen(true);
  }, []);

  const handleFolderMatched = useCallback(() => {
    loadGames();
    loadScanData();
  }, [loadGames, loadScanData]);

  const handleIgnoreFolder = useCallback(async (folderPath: string) => {
    try {
      const response = await fetch('/api/v1/library/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });
      const data = await response.json();
      if (data.success) {
        await loadScanData();
        setScanMessage('Folder ignored successfully');
        setTimeout(() => setScanMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(data.error || 'Failed to ignore folder');
      }
    } catch {
      setError('Failed to ignore folder');
    }
  }, [loadScanData, setError]);

  const handleAutoMatch = useCallback(async (folder: LibraryFolder) => {
    setIsAutoMatching((prev) => ({ ...prev, [folder.path]: true }));
    setError(null);
    try {
      const response = await api.autoMatchFolder(folder.parsedTitle, folder.parsedYear);
      if (response.success && response.data) {
        setAutoMatchSuggestions((prev) => ({
          ...prev,
          [folder.path]: response.data as AutoMatchSuggestion,
        }));
        if (folder.libraryName) {
          const matchingLibrary = libraries.find(
            lib => lib.name.toLowerCase() === folder.libraryName?.toLowerCase()
          );
          if (matchingLibrary) {
            setSelectedLibraryForMatch((prev) => ({
              ...prev,
              [folder.path]: matchingLibrary.id,
            }));
          }
        }
      } else {
        setError(response.error || 'Failed to auto-match folder');
      }
    } catch {
      setError('Failed to auto-match folder');
    } finally {
      setIsAutoMatching((prev) => ({ ...prev, [folder.path]: false }));
    }
  }, [libraries, setError]);

  const cancelBackgroundAutoMatch = useCallback(() => {
    backgroundAutoMatchAbortRef.current = true;
  }, []);

  const handleConfirmAutoMatch = useCallback(async (folder: LibraryFolder) => {
    const suggestion = autoMatchSuggestions[folder.path];
    if (!suggestion) return;

    try {
      let targetPlatform: string | undefined;
      const libraryId = selectedLibraryForMatch[folder.path];
      if (libraryId) {
        const library = libraries.find(l => l.id === libraryId);
        targetPlatform = library?.platform || undefined;
      }

      let suggestionWithPlatform = suggestion;
      if (targetPlatform && suggestion.platforms && suggestion.platforms.length > 0) {
        const matchingPlatform = suggestion.platforms.find(p =>
          p.toLowerCase().includes(targetPlatform!.toLowerCase()) ||
          targetPlatform!.toLowerCase().includes(p.toLowerCase().replace(/[^a-z]/g, ''))
        );
        if (matchingPlatform) {
          suggestionWithPlatform = { ...suggestion, platforms: [matchingPlatform] };
        }
      } else if (suggestion.platforms && suggestion.platforms.length > 0) {
        const pcPlatform = suggestion.platforms.find(p =>
          p.toLowerCase().includes('pc') || p.toLowerCase().includes('windows')
        );
        if (pcPlatform) {
          suggestionWithPlatform = { ...suggestion, platforms: [pcPlatform] };
        }
      }

      const folderStores = selectedStores[folder.path] || [];
      const response = await api.matchLibraryFolder(
        folder.path,
        folder.folderName,
        suggestionWithPlatform,
        folderStores[0] || null, // Use first store for legacy field
        selectedLibraryForMatch[folder.path] || null
      );

      if (response.success && response.data) {
        // If multiple stores selected, update stores via the dedicated endpoint
        if (folderStores.length > 0) {
          await api.updateGameStores(response.data.id, folderStores);
        }
        setAutoMatchSuggestions((prev) => {
          const newSuggestions = { ...prev };
          delete newSuggestions[folder.path];
          return newSuggestions;
        });
        setScanMessage(`Successfully matched "${folder.folderName}" to ${suggestion.title}`);
        setTimeout(() => setScanMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
        loadGames();
        await loadScanData();
      } else {
        setError(response.error || 'Failed to match folder');
      }
    } catch {
      setError('Failed to match folder');
    }
  }, [autoMatchSuggestions, selectedLibraryForMatch, selectedStores, libraries, loadGames, loadScanData, setError]);

  const handleCancelAutoMatch = useCallback((folder: LibraryFolder) => {
    setAutoMatchSuggestions((prev) => {
      const newSuggestions = { ...prev };
      delete newSuggestions[folder.path];
      return newSuggestions;
    });
  }, []);

  const handleEditAutoMatch = useCallback((folder: LibraryFolder) => {
    handleMatchFolder(folder);
  }, [handleMatchFolder]);

  // Health tab handlers
  const handleOrganizeFile = useCallback(async (filePath: string, folderName: string) => {
    setOrganizingFile(filePath);
    setOrganizeError(null);
    try {
      const response = await api.organizeLooseFile(filePath, folderName);
      if (response.success) {
        setLooseFiles((prev) => prev.filter((f) => f.path !== filePath));
      } else {
        const errorMsg = typeof response.error === 'string'
          ? response.error
          : 'Failed to organize file';
        setOrganizeError(errorMsg);
      }
    } catch (err) {
      console.error('Failed to organize file:', err);
      setOrganizeError('Failed to organize file');
    } finally {
      setOrganizingFile(null);
    }
  }, []);

  const handleDismissDuplicate = useCallback((group: DuplicateGroup) => {
    const key = group.games.map((g) => g.id).sort().join('-');
    const newDismissed = new Set(dismissedDuplicates);
    newDismissed.add(key);
    setDismissedDuplicates(newDismissed);
    localStorage.setItem('dismissed-duplicates', JSON.stringify([...newDismissed]));
  }, [dismissedDuplicates]);

  // Steam import handlers
  const handleOpenSteamImport = useCallback(async () => {
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
    } catch {
      setSteamError('Failed to connect to Steam');
    } finally {
      setIsLoadingSteam(false);
    }
  }, []);

  const handleToggleSteamGame = useCallback((appId: number) => {
    setSelectedSteamGames((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  }, []);

  const handleSelectAllSteamGames = useCallback(() => {
    const importableGames = filteredSteamGames.filter((g) => !g.alreadyInLibrary);
    setSelectedSteamGames(new Set(importableGames.map((g) => g.appId)));
  }, [filteredSteamGames]);

  const handleImportSteamGames = useCallback(async () => {
    if (selectedSteamGames.size === 0) return;
    setIsImportingSteam(true);
    const appIds = Array.from(selectedSteamGames);
    const total = appIds.length;
    setSteamImportProgress({ current: 0, total, currentGame: 'Starting import...' });

    try {
      await api.importSteamGamesStream(
        appIds,
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
        async (result) => {
          setSteamGames(prev => prev.map(g =>
            appIds.includes(g.appId) ? { ...g, alreadyInLibrary: true } : g
          ));
          setSelectedSteamGames(new Set());
          await loadGames();
          const summary = `Imported ${result.imported}, skipped ${result.skipped}.`;
          const errorList = result.errors?.length ? `\n${result.errors.join('\n')}` : '';
          if (result.imported > 0 || result.skipped > 0 || result.errors?.length) {
            setSteamError(summary + errorList);
          }
          setIsImportingSteam(false);
          setSteamImportProgress({ current: 0, total: 0, currentGame: '' });
        },
        (message) => {
          setSteamError(message);
          setIsImportingSteam(false);
          setSteamImportProgress({ current: 0, total: 0, currentGame: '' });
        }
      );
    } catch {
      setSteamError('Failed to import games');
      setIsImportingSteam(false);
      setSteamImportProgress({ current: 0, total: 0, currentGame: '' });
    }
  }, [selectedSteamGames, loadGames]);

  // GOG import handlers
  const handleOpenGogImport = useCallback(async () => {
    setIsGogModalOpen(true);
    setIsLoadingGog(true);
    setGogError(null);
    setSelectedGogGames(new Set());
    try {
      const response = await api.getGogOwnedGames();
      if (response.success && response.data) {
        setGogGames(response.data);
      } else {
        setGogError(response.error || 'Failed to load GOG games');
      }
    } catch {
      setGogError('Failed to connect to GOG');
    } finally {
      setIsLoadingGog(false);
    }
  }, []);

  const handleToggleGogGame = useCallback((id: number) => {
    setSelectedGogGames((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAllGogGames = useCallback(() => {
    const importableGames = filteredGogGames.filter((g) => !g.alreadyInLibrary);
    setSelectedGogGames(new Set(importableGames.map((g) => g.id)));
  }, [filteredGogGames]);

  const handleImportGogGames = useCallback(async () => {
    if (selectedGogGames.size === 0) return;
    setIsImportingGog(true);
    const gameIds = Array.from(selectedGogGames);
    const total = gameIds.length;
    setGogImportProgress({ current: 0, total, currentGame: 'Starting import...' });

    try {
      await api.importGogGamesStream(
        gameIds,
        (data) => {
          const statusText = data.status === 'searching' ? 'Searching...' :
            data.status === 'imported' ? 'Imported' :
            data.status === 'skipped' ? 'Skipped' : 'Error';
          setGogImportProgress({
            current: data.current,
            total: data.total,
            currentGame: `${data.game} (${statusText})`,
          });
        },
        async (result) => {
          setGogGames(prev => prev.map(g =>
            gameIds.includes(g.id) ? { ...g, alreadyInLibrary: true } : g
          ));
          setSelectedGogGames(new Set());
          await loadGames();
          const summary = `Imported ${result.imported}, skipped ${result.skipped}.`;
          const errorList = result.errors?.length ? `\n${result.errors.join('\n')}` : '';
          if (result.imported > 0 || result.skipped > 0 || result.errors?.length) {
            setGogError(summary + errorList);
          }
          setIsImportingGog(false);
          setGogImportProgress({ current: 0, total: 0, currentGame: '' });
        },
        (message) => {
          setGogError(message);
          setIsImportingGog(false);
          setGogImportProgress({ current: 0, total: 0, currentGame: '' });
        }
      );
    } catch {
      setGogError('Failed to import games');
      setIsImportingGog(false);
      setGogImportProgress({ current: 0, total: 0, currentGame: '' });
    }
  }, [selectedGogGames, loadGames]);

  return (
    <div>
      <LibraryHeader
        gamesCount={games.length}
        activeTab={activeTab}
        viewMode={viewMode}
        isScanning={isScanning}
        isHealthLoading={isHealthLoading}
        onViewModeChange={handleViewModeChange}
        onAddGame={() => setIsModalOpen(true)}
        onScanLibrary={handleScanLibrary}
        onRefreshHealth={() => {
          setIsHealthLoaded(false);
          loadHealthData();
        }}
      />

      <LibraryTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        libraryFoldersCount={isScanLoaded ? libraryFolders.filter(f => !f.matched).length : scanCount}
        healthIssuesCount={isHealthLoaded ? visibleDuplicates.length + looseFiles.length : healthCount}
      />

      {/* Bulk Action Toolbar */}
      {activeTab === 'games' && (
        <BulkActionToolbar
          selectedCount={selectedGameIds.size}
          isLoading={bulkActionLoading}
          onMonitor={() => handleBulkMonitor(true)}
          onUnmonitor={() => handleBulkMonitor(false)}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}

      {/* Games Filter Bar */}
      {activeTab === 'games' && games.length > 0 && (
        <LibraryGamesFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={setSort}
          filters={filters}
          onFiltersChange={setFilters}
          allGenres={allGenres}
          allGameModes={allGameModes}
          allStores={allStores}
          activeFilterCount={activeFilterCount}
          filteredCount={filteredAndSortedGames.length}
          totalCount={games.length}
          libraries={libraries}
          onClearFilters={clearFilters}
        />
      )}

      <LibraryToasts error={error} successMessage={scanMessage} />

      {/* Games Tab */}
      {activeTab === 'games' && (
        <>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">Loading games...</p>
            </div>
          ) : games.length === 0 ? (
            <LibraryEmptyState onAddGame={() => setIsModalOpen(true)} />
          ) : (
            <>
              {/* Pagination - Top */}
              {filteredAndSortedGames.length > 0 && (
                <LibraryPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredAndSortedGames.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={handlePageSizeChange}
                  itemLabel="games"
                />
              )}

              {viewMode === 'posters' && (
                <LibraryPosterGrid
                  games={paginatedGames}
                  selectedGameIds={selectedGameIds}
                  onToggleMonitor={handleToggleMonitor}
                  onDelete={handleDelete}
                  onSearch={handleSearch}
                  onToggleSelect={toggleGameSelection}
                />
              )}

              {viewMode === 'table' && (
                <>
                  <LibraryMobileView
                    games={paginatedGames}
                    onToggleMonitor={handleToggleMonitor}
                    onSearch={handleSearch}
                    onEdit={handleEdit}
                    onDelete={(game) => setGameToDelete(game)}
                  />
                  <LibraryTableView
                    games={paginatedGames}
                    selectedGameIds={selectedGameIds}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onToggleSelect={toggleGameSelection}
                    onSelectAll={selectAllGames}
                    onClearSelection={clearSelection}
                    isAllSelected={isAllSelected}
                    isSomeSelected={isSomeSelected}
                    onToggleMonitor={handleToggleMonitor}
                    onSearch={handleSearch}
                    onEdit={handleEdit}
                    onDelete={(game) => setGameToDelete(game)}
                  />
                </>
              )}

              {viewMode === 'overview' && (
                <LibraryOverviewGrid
                  games={paginatedGames}
                  selectedGameIds={selectedGameIds}
                  onToggleSelect={toggleGameSelection}
                  onToggleMonitor={handleToggleMonitor}
                  onSearch={handleSearch}
                  onEdit={handleEdit}
                  onDelete={(game) => setGameToDelete(game)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Scan Tab */}
      {activeTab === 'scan' && (
        <LibraryScanTab
          isScanLoaded={isScanLoaded}
          isScanning={isScanning}
          libraryFolders={libraryFolders}
          autoMatchSuggestions={autoMatchSuggestions}
          isAutoMatching={isAutoMatching}
          selectedStores={selectedStores}
          libraries={libraries}
          selectedLibrary={selectedLibraryForMatch}
          isBackgroundAutoMatching={isBackgroundAutoMatching}
          backgroundAutoMatchProgress={backgroundAutoMatchProgress}
          onScanLibrary={handleScanLibrary}
          onAutoMatch={handleAutoMatch}
          onManualMatch={handleMatchFolder}
          onIgnoreFolder={handleIgnoreFolder}
          onConfirmAutoMatch={handleConfirmAutoMatch}
          onEditAutoMatch={handleEditAutoMatch}
          onCancelAutoMatch={handleCancelAutoMatch}
          onCancelBackgroundAutoMatch={cancelBackgroundAutoMatch}
          onStoresChange={(folderPath, stores) =>
            setSelectedStores((prev) => ({ ...prev, [folderPath]: stores }))
          }
          onLibraryChange={(folderPath, libraryId) =>
            setSelectedLibraryForMatch((prev) => ({ ...prev, [folderPath]: libraryId }))
          }
          onOpenSteamImport={handleOpenSteamImport}
          onOpenGogImport={handleOpenGogImport}
        />
      )}

      {/* Health Tab */}
      {activeTab === 'health' && (
        <LibraryHealthTab
          isLoading={isHealthLoading}
          isLoaded={isHealthLoaded}
          duplicates={visibleDuplicates}
          looseFiles={looseFiles}
          libraries={libraries}
          organizingFile={organizingFile}
          onOrganizeFile={handleOrganizeFile}
          onDismissDuplicate={handleDismissDuplicate}
        />
      )}

      {/* Modals */}
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
      <SteamImportModal
        isOpen={isSteamModalOpen}
        onClose={() => setIsSteamModalOpen(false)}
        isLoading={isLoadingSteam}
        error={steamError}
        onErrorDismiss={() => setSteamError(null)}
        games={steamGames}
        filteredGames={filteredSteamGames}
        selectedGames={selectedSteamGames}
        onToggleGame={handleToggleSteamGame}
        onSelectAll={handleSelectAllSteamGames}
        onClearSelection={() => setSelectedSteamGames(new Set())}
        onImport={handleImportSteamGames}
        isImporting={isImportingSteam}
        importProgress={steamImportProgress}
        searchQuery={steamSearchQuery}
        onSearchChange={setSteamSearchQuery}
        minPlaytime={steamMinPlaytime}
        onMinPlaytimeChange={setSteamMinPlaytime}
        showOwned={steamShowOwned}
        onShowOwnedChange={setSteamShowOwned}
        sortBy={steamSortBy}
        onSortChange={setSteamSortBy}
      />

      {/* GOG Import Modal */}
      <GogImportModal
        isOpen={isGogModalOpen}
        onClose={() => setIsGogModalOpen(false)}
        isLoading={isLoadingGog}
        error={gogError}
        onErrorDismiss={() => setGogError(null)}
        games={gogGames}
        filteredGames={filteredGogGames}
        selectedGames={selectedGogGames}
        onToggleGame={handleToggleGogGame}
        onSelectAll={handleSelectAllGogGames}
        onClearSelection={() => setSelectedGogGames(new Set())}
        onImport={handleImportGogGames}
        isImporting={isImportingGog}
        importProgress={gogImportProgress}
        searchQuery={gogSearchQuery}
        onSearchChange={setGogSearchQuery}
        showOwned={gogShowOwned}
        onShowOwnedChange={setGogShowOwned}
      />
    </div>
  );
}

export default Library;
