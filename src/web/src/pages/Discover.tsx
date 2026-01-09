import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatRelativeDate, formatBytes } from '../utils/formatters';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

type TabType = 'trending' | 'torrents';

interface TorrentFilters {
  releaseGroups: string[];
  platformTags: string[];
  languageTags: string[];
  otherPatterns: string[];
}

interface PopularityType {
  id: number;
  name: string;
  popularity_source: number;
}

interface MultiplayerInfo {
  hasOnlineCoop: boolean;
  hasOfflineCoop: boolean;
  hasLanCoop: boolean;
  hasSplitscreen: boolean;
  maxOnlinePlayers?: number;
  maxOfflinePlayers?: number;
  hasCampaignCoop: boolean;
  hasDropIn: boolean;
}

interface GameSearchResult {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  genres?: string[];
  themes?: string[];
  totalRating?: number;
  developer?: string;
  publisher?: string;
  multiplayer?: MultiplayerInfo;
}

interface PopularGame {
  game: GameSearchResult;
  popularityValue: number;
  popularityType: number;
  rank: number;
  inLibrary: boolean;
}

interface TorrentRelease {
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  leechers: number;
  publishedAt: string;
  downloadUrl?: string;
  infoUrl?: string;
  quality?: string;
}

function Discover() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL params
  const initialTab = (searchParams.get('tab') as TabType) || 'trending';
  const initialQuery = searchParams.get('q') || '';
  const initialAge = parseInt(searchParams.get('age') || '30', 10);
  const initialType = parseInt(searchParams.get('type') || '2', 10);

  const [activeTab, setActiveTabState] = useState<TabType>(initialTab);
  const [popularityTypes, setPopularityTypes] = useState<PopularityType[]>([]);
  const [selectedType, setSelectedTypeState] = useState<number>(initialType);
  const [popularGames, setPopularGames] = useState<PopularGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        // Fallback to basic filters if file not found
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

    // Remove version numbers like v1.0, v1.2.3
    cleaned = cleaned.replace(/\s*v\d+(\.\d+)*\s*/gi, ' ');

    // Remove file extensions
    cleaned = cleaned.replace(/\.(zip|rar|iso|exe|7z)$/i, '');

    // Remove year in parentheses at end
    cleaned = cleaned.replace(/\s*\(\d{4}\)\s*$/, '');

    // Apply filters from config
    const filters = torrentFiltersRef.current;
    if (filters) {
      const allPatterns = [
        ...filters.releaseGroups,
        ...filters.platformTags,
        ...filters.languageTags,
        ...filters.otherPatterns
      ];

      // Build regex pattern from all filter terms
      const patternStr = allPatterns.join('|');
      const filterRegex = new RegExp(`\\s*[\\[\\(]?(${patternStr})[\\]\\)]?\\s*`, 'gi');
      cleaned = cleaned.replace(filterRegex, ' ');
    }

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // If we stripped too much, fall back to text before first bracket
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
      const response = await api.getPopularityTypes();
      if (response.success && response.data) {
        setPopularityTypes(response.data as PopularityType[]);
      }
    } catch (err) {
      setError('Failed to load popularity types');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPopularGames = async (type: number) => {
    setIsLoadingGames(true);
    setError(null);
    try {
      const response = await api.getPopularGames(type, 50);
      if (response.success && response.data) {
        setPopularGames(response.data as PopularGame[]);
      } else {
        setError(response.error || 'Failed to load popular games');
      }
    } catch (err) {
      setError('Failed to load popular games');
    } finally {
      setIsLoadingGames(false);
    }
  };

  const loadTorrents = useCallback(async (query?: string) => {
    setIsLoadingTorrents(true);
    setError(null);
    try {
      const response = await api.getTopTorrents(query || 'game', 50, torrentMaxAge);
      if (response.success && response.data) {
        setTorrents(response.data as TorrentRelease[]);
        if (query) {
          setTorrentSearchWithUrl(query);
        }
      } else {
        setError(response.error || 'Failed to load torrents');
      }
    } catch (err) {
      setError('Failed to load torrents');
    } finally {
      setIsLoadingTorrents(false);
    }
  }, [torrentMaxAge, setTorrentSearchWithUrl]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, torrentMaxAge, loadTorrents]);

  // Pre-fill game search when torrent is selected
  useEffect(() => {
    if (selectedTorrent) {
      const gameName = cleanTorrentTitle(selectedTorrent.title);
      setModalGameSearch(gameName);

      // Auto-search
      const searchGames = async () => {
        if (!gameName) return;
        setIsSearchingGames(true);
        try {
          const response = await api.searchGames(gameName);
          if (response.success && response.data) {
            setModalGameResults(response.data as GameSearchResult[]);
          }
        } catch {
          // Silently fail - user can manually search
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
      const response = await api.addGame({
        igdbId: game.igdbId,
        monitored: true,
      });
      if (response.success) {
        // Update the local state to reflect the game is now in library
        setPopularGames(prev =>
          prev.map(pg =>
            pg.game.igdbId === game.igdbId
              ? { ...pg, inLibrary: true }
              : pg
          )
        );
        setSuccessMessage(`Added "${game.title}" to library`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(response.error || 'Failed to add game');
        setTimeout(() => setError(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      }
    } catch (err) {
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

  // Get unique genres and themes from loaded games (memoized)
  const availableGenres = useMemo(() =>
    [...new Set(popularGames.flatMap(pg => pg.game.genres || []))].sort(),
    [popularGames]
  );

  const availableThemes = useMemo(() =>
    [...new Set(popularGames.flatMap(pg => pg.game.themes || []))].sort(),
    [popularGames]
  );

  // Filter games (memoized)
  const filteredGames = useMemo(() => popularGames.filter(pg => {
    // Genre filter
    if (selectedGenres.length > 0) {
      const gameGenres = pg.game.genres || [];
      if (!selectedGenres.some(g => gameGenres.includes(g))) {
        return false;
      }
    }
    // Theme filter
    if (selectedThemes.length > 0) {
      const gameThemes = pg.game.themes || [];
      if (!selectedThemes.some(t => gameThemes.includes(t))) {
        return false;
      }
    }
    // Multiplayer filter
    if (multiplayerOnly && !pg.game.multiplayer) {
      return false;
    }
    return true;
  }), [popularGames, selectedGenres, selectedThemes, multiplayerOnly]);

  // Memoize active filter count
  const activeFilterCount = useMemo(
    () => selectedGenres.length + selectedThemes.length + (multiplayerOnly ? 1 : 0),
    [selectedGenres.length, selectedThemes.length, multiplayerOnly]
  );

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

  // Tab switching handlers
  const handleTabTrending = useCallback(() => setActiveTab('trending'), [setActiveTab]);
  const handleTabTorrents = useCallback(() => setActiveTab('torrents'), [setActiveTab]);

  // Toggle handlers
  const handleToggleFilters = useCallback(() => setShowFilters(prev => !prev), []);
  const handleToggleMultiplayer = useCallback(() => setMultiplayerOnly(prev => !prev), []);

  // Select handlers
  const handleSelectedTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(parseInt(e.target.value));
  }, [setSelectedType]);

  const handleTorrentMaxAgeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setTorrentMaxAge(parseInt(e.target.value));
  }, [setTorrentMaxAge]);

  const handleTorrentSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTorrentSearchInput(e.target.value);
  }, []);

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
    } catch (err) {
      setError('Failed to search games');
    } finally {
      setIsSearchingGames(false);
    }
  }, [modalGameSearch]);

  const handleAddTorrentToLibrary = useCallback(async () => {
    if (!selectedGame || !selectedTorrent?.downloadUrl) return;

    setIsAddingToLibrary(true);
    try {
      // First add the game to library
      const addResponse = await api.addGame({
        igdbId: selectedGame.igdbId,
        monitored: true,
      });

      if (!addResponse.success) {
        // Game might already exist, try to get it
        if (!addResponse.error?.includes('already exists')) {
          setError(addResponse.error || 'Failed to add game');
          return;
        }
      }

      // Get the game ID (either from the add response or fetch it)
      let gameId: number;
      if (addResponse.success && addResponse.data) {
        gameId = addResponse.data.id;
      } else {
        // Game already exists, fetch all games and find it
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

      // Now grab the release
      const grabResponse = await api.grabRelease(gameId, {
        title: selectedTorrent.title,
        size: selectedTorrent.size,
        seeders: selectedTorrent.seeders,
        downloadUrl: selectedTorrent.downloadUrl,
        indexer: selectedTorrent.indexer,
        quality: selectedTorrent.quality,
      });

      if (grabResponse.success) {
        setSuccessMessage(`Added "${selectedGame.title}" and started download!`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
        // Close modal and reset state
        setSelectedTorrent(null);
        setSelectedGame(null);
        setModalGameSearch('');
        setModalGameResults([]);
      } else {
        setError(grabResponse.error || 'Failed to grab release');
      }
    } catch (err) {
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold">Discover</h1>
          <p className="text-gray-400 mt-1">Browse popular games and trending releases</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        <button
          onClick={handleTabTrending}
          className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${
            activeTab === 'trending'
              ? 'text-blue-400 border-blue-400'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Trending Games
          </span>
        </button>
        <button
          onClick={handleTabTorrents}
          className={`px-4 py-2 font-medium transition border-b-2 -mb-px ${
            activeTab === 'torrents'
              ? 'text-blue-400 border-blue-400'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Top Torrents
          </span>
        </button>
      </div>

      {/* Trending Games Controls */}
      {activeTab === 'trending' && (
        <div className="flex justify-end items-center gap-4 mb-4">
          <button
            onClick={handleToggleFilters}
            className={`flex items-center gap-2 px-3 py-2 rounded border transition ${
              activeFilterCount > 0
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          <label className="text-sm text-gray-400">Ranked by:</label>
          <select
            value={selectedType}
            onChange={handleSelectedTypeChange}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            {popularityTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter Panel */}
      {activeTab === 'trending' && showFilters && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Genres */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Genres</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {availableGenres.map(genre => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={`text-xs px-2 py-1 rounded transition ${
                      selectedGenres.includes(genre)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
                {availableGenres.length === 0 && (
                  <span className="text-xs text-gray-500">No genres available</span>
                )}
              </div>
            </div>

            {/* Themes */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Themes</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {availableThemes.map(theme => (
                  <button
                    key={theme}
                    onClick={() => toggleTheme(theme)}
                    className={`text-xs px-2 py-1 rounded transition ${
                      selectedThemes.includes(theme)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
                {availableThemes.length === 0 && (
                  <span className="text-xs text-gray-500">No themes available</span>
                )}
              </div>
            </div>

            {/* Multiplayer */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Features</label>
              <button
                onClick={handleToggleMultiplayer}
                className={`text-xs px-2 py-1 rounded transition ${
                  multiplayerOnly
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Multiplayer Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="fixed top-4 left-4 bg-red-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {error}
        </div>
      )}

      {/* Trending Games Tab Content */}
      {activeTab === 'trending' && (
        <>
          {/* Loading state */}
          {isLoadingGames ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Results count */}
              <div className="mb-4 text-gray-400">
                Showing {filteredGames.length} of {popularGames.length} games ranked by {getPopularityTypeName(selectedType)}
                {activeFilterCount > 0 && (
                  <span className="ml-2 text-blue-400">
                    ({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)
                  </span>
                )}
              </div>

          {/* Games grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredGames.map((pg) => (
              <div
                key={pg.game.igdbId}
                className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition group relative"
              >
                {/* Rank badge */}
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded z-10">
                  #{pg.rank}
                </div>

                {/* In Library badge */}
                {pg.inLibrary && (
                  <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
                    In Library
                  </div>
                )}

                {/* Cover image */}
                <div className="aspect-[3/4] bg-gray-700 relative">
                  {pg.game.coverUrl ? (
                    <img
                      src={pg.game.coverUrl}
                      alt={pg.game.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      No Cover
                    </div>
                  )}

                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-2">
                    {!pg.inLibrary && (
                      <button
                        onClick={() => handleAddToLibrary(pg.game)}
                        disabled={addingGame === pg.game.igdbId}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm px-3 py-1.5 rounded w-full"
                      >
                        {addingGame === pg.game.igdbId ? 'Adding...' : 'Add to Library'}
                      </button>
                    )}
                    {pg.game.totalRating && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                        pg.game.totalRating >= 95 ? 'bg-sky-500' :
                        pg.game.totalRating >= 90 ? 'bg-green-700' :
                        pg.game.totalRating >= 85 ? 'bg-green-600' :
                        pg.game.totalRating >= 80 ? 'bg-green-500' :
                        pg.game.totalRating >= 70 ? 'bg-yellow-600' :
                        pg.game.totalRating >= 60 ? 'bg-orange-600' : 'bg-red-600'
                      }`}>
                        {pg.game.totalRating}%
                      </span>
                    )}
                    {pg.game.developer && (
                      <div className="text-gray-300 text-xs text-center truncate w-full">
                        {pg.game.developer}
                      </div>
                    )}
                  </div>
                </div>

                {/* Game info */}
                <div className="p-2">
                  <h3 className="font-medium text-sm truncate" title={pg.game.title}>
                    {pg.game.title}
                  </h3>
                  <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                    <span>{pg.game.year || 'TBA'}</span>
                    {pg.game.genres && pg.game.genres.length > 0 && (
                      <span className="truncate ml-2">{pg.game.genres[0]}</span>
                    )}
                  </div>
                  {/* Multiplayer badges */}
                  {pg.game.multiplayer && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {getMultiplayerBadges(pg.game.multiplayer).slice(0, 2).map((badge, i) => (
                        <span
                          key={i}
                          className="bg-purple-600/80 text-white text-[10px] px-1.5 py-0.5 rounded"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {filteredGames.length === 0 && !isLoadingGames && (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              {popularGames.length === 0 ? (
                <>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No games available</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    We couldn't find any games for this popularity ranking. This may be a temporary issue with IGDB. Try selecting a different ranking type.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No games match your filters</h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-4">
                    Try adjusting your genre, theme, or multiplayer filters to see more games.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-white"
                  >
                    Clear all filters
                  </button>
                </>
              )}
            </div>
          )}
            </>
          )}
        </>
      )}

      {/* Top Torrents Tab Content */}
      {activeTab === 'torrents' && (
        <>
          {/* Search bar and filters */}
          <form onSubmit={handleTorrentSearch} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={torrentSearchInput}
                onChange={handleTorrentSearchInputChange}
                placeholder="Search torrents (e.g., 'elden ring', 'cyberpunk')"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <select
                value={torrentMaxAge}
                onChange={handleTorrentMaxAgeChange}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value={7}>Last Week</option>
                <option value={30}>Last Month</option>
                <option value={90}>Last 3 Months</option>
                <option value={365}>Last Year</option>
                <option value={3650}>All Time</option>
              </select>
              <button
                type="submit"
                disabled={isLoadingTorrents}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded text-white"
              >
                Search
              </button>
            </div>
            {torrentSearch && (
              <p className="text-sm text-gray-400 mt-2">
                Showing results for: <span className="text-blue-400">{torrentSearch}</span>
              </p>
            )}
          </form>

          {/* Loading state */}
          {isLoadingTorrents ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Results count */}
              <div className="mb-4 text-gray-400">
                Showing {torrents.length} torrents from the{' '}
                {torrentMaxAge === 7 ? 'last week' :
                 torrentMaxAge === 30 ? 'last month' :
                 torrentMaxAge === 90 ? 'last 3 months' :
                 torrentMaxAge === 365 ? 'last year' : 'all time'}{' '}
                sorted by seeders
              </div>

              {/* Torrents table */}
              {torrents.length > 0 ? (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Title</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-300 w-24">Size</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-gray-300 w-20">
                          <span className="flex items-center justify-center gap-1">
                            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            S
                          </span>
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-gray-300 w-20">
                          <span className="flex items-center justify-center gap-1">
                            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            L
                          </span>
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-300 w-32">Indexer</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-300 w-28">Age</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {torrents.map((torrent, index) => (
                        <tr key={index} className="hover:bg-gray-700/50 transition">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <button
                                onClick={() => setSelectedTorrent(torrent)}
                                className="text-sm text-white truncate max-w-xl text-left hover:text-blue-400 transition"
                                title={torrent.title}
                              >
                                {torrent.title}
                              </button>
                              {torrent.quality && (
                                <span className="text-xs text-blue-400 mt-0.5">{torrent.quality}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">{formatBytes(torrent.size)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-medium ${torrent.seeders >= 10 ? 'text-green-400' : torrent.seeders >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {torrent.seeders}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-400">{torrent.leechers}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">{torrent.indexer}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{formatRelativeDate(torrent.publishedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No torrents found</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Try searching for a specific game or make sure Prowlarr is configured and connected.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Torrent Details Modal */}
      {selectedTorrent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white pr-4 break-words">
                {selectedTorrent.title}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-white transition flex-shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Quality Badge */}
              {selectedTorrent.quality && (
                <div>
                  <span className="inline-block bg-blue-600 text-white text-sm px-3 py-1 rounded">
                    {selectedTorrent.quality}
                  </span>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Indexer</div>
                  <div className="text-white font-medium">{selectedTorrent.indexer}</div>
                </div>
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Size</div>
                  <div className="text-white font-medium">{formatBytes(selectedTorrent.size)}</div>
                </div>
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Seeders</div>
                  <div className={`font-medium ${selectedTorrent.seeders >= 10 ? 'text-green-400' : selectedTorrent.seeders >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {selectedTorrent.seeders}
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">Leechers</div>
                  <div className="text-white font-medium">{selectedTorrent.leechers}</div>
                </div>
                <div className="bg-gray-700/50 rounded p-3 col-span-2">
                  <div className="text-xs text-gray-400 mb-1">Published</div>
                  <div className="text-white font-medium">
                    {formatRelativeDate(selectedTorrent.publishedAt)}
                    <span className="text-gray-400 text-sm ml-2">
                      ({new Date(selectedTorrent.publishedAt).toLocaleDateString()})
                    </span>
                  </div>
                </div>
              </div>

              {/* View on Indexer Link */}
              {selectedTorrent.infoUrl && (
                <a
                  href={selectedTorrent.infoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View on Indexer
                </a>
              )}

              {/* Game Search Section */}
              <div className="border-t border-gray-700 pt-4 mt-2">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Add to Library</h4>
                <p className="text-xs text-gray-500 mb-3">Search for a game to assign this torrent to:</p>

                <form onSubmit={handleModalGameSearch} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={modalGameSearch}
                    onChange={(e) => setModalGameSearch(e.target.value)}
                    placeholder="Search for a game..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingGames || !modalGameSearch.trim()}
                    className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-2 rounded text-sm transition"
                  >
                    {isSearchingGames ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {/* Game Search Results */}
                {modalGameResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                    {modalGameResults.map((game) => (
                      <button
                        key={game.igdbId}
                        onClick={() => setSelectedGame(game)}
                        className={`w-full flex items-center gap-3 p-2 rounded transition text-left ${
                          selectedGame?.igdbId === game.igdbId
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        }`}
                      >
                        {game.coverUrl ? (
                          <img src={game.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-14 bg-gray-600 rounded flex items-center justify-center text-gray-500 text-xs">
                            N/A
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{game.title}</div>
                          <div className="text-xs opacity-75">
                            {game.year || 'TBA'}
                            {game.developer && ` • ${game.developer}`}
                          </div>
                        </div>
                        {selectedGame?.igdbId === game.igdbId && (
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Game Display */}
                {selectedGame && (
                  <div className="bg-green-900/30 border border-green-700 rounded p-3 mb-3">
                    <div className="text-xs text-green-400 mb-1">Selected Game:</div>
                    <div className="font-medium text-white">{selectedGame.title} ({selectedGame.year || 'TBA'})</div>
                  </div>
                )}

                {/* Add to Library Button */}
                <button
                  onClick={handleAddTorrentToLibrary}
                  disabled={!selectedGame || !selectedTorrent.downloadUrl || isAddingToLibrary}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded transition"
                >
                  {isAddingToLibrary ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add to Library & Download
                    </>
                  )}
                </button>
                {!selectedGame && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Search and select a game above to enable downloading
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-4 border-t border-gray-700">
              <button
                onClick={handleCloseModal}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Discover;
