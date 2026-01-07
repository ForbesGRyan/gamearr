import { useState, useEffect } from 'react';
import { api } from '../api/client';

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

function Discover() {
  const [popularityTypes, setPopularityTypes] = useState<PopularityType[]>([]);
  const [selectedType, setSelectedType] = useState<number>(2); // Default to "Want to Play"
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

  // Load popularity types on mount
  useEffect(() => {
    loadPopularityTypes();
  }, []);

  // Load games when type changes
  useEffect(() => {
    if (selectedType) {
      loadPopularGames(selectedType);
    }
  }, [selectedType]);

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

  const handleAddToLibrary = async (game: GameSearchResult) => {
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
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.error || 'Failed to add game');
        setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      setError('Failed to add game to library');
      setTimeout(() => setError(null), 5000);
    } finally {
      setAddingGame(null);
    }
  };

  const getPopularityTypeName = (id: number): string => {
    const type = popularityTypes.find(t => t.id === id);
    return type?.name || 'Unknown';
  };

  const getMultiplayerBadges = (mp: MultiplayerInfo | undefined): string[] => {
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
  };

  // Get unique genres and themes from loaded games
  const availableGenres = [...new Set(popularGames.flatMap(pg => pg.game.genres || []))].sort();
  const availableThemes = [...new Set(popularGames.flatMap(pg => pg.game.themes || []))].sort();

  // Filter games
  const filteredGames = popularGames.filter(pg => {
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
  });

  const activeFilterCount = selectedGenres.length + selectedThemes.length + (multiplayerOnly ? 1 : 0);

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedThemes([]);
    setMultiplayerOnly(false);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleTheme = (theme: string) => {
    setSelectedThemes(prev =>
      prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme]
    );
  };

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
          <p className="text-gray-400 mt-1">Browse popular games from IGDB</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
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
            onChange={(e) => setSelectedType(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            {popularityTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
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
                onClick={() => setMultiplayerOnly(!multiplayerOnly)}
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
                      <div className="text-yellow-400 text-sm">
                        ⭐ {pg.game.totalRating}%
                      </div>
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
            <div className="text-center py-12 text-gray-400">
              {popularGames.length === 0 ? (
                <p>No games found for this popularity type.</p>
              ) : (
                <>
                  <p>No games match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-blue-400 hover:text-blue-300"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Discover;
