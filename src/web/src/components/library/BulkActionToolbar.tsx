import { EyeIcon, EyeSlashIcon, TrashIcon } from '../Icons';

interface BulkActionToolbarProps {
  selectedCount: number;
  isLoading: boolean;
  onMonitor: () => void;
  onUnmonitor: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  isLoading,
  onMonitor,
  onUnmonitor,
  onDelete,
  onClear,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-900/95 border-t border-blue-700 p-3 flex items-center justify-between z-40 backdrop-blur-sm">
      <div className="flex items-center gap-4 ml-4">
        <span className="text-sm font-medium">
          {selectedCount} game{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClear}
          className="text-sm text-gray-300 hover:text-white transition min-h-[44px] px-2 flex items-center"
        >
          Clear selection
        </button>
      </div>
      <div className="flex items-center gap-2 mr-4">
        <button
          onClick={onMonitor}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 px-3 py-2 min-h-[44px] rounded text-sm transition disabled:opacity-50"
        >
          <EyeIcon className="w-4 h-4" />
          Monitor
        </button>
        <button
          onClick={onUnmonitor}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 px-3 py-2 min-h-[44px] rounded text-sm transition disabled:opacity-50"
        >
          <EyeSlashIcon className="w-4 h-4" />
          Unmonitor
        </button>
        <button
          onClick={onDelete}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-3 py-2 min-h-[44px] rounded text-sm transition disabled:opacity-50"
        >
          <TrashIcon className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}
