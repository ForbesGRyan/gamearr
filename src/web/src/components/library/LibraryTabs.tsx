import { useNavigate } from 'react-router-dom';

type Tab = 'games' | 'scan' | 'health';

interface LibraryTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  libraryFoldersCount: number | null;
  healthIssuesCount: number | null;
}

export function LibraryTabs({
  activeTab,
  onTabChange,
  libraryFoldersCount,
  healthIssuesCount,
}: LibraryTabsProps) {
  const navigate = useNavigate();

  const handleTabChange = (tab: Tab) => {
    // Use navigate with viewTransition for smooth tab transitions
    const url = tab === 'games' ? '/' : `/?tab=${tab}`;
    navigate(url, { viewTransition: true });
    onTabChange(tab);
  };

  return (
    <div className="mb-6 border-b border-gray-700">
      <div className="flex gap-1 md:gap-4">
        <button
          onClick={() => handleTabChange('games')}
          className={`px-4 py-3 min-h-[44px] border-b-2 transition ${
            activeTab === 'games'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Games
        </button>
        <button
          onClick={() => handleTabChange('scan')}
          className={`px-4 py-3 min-h-[44px] border-b-2 transition ${
            activeTab === 'scan'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Import
          {libraryFoldersCount !== null && libraryFoldersCount > 0 && (
            <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {libraryFoldersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('health')}
          className={`px-4 py-3 min-h-[44px] border-b-2 transition ${
            activeTab === 'health'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Health
          {healthIssuesCount !== null && healthIssuesCount > 0 && (
            <span className="ml-2 bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full">
              {healthIssuesCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
