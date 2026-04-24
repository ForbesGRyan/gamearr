import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Release, SearchResult } from '../api/client';
import {
  useSearchGames,
  useManualSearchReleases,
  useAddGame,
  useUpdateGameStores,
  useGrabRelease,
} from '../queries';
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

  // Derive search mode directly from URL - single source of truth
  const searchMode: SearchMode = searchParams.get('tab') === 'releases' ? 'releases' : 'games';

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [errorOverride, setErrorOverride] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Games search state
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<number, string>>({});

  // Releases search state
  const [sortField, setSortField] = useState<SortField>('seeders');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  const gamesSearchQuery = useSearchGames(submittedQuery, {
    enabled: searchMode === 'games' && submittedQuery.trim().length > 0,
  });
  const releasesSearchQuery = useManualSearchReleases(submittedQuery, {
    enabled: searchMode === 'releases' && submittedQuery.trim().length > 0,
  });

  const addGameMutation = useAddGame();
  const updateStoresMutation = useUpdateGameStores();
  const grabReleaseMutation = useGrabRelease();

  const gameResults = (gamesSearchQuery.data ?? []) as SearchResult[];
  const releases = (releasesSearchQuery.data ?? []) as Release[];

  const isLoading =
    searchMode === 'games'
      ? gamesSearchQuery.isFetching
      : releasesSearchQuery.isFetching;

  const activeQueryError =
    searchMode === 'games' ? gamesSearchQuery.error : releasesSearchQuery.error;
  const queryErrorMessage = activeQueryError
    ? ((activeQueryError as Error).message ||
        `Failed to search for ${searchMode}`)
    : null;
  const error = errorOverride ?? queryErrorMessage;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setErrorOverride('Please enter a search query');
      return;
    }

    setErrorOverride(null);
    setHasSearched(true);
    setSubmittedQuery(query.trim());
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchParams({ tab: mode });
    setHasSearched(false);
    setSubmittedQuery('');
    setErrorOverride(null);
    setSuccessMessage(null);
  };

  const handleAddGame = async (game: SearchResult, shouldSearchReleases: boolean = false) => {
    setAddingGameId(game.igdbId);
    setErrorOverride(null);
    const platform = selectedPlatforms[game.igdbId] || game.platforms?.[0];

    try {
      // Add the game first (using first store for legacy field)
      const added = await addGameMutation.mutateAsync({
        igdbId: game.igdbId,
        monitored: true,
        store: selectedStores[0] || null,
        libraryId: selectedLibraryId ?? undefined,
        platform,
      });

      // If multiple stores selected, update stores via the dedicated endpoint
      if (selectedStores.length > 0) {
        await updateStoresMutation.mutateAsync({
          id: added.id,
          stores: selectedStores,
        });
      }

      setSuccessMessage(`Added "${game.title}" to your library`);
      setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      if (shouldSearchReleases) {
        navigate(getGameDetailPath(added.platform, added.title));
      }
    } catch (err) {
      setErrorOverride(
        err instanceof Error && err.message ? err.message : 'Failed to add game'
      );
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
    setErrorOverride(null);
    setSuccessMessage(null);
  };

  const handleGameSelected = async (gameId: number) => {
    if (!selectedRelease) return;
    const release = selectedRelease;

    try {
      await grabReleaseMutation.mutateAsync({ gameId, release });
      setSuccessMessage(`Successfully grabbed "${release.title}"`);
      setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
    } catch (err) {
      setErrorOverride(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to grab release'
      );
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
        selectedStores={selectedStores}
        onStoresChange={setSelectedStores}
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
