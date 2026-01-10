export type SearchMode = 'games' | 'releases';

interface SearchTabsProps {
  searchMode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

function SearchTabs({ searchMode, onModeChange }: SearchTabsProps) {
  return (
    <div className="border-b border-gray-700 mb-6 -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-1">
        <button
          onClick={() => onModeChange('games')}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px min-h-[44px] ${
            searchMode === 'games'
              ? 'text-blue-400 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
          }`}
        >
          Games
        </button>
        <button
          onClick={() => onModeChange('releases')}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px min-h-[44px] ${
            searchMode === 'releases'
              ? 'text-blue-400 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
          }`}
        >
          Releases
        </button>
      </div>
    </div>
  );
}

export default SearchTabs;
