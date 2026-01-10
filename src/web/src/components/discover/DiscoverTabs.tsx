import { TabType } from './types';

interface DiscoverTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function DiscoverTabs({ activeTab, onTabChange }: DiscoverTabsProps) {
  return (
    <div className="flex border-b border-gray-700 mb-4 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-hide">
      <button
        onClick={() => onTabChange('trending')}
        className={`px-4 py-2 font-medium transition border-b-2 -mb-px whitespace-nowrap min-h-[44px] ${
          activeTab === 'trending'
            ? 'text-blue-400 border-blue-400'
            : 'text-gray-400 border-transparent hover:text-gray-300'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Trending Games
        </span>
      </button>
      <button
        onClick={() => onTabChange('torrents')}
        className={`px-4 py-2 font-medium transition border-b-2 -mb-px whitespace-nowrap min-h-[44px] ${
          activeTab === 'torrents'
            ? 'text-blue-400 border-blue-400'
            : 'text-gray-400 border-transparent hover:text-gray-300'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Top Torrents
        </span>
      </button>
    </div>
  );
}
