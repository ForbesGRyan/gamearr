interface ActivityHeaderProps {
  totalDownloads: number;
  filteredCount: number;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onRefresh: () => void;
}

function ActivityHeader({
  totalDownloads,
  filteredCount,
  showCompleted,
  onToggleCompleted,
  onRefresh,
}: ActivityHeaderProps) {
  const countText =
    filteredCount === totalDownloads
      ? `${totalDownloads} ${showCompleted ? 'total' : 'active'} ${totalDownloads === 1 ? 'download' : 'downloads'}`
      : `${filteredCount} of ${totalDownloads} ${totalDownloads === 1 ? 'download' : 'downloads'}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold">Activity</h2>
        <p className="text-gray-400 mt-1 text-sm md:text-base">{countText}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onToggleCompleted}
          className={`flex-1 sm:flex-none px-4 py-2 min-h-[44px] rounded transition text-sm md:text-base ${
            showCompleted
              ? 'bg-gray-600 hover:bg-gray-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {showCompleted ? 'Hide' : 'Show'} Completed
        </button>
        <button
          onClick={onRefresh}
          className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 px-4 py-2 min-h-[44px] rounded transition text-sm md:text-base"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

export default ActivityHeader;
