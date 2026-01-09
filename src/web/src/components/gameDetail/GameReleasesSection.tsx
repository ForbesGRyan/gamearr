import { GrabbedRelease } from '../../api/client';

interface GameReleasesSectionProps {
  releases: GrabbedRelease[];
}

function GameReleasesSection({ releases }: GameReleasesSectionProps) {
  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: GrabbedRelease['status']) => {
    const statusColors = {
      pending: 'bg-yellow-600/30 text-yellow-300',
      downloading: 'bg-blue-600/30 text-blue-300',
      completed: 'bg-green-600/30 text-green-300',
      failed: 'bg-red-600/30 text-red-300',
    };
    return (
      <span className={`${statusColors[status]} px-2 py-0.5 rounded text-xs font-medium`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (releases.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No releases have been grabbed for this game yet.</p>
        <p className="text-gray-500 text-sm mt-2">
          Use the "Search Releases" button to find and download releases.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Title</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Indexer</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Quality</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Size</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-300">Status</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Grabbed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {releases.map((release) => (
            <tr key={release.id} className="hover:bg-gray-700/50 transition">
              <td className="px-4 py-3">
                <span className="text-white truncate block max-w-md" title={release.title}>
                  {release.title}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300">{release.indexer}</td>
              <td className="px-4 py-3">
                {release.quality ? (
                  <span className="bg-gray-600 px-2 py-0.5 rounded text-xs">{release.quality}</span>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{formatSize(release.size)}</td>
              <td className="px-4 py-3 text-center">{getStatusBadge(release.status)}</td>
              <td className="px-4 py-3 text-right text-gray-400 text-sm">
                {formatDate(release.grabbedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GameReleasesSection;
