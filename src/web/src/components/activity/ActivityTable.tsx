import { Download } from '../../api/client';
import { PlayIcon, PauseIcon, TrashIcon, DownloadIcon } from '../Icons';
import { formatBytes, formatSpeed, formatETA } from '../../utils/formatters';
import { SortField, SortDirection, getStateColor, isPaused } from './types';

interface ActivityTableProps {
  downloads: Download[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onImport: (download: Download) => void;
  onDelete: (download: Download) => void;
}

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSortField: SortField;
  sortDirection: SortDirection;
  onClick: () => void;
  align?: 'left' | 'right';
}

function SortableHeader({
  label,
  field,
  currentSortField,
  sortDirection,
  onClick,
  align = 'left',
}: SortableHeaderProps) {
  const isActive = currentSortField === field;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Determine aria-sort value
  const ariaSort = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer hover:bg-gray-600 select-none ${
        align === 'right' ? 'text-right' : ''
      }`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="columnheader"
      aria-sort={ariaSort}
    >
      {label}
      {isActive && (
        <>
          {' '}
          <span aria-hidden="true">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
          <span className="sr-only">, sorted {sortDirection === 'asc' ? 'ascending' : 'descending'}</span>
        </>
      )}
    </th>
  );
}

function ActivityTable({
  downloads,
  sortField,
  sortDirection,
  onSortChange,
  onPause,
  onResume,
  onImport,
  onDelete,
}: ActivityTableProps) {
  return (
    <div className="hidden md:block bg-gray-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-gray-300 text-left">
            <tr>
              <SortableHeader
                label="Name"
                field="name"
                currentSortField={sortField}
                sortDirection={sortDirection}
                onClick={() => onSortChange('name')}
              />
              <th className="px-4 py-3 font-medium">Status</th>
              <SortableHeader
                label="Progress"
                field="progress"
                currentSortField={sortField}
                sortDirection={sortDirection}
                onClick={() => onSortChange('progress')}
                align="right"
              />
              <SortableHeader
                label="Size"
                field="size"
                currentSortField={sortField}
                sortDirection={sortDirection}
                onClick={() => onSortChange('size')}
                align="right"
              />
              <SortableHeader
                label="Down"
                field="downloadSpeed"
                currentSortField={sortField}
                sortDirection={sortDirection}
                onClick={() => onSortChange('downloadSpeed')}
                align="right"
              />
              <SortableHeader
                label="Up"
                field="uploadSpeed"
                currentSortField={sortField}
                sortDirection={sortDirection}
                onClick={() => onSortChange('uploadSpeed')}
                align="right"
              />
              <th className="px-4 py-3 font-medium text-right">ETA</th>
              <SortableHeader
                label="Added"
                field="added"
                currentSortField={sortField}
                sortDirection={sortDirection}
                onClick={() => onSortChange('added')}
              />
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {downloads.map((download) => (
              <tr key={download.hash} className="hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div className="max-w-xs">
                    <div className="truncate font-medium" title={download.name}>
                      {download.name}
                    </div>
                    <div className="mt-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${download.progress * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${getStateColor(download.state)}`}>{download.state}</span>
                </td>
                <td className="px-4 py-3 text-right text-white">
                  {(download.progress * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right text-white">{formatBytes(download.size)}</td>
                <td className="px-4 py-3 text-right text-green-400">
                  {formatSpeed(download.downloadSpeed)}
                </td>
                <td className="px-4 py-3 text-right text-blue-400">
                  {formatSpeed(download.uploadSpeed)}
                </td>
                <td className="px-4 py-3 text-right text-white">{formatETA(download.eta)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(download.addedOn).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    {isPaused(download.state) ? (
                      <button
                        onClick={() => onResume(download.hash)}
                        className="bg-green-600 hover:bg-green-700 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded transition"
                        title="Resume"
                        aria-label="Resume download"
                      >
                        <PlayIcon />
                      </button>
                    ) : (
                      <button
                        onClick={() => onPause(download.hash)}
                        className="bg-yellow-600 hover:bg-yellow-700 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded transition"
                        title="Pause"
                        aria-label="Pause download"
                      >
                        <PauseIcon />
                      </button>
                    )}
                    <button
                      onClick={() => onImport(download)}
                      className={`p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded transition ${
                        download.gameId
                          ? 'bg-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      title={download.gameId ? 'Already linked to library' : 'Import to Library'}
                      aria-label={download.gameId ? 'Already linked to library' : 'Import to Library'}
                      disabled={!!download.gameId}
                    >
                      <DownloadIcon />
                    </button>
                    <button
                      onClick={() => onDelete(download)}
                      className="bg-red-600 hover:bg-red-700 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded transition"
                      title="Delete"
                      aria-label="Delete download"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ActivityTable;
