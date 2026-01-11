interface ActivityHeaderProps {
  totalDownloads: number;
  filteredCount: number;
  onRefresh: () => void;
}

function ActivityHeader({
  totalDownloads,
  filteredCount,
  onRefresh,
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
      <button
        onClick={onRefresh}
        className="sm:flex-none bg-blue-600 hover:bg-blue-700 px-4 py-2 min-h-[44px] rounded transition text-sm md:text-base"
      >
        Refresh
      </button>
    </div>
  );
}

export default ActivityHeader;
