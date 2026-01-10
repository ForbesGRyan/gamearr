import { GamepadIcon } from '../Icons';
import { SearchMode } from './SearchTabs';

interface SearchLoadingProps {
  searchMode: SearchMode;
}

export function SearchLoading({ searchMode }: SearchLoadingProps) {
  return (
    <div className="text-center py-12">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-400 text-lg">
        {searchMode === 'games' ? 'Searching IGDB...' : 'Searching indexers...'}
      </p>
    </div>
  );
}

interface NoResultsProps {
  query: string;
  searchMode: SearchMode;
}

export function NoResults({ query, searchMode }: NoResultsProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          className="w-full h-full"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-300 mb-2">
        No {searchMode === 'games' ? 'games' : 'releases'} found
      </h3>
      <p className="text-gray-500 max-w-md mx-auto">
        {searchMode === 'games'
          ? `We couldn't find any games matching "${query}" on IGDB. Try different search terms.`
          : `We couldn't find any releases for "${query}". Try different search terms, check your Prowlarr configuration, or the game may not be available on your indexers.`}
      </p>
    </div>
  );
}

interface EmptySearchStateProps {
  searchMode: SearchMode;
}

export function EmptySearchState({ searchMode }: EmptySearchStateProps) {
  if (searchMode === 'games') {
    return (
      <div className="bg-gray-800 rounded-lg p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
          <GamepadIcon className="w-full h-full" />
        </div>
        <h3 className="text-xl font-medium text-gray-300 mb-2">Search for games</h3>
        <p className="text-gray-500 mb-6">
          Enter a game title above to search IGDB and add it to your library
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          className="w-full h-full"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-300 mb-2">Ready to search</h3>
      <p className="text-gray-500 mb-6">
        Enter a game title or keywords above to search across all your configured indexers
      </p>
    </div>
  );
}
