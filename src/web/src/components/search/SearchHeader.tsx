import { SearchMode } from './SearchTabs';

interface SearchHeaderProps {
  searchMode: SearchMode;
}

function SearchHeader({ searchMode }: SearchHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl md:text-3xl font-bold mb-2">Search</h2>
      <p className="text-gray-400 text-sm md:text-base">
        {searchMode === 'games'
          ? 'Search for games on IGDB to add to your library'
          : 'Search for game releases across all configured indexers'}
      </p>
    </div>
  );
}

export default SearchHeader;
