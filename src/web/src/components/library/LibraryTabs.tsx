type Tab = 'games' | 'scan' | 'health';

interface LibraryTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  libraryFoldersCount: number;
  healthIssuesCount: number;
}

export function LibraryTabs({
  activeTab,
  onTabChange,
  libraryFoldersCount,
  healthIssuesCount,
}: LibraryTabsProps) {
  return (
    <div className="mb-6 border-b border-gray-700">
      <div className="flex gap-4">
        <button
          onClick={() => onTabChange('games')}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'games'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Games
        </button>
        <button
          onClick={() => onTabChange('scan')}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'scan'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Import
          {libraryFoldersCount > 0 && (
            <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {libraryFoldersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onTabChange('health')}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'health'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Health
          {healthIssuesCount > 0 && (
            <span className="ml-2 bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full">
              {healthIssuesCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
