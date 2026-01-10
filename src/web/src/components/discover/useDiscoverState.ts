import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../../utils/constants';
import { usePreloadedData, invalidatePopularGamesCache } from '../../hooks/usePreloadCache';
import {
  TabType,
  TorrentFilters,
  PopularityType,
  MultiplayerInfo,
  GameSearchResult,
  PopularGame,
  TorrentRelease,
} from './types';

export function useDiscoverState() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL params
  const initialTab = (searchParams.get('tab') as TabType) || 'trending';
  const initialQuery = searchParams.get('q') || '';
  const initialAge = parseInt(searchParams.get('age') || '30', 10);
  const initialType = parseInt(searchParams.get('type') || '2', 10);

  // Use preloaded cache for faster initial load
  const {
    popularityTypes: cachedPopularityTypes,
    getPopularityTypes: getCachedPopularityTypes,
    getPopularGames: getCachedPopularGames,
    getTopTorrents: getCachedTopTorrents,
    hasCachedPopularGames,
    hasCachedTorrents,
    getCachedPopularGames: getPopularGamesFromCache,
    getCachedTorrents: getTorrentsFromCache,
  } = usePreloadedData();

  const [activeTab, setActiveTabState] = useState<TabType>(initialTab);
  const [popularityTypes, setPopularityTypes] = useState<PopularityType[]>(cachedPopularityTypes || []);
  const [selectedType, setSelectedTypeState] = useState<number>(initialType);
  const [popularGames, setPopularGames] = useState<PopularGame[]>([]);
  const [isLoading, setIsLoading] = useState(!cachedPopularityTypes);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingGame, setAddingGame] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [multiplayerOnly, setMultiplayerOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Torrents state
  const [torrents, setTorrents] = useState<TorrentRelease[]>([]);
  const [isLoadingTorrents, setIsLoadingTorrents] = useState(false);
  const [torrentSearch, setTorrentSearch] = useState(initialQuery);
  const [torrentSearchInput, setTorrentSearchInput] = useState(initialQuery);
  const [selectedTorrent, setSelectedTorrent] = useState<TorrentRelease | null>(null);
  const [torrentMaxAge, setTorrentMaxAgeState] = useState<number>(initialAge);

  // Modal game search state
  const [modalGameSearch, setModalGameSearch] = useState('');
  const [modalGameResults, setModalGameResults] = useState<GameSearchResult[]>([]);
  const [isSearchingGames, setIsSearchingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null);
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);

  // Torrent title filters (loaded from config file)
  const torrentFiltersRef = useRef<TorrentFilters | null>(null);

  // Load torrent filters config on mount
  useEffect(() => {
    fetch('/torrent-filters.json')
      .then(res => res.json())
      .then((filters: TorrentFilters) => {
        torrentFiltersRef.current = filters;
      })
      .catch(() => {
        torrentFiltersRef.current = {
          releaseGroups: ['GOG', 'Steam', 'Repack', 'CODEX', 'FitGirl', 'DODI'],
          platformTags: ['PC', 'x64', 'x86'],
          languageTags: ['Multi\\d+', 'MULTI'],
          otherPatterns: []
        };
      });
  }, []);

  // Helper to clean torrent title for game search
  const cleanTorrentTitle = useCallback((title: string): string => {
    let cleaned = title;
    cleaned = cleaned.replace(/\s*v\d+(\.\d+)*\s*/gi, ' ');
    cleaned = cleaned.replace(/\.(zip|rar|iso|exe|7z)$/i, '');
    cleaned = cleaned.replace(/\s*\(\d{4}\)\s*$/, '');

    const filters = torrentFiltersRef.current;
    if (filters) {
      const allPatterns = [
        ...filters.releaseGroups,
        ...filters.platformTags,
        ...filters.languageTags,
        ...filters.otherPatterns
      ];
      const patternStr = allPatterns.join('|');
      const filterRegex = new RegExp(`\\s*[\\[\\(]?(${patternStr})[\\]\\)]?\\s*`, 'gi');
      cleaned = cleaned.replace(filterRegex, ' ');
    }

    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 3) {
      cleaned = title.split(/[\[\(]/)[0].trim();
    }
    return cleaned;
  }, []);

  // Helper to update URL params
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapped setters that update URL
  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabState(tab);
    updateUrlParams({ tab: tab === 'trending' ? null : tab });
  }, [updateUrlParams]);

  const setSelectedType = useCallback((type: number) => {
    setSelectedTypeState(type);
    updateUrlParams({ type: type === 2 ? null : type.toString() });
  }, [updateUrlParams]);

  const setTorrentMaxAge = useCallback((age: number) => {
    setTorrentMaxAgeState(age);
    updateUrlParams({ age: age === 30 ? null : age.toString() });
  }, [updateUrlParams]);

  const setTorrentSearchWithUrl = useCallback((query: string) => {
    setTorrentSearch(query);
    updateUrlParams({ q: query || null });
  }, [updateUrlParams]);

  const loadPopularityTypes = async () => {
    try {
      const cached = await getCachedPopularityTypes();
      if (cached) {
        setPopularityTypes(cached);
        setIsLoading(false);
        return;
      }
      const response = await api.getPopularityTypes();
      if (response.success && response.data) {
        setPopularityTypes(response.data as PopularityType[]);
      }
    } catch {
      setError('Failed to load popularity types');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPopularGames = async (type: number) => {
    if (hasCachedPopularGames(type)) {
      const cached = getPopularGamesFromCache(type);
      if (cached) {
        setPopularGames(cached as PopularGame[]);
        return;
      }
    }

    setIsLoadingGames(true);
    setError(null);
    try {
      const cached = await getCachedPopularGames(type);
      if (cached) {
        setPopularGames(cached as PopularGame[]);
        setIsLoadingGames(false);
        return;
      }
      const response = await api.getPopularGames(type, 50);
      if (response.success && response.data) {
        setPopularGames(response.data as PopularGame[]);
      } else {
        setError(response.error || 'Failed to load popular games');
      }
    } catch {
      setError('Failed to load popular games');
    } finally {
      setIsLoadingGames(false);
    }
  };

  const loadTorrents = useCallback(async (query?: string) => {
    const searchQuery = query || 'game';
    const isDefaultSearch = searchQuery === 'game' && torrentMaxAge === 30;

    if (isDefaultSearch && hasCachedTorrents()) {
      const cached = getTorrentsFromCache();
      if (cached) {
        setTorrents(cached);
        return;
      }
    }

    setIsLoadingTorrents(true);
    setError(null);
    try {
      if (isDefaultSearch) {
        const cached = await getCachedTopTorrents();
        if (cached) {
          setTorrents(cached);
          setIsLoadingTorrents(false);
          return;
        }
      }
      const response = await api.getTopTorrents(searchQuery, 50, torrentMaxAge);
      if (response.success && response.data) {
        setTorrents(response.data as TorrentRelease[]);
        if (query) {
          setTorrentSearchWithUrl(query);
        }
      } else {
        setError(response.error || 'Failed to load torrents');
      }
    } catch {
      setError('Failed to load torrents');
    } finally {
      setIsLoadingTorrents(false);
    }
  }, [torrentMaxAge, setTorrentSearchWithUrl, hasCachedTorrents, getTorrentsFromCache, getCachedTopTorrents]);

  const handleTorrentSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (torrentSearchInput.trim()) {
      loadTorrents(torrentSearchInput.trim());
    }
  }, [torrentSearchInput, loadTorrents]);

  // Load popularity types on mount
  useEffect(() => {
    loadPopularityTypes();
  }, []);

  // Sync with cached popularity types when they become available
  useEffect(() => {
    if (cachedPopularityTypes && cachedPopularityTypes.length > 0 && popularityTypes.length === 0) {
      setPopularityTypes(cachedPopularityTypes);
      setIsLoading(false);
    }
  }, [cachedPopularityTypes, popularityTypes.length]);

  // Load games when type changes
  useEffect(() => {
    if (selectedType && activeTab === 'trending') {
      loadPopularGames(selectedType);
    }
  }, [selectedType, activeTab]);

  // Load torrents when tab changes to torrents or age changes
  useEffect(() => {
    if (activeTab === 'torrents') {
      loadTorrents(torrentSearch || undefined);
    }
  }, [activeTab, torrentMaxAge, loadTorrents]);

  // Pre-fill game search when torrent is selected
  useEffect(() => {
    if (selectedTorrent) {
      const gameName = cleanTorrentTitle(selectedTorrent.title);
      setModalGameSearch(gameName);

      const searchGames = async () => {
        if (!gameName) return;
        setIsSearchingGames(true);
        try {
          const response = await api.searchGames(gameName);
          if (response.success && response.data) {
            setModalGameResults(response.data as GameSearchResult[]);
          }
        } catch {
          // Silently fail
        } finally {
          setIsSearchingGames(false);
        }
      };
      searchGames();
    }
  }, [selectedTorrent, cleanTorrentTitle]);

  const handleAddToLibrary = useCallback(async (game: GameSearchResult) => {
    setAddingGame(game.igdbId);
    try {
      const response = await api.addGame({ igdbId: game.igdbId, monitored: true });
      if (response.success) {
        setPopularGames(prev =>
          prev.map(pg =>
            pg.game.igdbId === game.igdbId ? { ...pg, inLibrary: true } : pg
          )
        );
        invalidatePopularGamesCache();
        setSuccessMessage(`Added "${game.title}" to library`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(response.error || 'Failed to add game');
        setTimeout(() => setError(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      }
    } catch {
      setError('Failed to add game to library');
      setTimeout(() => setError(null), SUCCESS_MESSAGE_TIMEOUT_MS);
    } finally {
      setAddingGame(null);
    }
  }, []);

  const getPopularityTypeName = useCallback((id: number): string => {
    const type = popularityTypes.find(t => t.id === id);
    return type?.name || 'Unknown';
  }, [popularityTypes]);

  const getMultiplayerBadges = useCallback((mp: MultiplayerInfo | undefined): string[] => {
    if (!mp) return [];
    const badges: string[] = [];
    if (mp.hasOnlineCoop) badges.push('Online Co-op');
    if (mp.hasOfflineCoop) badges.push('Local Co-op');
    if (mp.hasSplitscreen) badges.push('Split-screen');
    if (mp.hasLanCoop) badges.push('LAN');
    if (mp.maxOnlinePlayers && mp.maxOnlinePlayers > 1) {
      badges.push(`${mp.maxOnlinePlayers} Players`);
    }
    return badges;
  }, []);

  // Memoized derived data
  const availableGenres = useMemo(() =>
    [...new Set(popularGames.flatMap(pg => pg.game.genres || []))].sort(),
    [popularGames]
  );

  const availableThemes = useMemo(() =>
    [...new Set(popularGames.flatMap(pg => pg.game.themes || []))].sort(),
    [popularGames]
  );

  const filteredGames = useMemo(() => popularGames.filter(pg => {
    if (selectedGenres.length > 0) {
      const gameGenres = pg.game.genres || [];
      if (!selectedGenres.some(g => gameGenres.includes(g))) return false;
    }
    if (selectedThemes.length > 0) {
      const gameThemes = pg.game.themes || [];
      if (!selectedThemes.some(t => gameThemes.includes(t))) return false;
    }
    if (multiplayerOnly && !pg.game.multiplayer) return false;
    return true;
  }), [popularGames, selectedGenres, selectedThemes, multiplayerOnly]);

  const activeFilterCount = useMemo(
    () => selectedGenres.length + selectedThemes.length + (multiplayerOnly ? 1 : 0),
    [selectedGenres.length, selectedThemes.length, multiplayerOnly]
  );

  // Filter handlers
  const clearFilters = useCallback(() => {
    setSelectedGenres([]);
    setSelectedThemes([]);
    setMultiplayerOnly(false);
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }, []);

  const toggleTheme = useCallback((theme: string) => {
    setSelectedThemes(prev =>
      prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme]
    );
  }, []);

  const handleToggleFilters = useCallback(() => setShowFilters(prev => !prev), []);
  const handleToggleMultiplayer = useCallback(() => setMultiplayerOnly(prev => !prev), []);

  // Modal handlers
  const handleModalGameSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalGameSearch.trim()) return;

    setIsSearchingGames(true);
    try {
      const response = await api.searchGames(modalGameSearch.trim());
      if (response.success && response.data) {
        setModalGameResults(response.data as GameSearchResult[]);
      }
    } catch {
      setError('Failed to search games');
    } finally {
      setIsSearchingGames(false);
    }
  }, [modalGameSearch]);

  const handleAddTorrentToLibrary = useCallback(async () => {
    if (!selectedGame || !selectedTorrent?.downloadUrl) return;

    setIsAddingToLibrary(true);
    try {
      const addResponse = await api.addGame({ igdbId: selectedGame.igdbId, monitored: true });

      if (!addResponse.success && !addResponse.error?.includes('already exists')) {
        setError(addResponse.error || 'Failed to add game');
        return;
      }

      let gameId: number;
      if (addResponse.success && addResponse.data) {
        gameId = addResponse.data.id;
      } else {
        const gamesResponse = await api.getGames();
        if (!gamesResponse.success || !gamesResponse.data) {
          setError('Failed to find game');
          return;
        }
        const existingGame = gamesResponse.data.find(g => g.igdbId === selectedGame.igdbId);
        if (!existingGame) {
          setError('Failed to find game');
          return;
        }
        gameId = existingGame.id;
      }

      const grabResponse = await api.grabRelease(gameId, {
        title: selectedTorrent.title,
        size: selectedTorrent.size,
        seeders: selectedTorrent.seeders,
        downloadUrl: selectedTorrent.downloadUrl,
        indexer: selectedTorrent.indexer,
        quality: selectedTorrent.quality,
      });

      if (grabResponse.success) {
        invalidatePopularGamesCache();
        setSuccessMessage(`Added "${selectedGame.title}" and started download!`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
        setSelectedTorrent(null);
        setSelectedGame(null);
        setModalGameSearch('');
        setModalGameResults([]);
      } else {
        setError(grabResponse.error || 'Failed to grab release');
      }
    } catch {
      setError('Failed to add to library');
    } finally {
      setIsAddingToLibrary(false);
    }
  }, [selectedGame, selectedTorrent]);

  const handleCloseModal = useCallback(() => {
    setSelectedTorrent(null);
    setSelectedGame(null);
    setModalGameSearch('');
    setModalGameResults([]);
  }, []);

  return {
    // Tab state
    activeTab,
    setActiveTab,

    // Loading states
    isLoading,
    isLoadingGames,
    isLoadingTorrents,

    // Messages
    error,
    successMessage,

    // Trending games state
    popularityTypes,
    selectedType,
    setSelectedType,
    popularGames,
    filteredGames,
    addingGame,

    // Filter state
    selectedGenres,
    selectedThemes,
    multiplayerOnly,
    showFilters,
    availableGenres,
    availableThemes,
    activeFilterCount,

    // Filter handlers
    toggleGenre,
    toggleTheme,
    clearFilters,
    handleToggleFilters,
    handleToggleMultiplayer,

    // Game handlers
    handleAddToLibrary,
    getPopularityTypeName,
    getMultiplayerBadges,

    // Torrent state
    torrents,
    torrentSearch,
    torrentSearchInput,
    setTorrentSearchInput,
    torrentMaxAge,
    setTorrentMaxAge,
    selectedTorrent,
    setSelectedTorrent,
    handleTorrentSearch,

    // Modal state
    modalGameSearch,
    setModalGameSearch,
    modalGameResults,
    selectedGame,
    setSelectedGame,
    isSearchingGames,
    isAddingToLibrary,
    handleModalGameSearch,
    handleAddTorrentToLibrary,
    handleCloseModal,
  };
}
