import { DownloadHistoryEntry, GrabbedRelease } from '../../api/client';
import { DownloadIcon } from '../Icons';
import { MobileCard } from '../MobileCard';

interface GameHistorySectionProps {
  history: DownloadHistoryEntry[];
  releases: GrabbedRelease[];
}

function GameHistorySection({ history, releases }: GameHistorySectionProps) {
  // Create a map of release IDs to release titles for display
  const releaseMap = new Map(releases.map((r) => [r.id, r]));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'In progress';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'complete':
        return 'bg-green-600';
      case 'downloading':
        return 'bg-blue-600';
      case 'failed':
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusInfo = (status: string): { label: string; color: 'green' | 'blue' | 'yellow' | 'red' | 'gray' } => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'complete':
        return { label: 'Completed', color: 'green' };
      case 'downloading':
        return { label: 'Downloading', color: 'blue' };
      case 'failed':
      case 'error':
        return { label: 'Failed', color: 'red' };
      default:
        return { label: status.charAt(0).toUpperCase() + status.slice(1), color: 'gray' };
    }
  };

  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No download history for this game yet.</p>
        <p className="text-gray-500 text-sm mt-2">
          History will appear here once you start downloading releases.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Download History</h3>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {history.map((entry) => {
          const release = releaseMap.get(entry.releaseId);
          return (
            <MobileCard
              key={entry.id}
              title={release?.title || `Release #${entry.releaseId}`}
              subtitle={release?.indexer}
              status={getStatusInfo(entry.status)}
              progress={entry.status === 'downloading' && entry.progress < 100 ? entry.progress : undefined}
              fields={[
                { label: 'Status', value: <span className="capitalize">{entry.status}</span> },
                {
                  label: 'Date',
                  value: entry.completedAt ? formatDate(entry.completedAt) : 'In Progress'
                },
              ]}
            />
          );
        })}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

        {/* Timeline items */}
        <div className="space-y-4">
          {history.map((entry, index) => {
            const release = releaseMap.get(entry.releaseId);
            return (
              <div key={entry.id} className="relative pl-10">
                {/* Timeline dot */}
                <div
                  className={`absolute left-2 w-5 h-5 rounded-full ${getStatusColor(entry.status)} flex items-center justify-center`}
                >
                  <DownloadIcon className="w-3 h-3 text-white" />
                </div>

                {/* Content */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate" title={release?.title}>
                        {release?.title || `Release #${entry.releaseId}`}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span className="capitalize">{entry.status}</span>
                        {entry.progress < 100 && entry.status === 'downloading' && (
                          <span>{entry.progress}%</span>
                        )}
                        {release?.indexer && <span>{release.indexer}</span>}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-400">
                      {entry.completedAt ? (
                        <div>
                          <div>Completed</div>
                          <div className="text-gray-500">{formatDate(entry.completedAt)}</div>
                        </div>
                      ) : (
                        <div className="text-blue-400">In Progress</div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar for downloading */}
                  {entry.status === 'downloading' && entry.progress < 100 && (
                    <div className="mt-3">
                      <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${entry.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GameHistorySection;
