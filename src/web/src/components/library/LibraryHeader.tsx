import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../queries/keys';
import type { PosterSize, ViewMode } from './types';

type Tab = 'games' | 'scan' | 'health';

interface LibraryHeaderProps {
  gamesCount: number;
  activeTab: Tab;
  viewMode: ViewMode;
  posterSize: PosterSize;
  isScanning: boolean;
  isHealthLoading: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onPosterSizeChange: (size: PosterSize) => void;
  onAddGame: () => void;
  onScanLibrary: () => void;
}

export function LibraryHeader({
  gamesCount,
  activeTab,
  viewMode,
  posterSize,
  isScanning,
  isHealthLoading,
  onViewModeChange,
  onPosterSizeChange,
  onAddGame,
  onScanLibrary,
}: LibraryHeaderProps) {
  const queryClient = useQueryClient();
  const handleRefreshHealth = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.libraries.duplicates() });
    queryClient.invalidateQueries({ queryKey: queryKeys.libraries.looseFiles() });
    queryClient.invalidateQueries({ queryKey: queryKeys.libraries.healthCount() });
  };
  const showPosterSizeRow = activeTab === 'games' && viewMode === 'posters';

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Library</h2>
          <p className="text-gray-400 mt-1 text-sm md:text-base">
            {gamesCount} {gamesCount === 1 ? 'game' : 'games'} in library
          </p>
        </div>
        <div className="flex gap-2 sm:gap-4 items-center">
          {/* View Mode Toggle - only show on games tab */}
          {activeTab === 'games' && (
            <div className="flex bg-gray-700 rounded overflow-hidden">
              <button
                onClick={() => onViewModeChange('table')}
                className={`p-2 transition min-h-[44px] min-w-[44px] flex items-center justify-center ${viewMode === 'table' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
                title="Table View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => onViewModeChange('posters')}
                className={`p-2 transition min-h-[44px] min-w-[44px] flex items-center justify-center ${viewMode === 'posters' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
                title="Poster View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
              <button
                onClick={() => onViewModeChange('overview')}
                className={`p-2 transition min-h-[44px] min-w-[44px] flex items-center justify-center ${viewMode === 'overview' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
                title="Overview"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
            </div>
          )}
          {activeTab === 'games' && (
            <button
              onClick={onAddGame}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition min-h-[44px] flex-1 sm:flex-none"
            >
              Add Game
            </button>
          )}
          {activeTab === 'scan' && (
            <button
              onClick={onScanLibrary}
              disabled={isScanning}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScanning ? 'Scanning...' : 'Refresh Scan'}
            </button>
          )}
          {activeTab === 'health' && (
            <button
              onClick={handleRefreshHealth}
              disabled={isHealthLoading}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isHealthLoading ? 'Scanning...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Poster size toggle row — only in poster view, anchored under view-mode toggle */}
      {showPosterSizeRow && (
        <div className="hidden sm:flex justify-end mt-2">
          <div className="flex bg-gray-700 rounded overflow-hidden" role="group" aria-label="Poster size">
            <button
              onClick={() => onPosterSizeChange('sm')}
              className={`p-2 transition min-h-[36px] min-w-[36px] flex items-center justify-center ${posterSize === 'sm' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
              title="Small posters (more per row)"
              aria-pressed={posterSize === 'sm'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V5zM10 5a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V5zM17 5a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V5zM3 12a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM10 12a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2zM17 12a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2z" />
              </svg>
            </button>
            <button
              onClick={() => onPosterSizeChange('md')}
              className={`p-2 transition min-h-[36px] min-w-[36px] flex items-center justify-center ${posterSize === 'md' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
              title="Medium posters"
              aria-pressed={posterSize === 'md'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
            <button
              onClick={() => onPosterSizeChange('lg')}
              className={`p-2 transition min-h-[36px] min-w-[36px] flex items-center justify-center ${posterSize === 'lg' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}
              title="Large posters (fewer per row)"
              aria-pressed={posterSize === 'lg'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H5zM13 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1v-6z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
