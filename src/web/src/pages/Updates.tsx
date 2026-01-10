import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import { formatBytes, formatDate } from '../utils/formatters';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

interface GameUpdate {
  id: number;
  gameId: number;
  updateType: 'version' | 'dlc' | 'better_release';
  title: string;
  version?: string;
  size?: number;
  quality?: string;
  seeders?: number;
  downloadUrl?: string;
  indexer?: string;
  detectedAt: string;
  status: 'pending' | 'grabbed' | 'dismissed';
  // Joined fields
  gameTitle?: string;
  gameCoverUrl?: string;
}

type UpdateTypeFilter = 'all' | 'version' | 'dlc' | 'better_release';

function Updates() {
  const [updates, setUpdates] = useState<GameUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<UpdateTypeFilter>('all');
  const [updateToGrab, setUpdateToGrab] = useState<GameUpdate | null>(null);
  const [updateToDismiss, setUpdateToDismiss] = useState<GameUpdate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getPendingUpdates();
      if (response.success && response.data) {
        setUpdates(response.data as GameUpdate[]);
      } else {
        setError(response.error || 'Failed to load updates');
      }
    } catch (err) {
      setError('Failed to load updates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrab = async () => {
    if (!updateToGrab) return;

    setIsProcessing(true);
    try {
      const response = await api.grabUpdate(updateToGrab.id);
      if (response.success) {
        setSuccessMessage(`Started download: ${updateToGrab.title}`);
        setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
        // Remove from list
        setUpdates(updates.filter(u => u.id !== updateToGrab.id));
      } else {
        setError(response.error || 'Failed to grab update');
      }
    } catch (err) {
      setError('Failed to grab update');
    } finally {
      setIsProcessing(false);
      setUpdateToGrab(null);
    }
  };

  const handleDismiss = async () => {
    if (!updateToDismiss) return;

    setIsProcessing(true);
    try {
      const response = await api.dismissUpdate(updateToDismiss.id);
      if (response.success) {
        // Remove from list
        setUpdates(updates.filter(u => u.id !== updateToDismiss.id));
      } else {
        setError(response.error || 'Failed to dismiss update');
      }
    } catch (err) {
      setError('Failed to dismiss update');
    } finally {
      setIsProcessing(false);
      setUpdateToDismiss(null);
    }
  };

  const getUpdateTypeBadge = (type: string) => {
    switch (type) {
      case 'version':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-blue-100">
            Version Update
          </span>
        );
      case 'dlc':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-purple-600 text-purple-100">
            DLC / Content
          </span>
        );
      case 'better_release':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-green-100">
            Better Quality
          </span>
        );
      default:
        return null;
    }
  };

  const filteredUpdates = filter === 'all'
    ? updates
    : updates.filter(u => u.updateType === filter);

  // Group updates by game
  const groupedUpdates = filteredUpdates.reduce((acc, update) => {
    const gameId = update.gameId;
    if (!acc[gameId]) {
      acc[gameId] = {
        gameTitle: update.gameTitle || 'Unknown Game',
        gameCoverUrl: update.gameCoverUrl,
        updates: [],
      };
    }
    acc[gameId].updates.push(update);
    return acc;
  }, {} as Record<number, { gameTitle: string; gameCoverUrl?: string; updates: GameUpdate[] }>);

  const gameGroups = Object.entries(groupedUpdates);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Updates</h2>
        <p className="text-gray-400 text-sm md:text-base">
          Available updates for your downloaded games
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg text-green-200">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg text-red-200">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-300 hover:text-red-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'version', label: 'Version' },
            { id: 'dlc', label: 'DLC' },
            { id: 'better_release', label: 'Quality' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as UpdateTypeFilter)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                filter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
              {tab.id === 'all' && updates.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-700 rounded">
                  {updates.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={loadUpdates}
          disabled={isLoading}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading updates...</p>
          </div>
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">No pending updates</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {filter === 'all'
              ? "All your games are up to date! Updates will appear here when new versions, DLC, or better quality releases are detected."
              : `No ${filter === 'better_release' ? 'quality' : filter} updates available.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {gameGroups.map(([gameId, group]) => (
            <div key={gameId} className="bg-gray-800 rounded-lg overflow-hidden">
              {/* Game Header */}
              <div className="flex items-center gap-4 p-4 border-b border-gray-700 bg-gray-850">
                {group.gameCoverUrl ? (
                  <img
                    src={group.gameCoverUrl}
                    alt={group.gameTitle}
                    className="w-12 h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-16 bg-gray-700 rounded flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white">{group.gameTitle}</h3>
                  <p className="text-sm text-gray-400">
                    {group.updates.length} update{group.updates.length !== 1 ? 's' : ''} available
                  </p>
                </div>
              </div>

              {/* Updates List */}
              <div className="divide-y divide-gray-700">
                {group.updates.map((update) => (
                  <div key={update.id} className="p-4 hover:bg-gray-750 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getUpdateTypeBadge(update.updateType)}
                          {update.version && (
                            <span className="text-sm text-gray-400">
                              v{update.version}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-white mb-2 truncate" title={update.title}>
                          {update.title}
                        </h4>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          {update.quality && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                              {update.quality}
                            </span>
                          )}
                          {update.size && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                              </svg>
                              {formatBytes(update.size)}
                            </span>
                          )}
                          {update.seeders !== undefined && (
                            <span className={`flex items-center gap-1 ${
                              update.seeders >= 20 ? 'text-green-400' :
                              update.seeders >= 5 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              {update.seeders} seeders
                            </span>
                          )}
                          {update.indexer && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                              </svg>
                              {update.indexer}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatDate(update.detectedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setUpdateToGrab(update)}
                          disabled={!update.downloadUrl}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={update.downloadUrl ? 'Download this update' : 'No download URL available'}
                        >
                          Grab
                        </button>
                        <button
                          onClick={() => setUpdateToDismiss(update)}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition"
                          title="Dismiss this update"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grab Confirmation Modal */}
      <ConfirmModal
        isOpen={updateToGrab !== null}
        title="Download Update"
        message={updateToGrab ? `Download "${updateToGrab.title}"?` : ''}
        confirmText={isProcessing ? 'Downloading...' : 'Download'}
        cancelText="Cancel"
        variant="info"
        onConfirm={handleGrab}
        onCancel={() => setUpdateToGrab(null)}
      />

      {/* Dismiss Confirmation Modal */}
      <ConfirmModal
        isOpen={updateToDismiss !== null}
        title="Dismiss Update"
        message={updateToDismiss ? `Dismiss "${updateToDismiss.title}"? You can find new releases by searching again.` : ''}
        confirmText={isProcessing ? 'Dismissing...' : 'Dismiss'}
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleDismiss}
        onCancel={() => setUpdateToDismiss(null)}
      />
    </div>
  );
}

export default Updates;
