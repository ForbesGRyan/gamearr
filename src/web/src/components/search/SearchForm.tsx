import StoreSelector from '../StoreSelector';
import LibrarySelector from '../LibrarySelector';
import { SearchMode } from './SearchTabs';

interface SearchFormProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  searchMode: SearchMode;
  selectedStores: string[];
  onStoresChange: (stores: string[]) => void;
  selectedLibraryId: number | null;
  onLibraryChange: (libraryId: number | null) => void;
}

function SearchForm({
  query,
  onQueryChange,
  onSubmit,
  isLoading,
  searchMode,
  selectedStores,
  onStoresChange,
  selectedLibraryId,
  onLibraryChange,
}: SearchFormProps) {
  return (
    <form onSubmit={onSubmit} className="mb-6">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={
              searchMode === 'games'
                ? 'Search for games on IGDB...'
                : 'Search for releases, keywords...'
            }
            className="w-full pl-10 pr-4 py-3 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Games mode options */}
      {searchMode === 'games' && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <StoreSelector
              value={selectedStores}
              onChange={onStoresChange}
              label="Digital Stores (Optional)"
            />
            <p className="text-xs text-gray-400 mt-1">
              If you select stores, the game will be marked as already owned.
            </p>
          </div>
          <LibrarySelector
            value={selectedLibraryId}
            onChange={onLibraryChange}
            label="Library (Optional)"
            optional={true}
          />
        </div>
      )}
    </form>
  );
}

export default SearchForm;
