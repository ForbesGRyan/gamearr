import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, Release, SearchResult } from '../api/client';
import GameSelectionModal from '../components/GameSelectionModal';
import { getGameDetailPath } from '../utils/slug';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';
import {
  SearchHeader,
  SearchTabs,
  SearchForm,
  SearchResults,
  ErrorMessage,
  SuccessMessage,
  SearchMode,
  SortField,
  SortDirection,
} from '../components/search';

function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial mode from URL params, default to 'games'
  const initialMode = (searchParams.get('tab') as SearchMode) || 'games';
  const [searchMode, setSearchMode] = useState<SearchMode>(
    initialMode === 'releases' ? 'releases' : 'games'
  );

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Sync mode with URL params (for back/forward navigation)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as SearchMode;
    if (tabParam === 'releases' && searchMode !== 'releases') {
      setSearchMode('releases');
      setHasSearched(false);
      setGameResults([]);
      setReleases([]);
    } else if (tabParam !== 'releases' && searchMode === 'releases') {
      setSearchMode('games');
      setHasSearched(false);
      setGameResults([]);
      setReleases([]);
    }
  }, [searchParams]);

  // Games search state
  const [gameResults, setGameResults] = useState<SearchResult[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<number, string>>({});

  // Releases search state
  const [releases, setReleases] = useState<Release[]>([]);
  const [sortField, setSortField] = useState<SortField>('seeders');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      if (searchMode === 'games') {
        const response = await api.searchGames(query);
        if (response.success && response.data) {
          setGameResults(response.data);
        } else {
          setError(response.error || 'Failed to search for games');
          setGameResults([]);
        }
      } else {
        const response = await api.manualSearchReleases(query);
        if (response.success && response.data) {
          setReleases(response.data);
        } else {
          setError(response.error || 'Failed to search for releases');
          setReleases([]);
        }
      }
    } catch {
      setError(`Failed to search for ${searchMode}`);
      searchMode === 'games' ? setGameResults([]) : setReleases([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearchParams({ tab: mode });
    setHasSearched(false);
    setGameResults([]);
    setReleases([]);
    setError(null);
    setSuccessMessage(null);
  };

  const handleAddGame = async (game: SearchResult, shouldSearchReleases: boolean = false) => {
    setAddingGameId(game.igdbId);
    setError(null);
    const platform = selectedPlatforms[game.igdbId] || game.platforms?.[0];

    try {
      const response = await api.addGame({
        igdbId: game.igdbId,
        monitored: true,
        store: selectedStore,
        libraryId: selectedLibraryId ?? undefined,
        platform,
      });

      if (response.success && response.data) {
        setSuccessMessage(`Added "${game.title}" to your library`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
        if (shouldSearchReleases) {
          navigate(getGameDetailPath(response.data.platform, response.data.title));
        }
      } else {
        setError(response.error || 'Failed to add game');
      }
    } catch {
      setError('Failed to add game');
    } finally {
      setAddingGameId(null);
    }
  };

  const handlePlatformChange = (igdbId: number, platform: string) => {
    setSelectedPlatforms((prev) => ({ ...prev, [igdbId]: platform }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleGrabRelease = (release: Release) => {
    setSelectedRelease(release);
    setIsGameModalOpen(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleGameSelected = async (gameId: number) => {
    if (!selectedRelease) return;
    try {
      const response = await api.grabRelease(gameId, selectedRelease);
      if (response.success) {
        setSuccessMessage(`Successfully grabbed "${selectedRelease.title}"`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(response.error || 'Failed to grab release');
      }
    } catch {
      setError('Failed to grab release');
    } finally {
      setSelectedRelease(null);
    }
  };

  return (
    <div>
      <SearchHeader searchMode={searchMode} />
      <SearchTabs searchMode={searchMode} onModeChange={handleModeChange} />
      <SearchForm
        query={query}
        onQueryChange={setQuery}
        onSubmit={handleSearch}
        isLoading={isLoading}
        searchMode={searchMode}
        selectedStore={selectedStore}
        onStoreChange={setSelectedStore}
        selectedLibraryId={selectedLibraryId}
        onLibraryChange={setSelectedLibraryId}
      />

      {error && <ErrorMessage message={error} />}
      {successMessage && <SuccessMessage message={successMessage} />}

      <SearchResults
        searchMode={searchMode}
        isLoading={isLoading}
        hasSearched={hasSearched}
        query={query}
        gameResults={gameResults}
        addingGameId={addingGameId}
        selectedPlatforms={selectedPlatforms}
        onPlatformChange={handlePlatformChange}
        onAddGame={handleAddGame}
        releases={releases}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onGrab={handleGrabRelease}
      />

      <GameSelectionModal
        isOpen={isGameModalOpen}
        onClose={() => {
          setIsGameModalOpen(false);
          setSelectedRelease(null);
        }}
        onSelect={handleGameSelected}
        releaseName={selectedRelease?.title || ''}
      />
    </div>
  );
}

export default Search;
