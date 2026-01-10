import { SearchResult, Release } from '../../api/client';
import { SearchMode } from './SearchTabs';
import { SortField, SortDirection } from './ReleasesTable';
import GameResultsList from './GameResultsList';
import ReleasesTable from './ReleasesTable';
import { SearchLoading, NoResults, EmptySearchState } from './SearchEmptyStates';

interface SearchResultsProps {
  searchMode: SearchMode;
  isLoading: boolean;
  hasSearched: boolean;
  query: string;
  // Games props
  gameResults: SearchResult[];
  addingGameId: number | null;
  selectedPlatforms: Record<number, string>;
  onPlatformChange: (igdbId: number, platform: string) => void;
  onAddGame: (game: SearchResult, searchReleases: boolean) => void;
  // Releases props
  releases: Release[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onGrab: (release: Release) => void;
}

function SearchResults({
  searchMode,
  isLoading,
  hasSearched,
  query,
  gameResults,
  addingGameId,
  selectedPlatforms,
  onPlatformChange,
  onAddGame,
  releases,
  sortField,
  sortDirection,
  onSort,
  onGrab,
}: SearchResultsProps) {
  if (isLoading) {
    return <SearchLoading searchMode={searchMode} />;
  }

  if (searchMode === 'games') {
    if (!hasSearched) {
      return <EmptySearchState searchMode="games" />;
    }
    if (gameResults.length === 0) {
      return <NoResults query={query} searchMode="games" />;
    }
    return (
      <GameResultsList
        results={gameResults}
        addingGameId={addingGameId}
        selectedPlatforms={selectedPlatforms}
        onPlatformChange={onPlatformChange}
        onAddGame={onAddGame}
      />
    );
  }

  // Releases mode
  if (!hasSearched) {
    return <EmptySearchState searchMode="releases" />;
  }
  if (releases.length === 0) {
    return <NoResults query={query} searchMode="releases" />;
  }
  return (
    <ReleasesTable
      releases={releases}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={onSort}
      onGrab={onGrab}
    />
  );
}

export default SearchResults;
