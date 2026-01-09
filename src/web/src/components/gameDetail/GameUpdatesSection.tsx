import { useState } from 'react';
import { api, Game, GameUpdate } from '../../api/client';
import { RefreshIcon, DownloadIcon, CloseIcon } from '../Icons';

interface GameUpdatesSectionProps {
  game: Game;
  updates: GameUpdate[];
  onUpdatesChange: () => void;
}

function GameUpdatesSection({ game, updates, onUpdatesChange }: GameUpdatesSectionProps) {
  const [checking, setChecking] = useState(false);
  const [grabbing, setGrabbing] = useState<number | null>(null);

  const pendingUpdates = updates.filter((u) => u.status === 'pending');
  const pastUpdates = updates.filter((u) => u.status !== 'pending');

  const handleCheckForUpdates = async () => {
    setChecking(true);
    await api.checkGameForUpdates(game.id);
    onUpdatesChange();
    setChecking(false);
  };

  const handleGrabUpdate = async (updateId: number) => {
    setGrabbing(updateId);
    await api.grabUpdate(updateId);
    onUpdatesChange();
    setGrabbing(null);
  };

  const handleDismissUpdate = async (updateId: number) => {
    await api.dismissUpdate(updateId);
    onUpdatesChange();
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUpdateTypeLabel = (type: GameUpdate['updateType']) => {
    const labels = {
      version: 'Version Update',
      dlc: 'DLC',
      better_release: 'Better Release',
    };
    return labels[type];
  };

  const getUpdateTypeBadge = (type: GameUpdate['updateType']) => {
    const colors = {
      version: 'bg-blue-600/30 text-blue-300',
      dlc: 'bg-purple-600/30 text-purple-300',
      better_release: 'bg-green-600/30 text-green-300',
    };
    return (
      <span className={`${colors[type]} px-2 py-0.5 rounded text-xs font-medium`}>
        {getUpdateTypeLabel(type)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Current Version Info */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Version Info</h3>
          <button
            onClick={handleCheckForUpdates}
            disabled={checking}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50"
          >
            <RefreshIcon className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <span className="text-sm text-gray-400">Installed Version</span>
            <p className="text-white font-medium">
              {game.installedVersion || 'Unknown'}
            </p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <span className="text-sm text-gray-400">Quality</span>
            <p className="text-white font-medium">
              {game.installedQuality || 'Unknown'}
            </p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <span className="text-sm text-gray-400">Update Policy</span>
            <p className="text-white font-medium capitalize">
              {game.updatePolicy || 'Notify'}
            </p>
          </div>
        </div>
      </div>

      {/* Pending Updates */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">
          Pending Updates
          {pendingUpdates.length > 0 && (
            <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {pendingUpdates.length}
            </span>
          )}
        </h3>

        {pendingUpdates.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No pending updates.</p>
        ) : (
          <div className="space-y-3">
            {pendingUpdates.map((update) => (
              <div
                key={update.id}
                className="bg-gray-700 rounded-lg p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {getUpdateTypeBadge(update.updateType)}
                    {update.version && (
                      <span className="text-sm text-gray-300">v{update.version}</span>
                    )}
                  </div>
                  <p className="text-white truncate" title={update.title}>
                    {update.title}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    {update.size && <span>{formatSize(update.size)}</span>}
                    {update.quality && <span>{update.quality}</span>}
                    {update.seeders !== undefined && <span>{update.seeders} seeders</span>}
                    {update.indexer && <span>{update.indexer}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGrabUpdate(update.id)}
                    disabled={grabbing === update.id}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded transition disabled:opacity-50"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    {grabbing === update.id ? 'Grabbing...' : 'Grab'}
                  </button>
                  <button
                    onClick={() => handleDismissUpdate(update.id)}
                    className="flex items-center gap-1 bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded transition"
                  >
                    <CloseIcon className="w-4 h-4" />
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update History */}
      {pastUpdates.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Update History</h3>
          <div className="space-y-2">
            {pastUpdates.map((update) => (
              <div
                key={update.id}
                className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {getUpdateTypeBadge(update.updateType)}
                  <span className="text-gray-300 truncate max-w-md" title={update.title}>
                    {update.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={
                      update.status === 'grabbed'
                        ? 'text-green-400'
                        : 'text-gray-500'
                    }
                  >
                    {update.status === 'grabbed' ? 'Grabbed' : 'Dismissed'}
                  </span>
                  <span className="text-gray-500">{formatDate(update.detectedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GameUpdatesSection;
