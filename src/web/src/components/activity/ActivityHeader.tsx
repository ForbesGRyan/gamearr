interface ActivityHeaderProps {
  totalDownloads: number;
  filteredCount: number;
  hasActiveDownloads: boolean;
  hasPausedDownloads: boolean;
  onRefresh: () => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
}

function ActivityHeader({
  totalDownloads,
  filteredCount,
  hasActiveDownloads,
  hasPausedDownloads,
  onRefresh,
  onPauseAll,
  onResumeAll,
}: ActivityHeaderProps) {
  const countText =
    filteredCount === totalDownloads
      ? `${totalDownloads} ${totalDownloads === 1 ? 'download' : 'downloads'}`
      : `${filteredCount} of ${totalDownloads} ${totalDownloads === 1 ? 'download' : 'downloads'}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold">Activity</h2>
        <p className="text-gray-400 mt-1 text-sm md:text-base">{countText}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {hasActiveDownloads && (
          <button
            onClick={onPauseAll}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 px-4 py-2 min-h-[44px] rounded transition text-sm md:text-base"
            title="Pause all active downloads"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
            <span className="hidden sm:inline">Pause All</span>
          </button>
        )}
        {hasPausedDownloads && (
          <button
            onClick={onResumeAll}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 min-h-[44px] rounded transition text-sm md:text-base"
            title="Resume all paused downloads"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span className="hidden sm:inline">Resume All</span>
          </button>
        )}
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 min-h-[44px] rounded transition text-sm md:text-base"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}

export default ActivityHeader;
