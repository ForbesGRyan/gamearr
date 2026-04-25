import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';

const route = getRouteApi('/_auth/discover');
import { api } from '../../api/client';
import { unwrap } from '../../queries/unwrap';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../../utils/constants';
import { pickPreferredPlatform } from '../../utils/platform';
import {
  usePopularityTypes,
  usePopularGames,
  useTopTorrents,
  useAddGame,
  useGrabRelease,
  queryKeys,
} from '../../queries';
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
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();

  // Read initial values from URL params
  const initialQuery = search.q ?? '';
  const initialAge = search.age ?? 30;
  const initialType = search.type ?? 2;

  const activeTab: TabType = search.tab ?? 'trending';
  const [selectedType, setSelectedTypeState] = useState<number>(initialType);
  const [error, setError] = useState<string | null>(null);
  const [addingGame, setAddingGame] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<number, string>>({});

  // Optimistic in-library overlay (tracks igdbIds added in this session)
  const [inLibraryOverrides, setInLibraryOverrides] = useState<Set<number>>(
    () => new Set()
  );

  // Filters
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [multiplayerOnly, setMultiplayerOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Torrents state
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

  // ---- TanStack Query hooks ----
  const popularityTypesQuery = usePopularityTypes();
  const popularityTypes = useMemo<PopularityType[]>(
    () => (popularityTypesQuery.data as PopularityType[] | undefined) ?? [],
    [popularityTypesQuery.data]
  );

  const popularGamesQuery = usePopularGames(
    activeTab === 'trending' ? selectedType : undefined,
    50
  );
  const popularGamesData = useMemo<PopularGame[]>(
    () => (popularGamesQuery.data as PopularGame[] | undefined) ?? [],
    [popularGamesQuery.data]
  );

  // Apply optimistic "in library" overrides without mutating cache
  const popularGames = useMemo<PopularGame[]>(() => {
    if (inLibraryOverrides.size === 0) return popularGamesData;
    return popularGamesData.map(pg =>
      inLibraryOverrides.has(pg.game.igdbId) ? { ...pg, inLibrary: true } : pg
    );
  }, [popularGamesData, inLibraryOverrides]);

  const trimmedTorrentSearch = torrentSearch.trim();
  const topTorrentsQuery = useTopTorrents(
    trimmedTorrentSearch || undefined,
    50,
    torrentMaxAge
  );
  const torrents: TorrentRelease[] =
    (topTorrentsQuery.data as TorrentRelease[] | undefined) ?? [];

  const isLoading = popularityTypesQuery.isLoading;
  const isLoadingGames = popularGamesQuery.isFetching && activeTab === 'trending';
  const isLoadingTorrents = topTorrentsQuery.isFetching && activeTab === 'torrents';

  // Surface query errors into the error banner
  useEffect(() => {
    if (popularityTypesQuery.error) {
      setError('Failed to load popularity types');
    }
  }, [popularityTypesQuery.error]);

  useEffect(() => {
    if (popularGamesQuery.error && activeTab === 'trending') {
      setError(
        popularGamesQuery.error instanceof Error
          ? popularGamesQuery.error.message
          : 'Failed to load popular games'
      );
    }
  }, [popularGamesQuery.error, activeTab]);

  useEffect(() => {
    if (topTorrentsQuery.error && activeTab === 'torrents') {
      setError(
        topTorrentsQuery.error instanceof Error
          ? topTorrentsQuery.error.message
          : 'Failed to load torrents'
      );
    }
  }, [topTorrentsQuery.error, activeTab]);

  // Add-game mutation
  const addGameMutation = useAddGame();
  const grabReleaseMutation = useGrabRelease();

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

  // Wrapped setters that update URL
  const setActiveTab = useCallback((tab: TabType) => {
    navigate({
      search: (prev) => ({ ...prev, tab: tab === 'trending' ? undefined : tab }),
      replace: true,
    });
  }, [navigate]);

  const setSelectedType = useCallback((type: number) => {
    setSelectedTypeState(type);
    navigate({
      search: (prev) => ({ ...prev, type: type === 2 ? undefined : type }),
      replace: true,
    });
  }, [navigate]);

  const setTorrentMaxAge = useCallback((age: number) => {
    setTorrentMaxAgeState(age);
    navigate({
      search: (prev) => ({ ...prev, age: age === 30 ? undefined : age }),
      replace: true,
    });
  }, [navigate]);

  const setTorrentSearchWithUrl = useCallback((query: string) => {
    setTorrentSearch(query);
    navigate({
      search: (prev) => ({ ...prev, q: query || undefined }),
      replace: true,
    });
  }, [navigate]);

  const handleTorrentSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = torrentSearchInput.trim();
    if (trimmed) {
      setTorrentSearchWithUrl(trimmed);
    }
  }, [torrentSearchInput, setTorrentSearchWithUrl]);

  // Pre-fill game search when torrent is selected
  useEffect(() => {
    if (selectedTorrent) {
      const gameName = cleanTorrentTitle(selectedTorrent.title);
      setModalGameSearch(gameName);

      const runSearch = async () => {
        if (!gameName) return;
        setIsSearchingGames(true);
        try {
          const data = await queryClient.fetchQuery({
            queryKey: queryKeys.search.games(gameName),
            queryFn: async () => unwrap(await api.searchGames(gameName)),
          });
          setModalGameResults(data as GameSearchResult[]);
        } catch {
          // Silently fail
        } finally {
          setIsSearchingGames(false);
        }
      };
      runSearch();
    }
  }, [selectedTorrent, cleanTorrentTitle, queryClient]);

  const invalidatePopularGames = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.discover.all });
  }, [queryClient]);

  const handlePlatformChange = useCallback((igdbId: number, platform: string) => {
    setSelectedPlatforms(prev => ({ ...prev, [igdbId]: platform }));
  }, []);

  const handleAddToLibrary = useCallback(async (game: GameSearchResult) => {
    setAddingGame(game.igdbId);
    try {
      const platform =
        selectedPlatforms[game.igdbId] || pickPreferredPlatform(game.platforms);
      await addGameMutation.mutateAsync({
        igdbId: game.igdbId,
        monitored: true,
        platform,
      });
      setInLibraryOverrides(prev => {
        const next = new Set(prev);
        next.add(game.igdbId);
        return next;
      });
      invalidatePopularGames();
      setSuccessMessage(`Added "${game.title}" to library`);
      setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add game to library');
      setTimeout(() => setError(null), SUCCESS_MESSAGE_TIMEOUT_MS);
    } finally {
      setAddingGame(null);
    }
  }, [addGameMutation, invalidatePopularGames, selectedPlatforms]);

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

    const trimmed = modalGameSearch.trim();
    setIsSearchingGames(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.search.games(trimmed),
        queryFn: async () => unwrap(await api.searchGames(trimmed)),
      });
      setModalGameResults(data as GameSearchResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search games');
    } finally {
      setIsSearchingGames(false);
    }
  }, [modalGameSearch, queryClient]);

  const handleAddTorrentToLibrary = useCallback(async () => {
    if (!selectedGame || !selectedTorrent?.downloadUrl) return;

    setIsAddingToLibrary(true);
    try {
      let gameId: number | null = null;
      try {
        const added = await addGameMutation.mutateAsync({
          igdbId: selectedGame.igdbId,
          monitored: true,
        });
        gameId = added.id;
      } catch (addErr) {
        const message = addErr instanceof Error ? addErr.message : '';
        if (!message.includes('already exists')) {
          setError(message || 'Failed to add game');
          return;
        }
      }

      if (gameId === null) {
        const games = await queryClient.fetchQuery({
          queryKey: queryKeys.games.list(),
          queryFn: async () => unwrap(await api.getGames()),
        });
        const existingGame = games.find(g => g.igdbId === selectedGame.igdbId);
        if (!existingGame) {
          setError('Failed to find game');
          return;
        }
        gameId = existingGame.id;
      }

      try {
        await grabReleaseMutation.mutateAsync({
          gameId,
          release: {
            title: selectedTorrent.title,
            size: selectedTorrent.size,
            seeders: selectedTorrent.seeders,
            downloadUrl: selectedTorrent.downloadUrl,
            indexer: selectedTorrent.indexer,
            quality: selectedTorrent.quality,
          },
        });
        invalidatePopularGames();
        setSuccessMessage(`Added "${selectedGame.title}" and started download!`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
        setSelectedTorrent(null);
        setSelectedGame(null);
        setModalGameSearch('');
        setModalGameResults([]);
      } catch (grabErr) {
        setError(grabErr instanceof Error ? grabErr.message : 'Failed to grab release');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to library');
    } finally {
      setIsAddingToLibrary(false);
    }
  }, [selectedGame, selectedTorrent, addGameMutation, grabReleaseMutation, invalidatePopularGames, queryClient]);

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
    selectedPlatforms,
    handlePlatformChange,

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
