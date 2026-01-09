import { useState, useEffect } from 'react';
import { api, Library } from '../api/client';
import StoreSelector from './StoreSelector';
import ConfirmModal from './ConfirmModal';
import { CloseIcon } from './Icons';

interface Game {
  id: number;
  title: string;
  year?: number;
  igdbId?: number;
  coverUrl?: string;
  monitored: boolean;
  status: 'wanted' | 'downloading' | 'downloaded';
  platform: string;
  store?: string | null;
  steamName?: string | null;
  folderPath?: string | null;
  libraryId?: number | null;
  // Update tracking fields
  updateAvailable?: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
  installedQuality?: string | null;
  updatePolicy?: 'notify' | 'auto' | 'ignore';
}

interface IGDBSearchResult {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  developer?: string;
}

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
}

interface EditGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameUpdated: () => void;
  game: Game | null;
}

function EditGameModal({ isOpen, onClose, onGameUpdated, game }: EditGameModalProps) {
  const [store, setStore] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState('');
  const [monitored, setMonitored] = useState(true);
  const [status, setStatus] = useState<'wanted' | 'downloading' | 'downloaded'>('wanted');
  const [updatePolicy, setUpdatePolicy] = useState<'notify' | 'auto' | 'ignore'>('notify');
  const [libraryId, setLibraryId] = useState<number | null>(null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update history state
  const [gameUpdates, setGameUpdates] = useState<GameUpdate[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [updateToGrab, setUpdateToGrab] = useState<GameUpdate | null>(null);
  const [updateToDismiss, setUpdateToDismiss] = useState<GameUpdate | null>(null);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);

  // Rematch state
  const [showRematch, setShowRematch] = useState(false);
  const [rematchQuery, setRematchQuery] = useState('');
  const [rematchResults, setRematchResults] = useState<IGDBSearchResult[]>([]);
  const [isSearchingRematch, setIsSearchingRematch] = useState(false);
  const [selectedRematch, setSelectedRematch] = useState<IGDBSearchResult | null>(null);
  const [isRematching, setIsRematching] = useState(false);

  // Load libraries on mount
  useEffect(() => {
    const loadLibraries = async () => {
      const response = await api.getLibraries();
      if (response.success && response.data) {
        setLibraries(response.data);
      }
    };
    if (isOpen) {
      loadLibraries();
    }
  }, [isOpen]);

  // Load game data when modal opens
  useEffect(() => {
    if (game) {
      setStore(game.store || null);
      setFolderPath(game.folderPath || '');
      setMonitored(game.monitored);
      setStatus(game.status);
      setUpdatePolicy(game.updatePolicy || 'notify');
      setLibraryId(game.libraryId || null);
      // Reset rematch state
      setShowRematch(false);
      setRematchQuery('');
      setRematchResults([]);
      setSelectedRematch(null);
      // Load update history for downloaded games
      if (game.status === 'downloaded') {
        loadGameUpdates(game.id);
      }
    }
  }, [game]);

  const loadGameUpdates = async (gameId: number) => {
    setIsLoadingUpdates(true);
    try {
      const response = await api.getGameUpdates(gameId);
      if (response.success && response.data) {
        setGameUpdates(response.data as GameUpdate[]);
      }
    } catch (err) {
      // Silent fail - updates are supplementary
    } finally {
      setIsLoadingUpdates(false);
    }
  };

  const handleGrabUpdate = async () => {
    if (!updateToGrab || !game) return;
    setIsProcessingUpdate(true);
    try {
      const response = await api.grabUpdate(updateToGrab.id);
      if (response.success) {
        // Reload updates
        loadGameUpdates(game.id);
        onGameUpdated();
      } else {
        setError(response.error || 'Failed to grab update');
      }
    } catch (err) {
      setError('Failed to grab update');
    } finally {
      setIsProcessingUpdate(false);
      setUpdateToGrab(null);
    }
  };

  const handleDismissUpdate = async () => {
    if (!updateToDismiss || !game) return;
    setIsProcessingUpdate(true);
    try {
      const response = await api.dismissUpdate(updateToDismiss.id);
      if (response.success) {
        // Reload updates
        loadGameUpdates(game.id);
        onGameUpdated();
      } else {
        setError(response.error || 'Failed to dismiss update');
      }
    } catch (err) {
      setError('Failed to dismiss update');
    } finally {
      setIsProcessingUpdate(false);
      setUpdateToDismiss(null);
    }
  };

  const handleSearchRematch = async () => {
    if (!rematchQuery.trim()) return;
    setIsSearchingRematch(true);
    setRematchResults([]);
    try {
      const response = await api.searchGames(rematchQuery);
      if (response.success && response.data) {
        setRematchResults(response.data as IGDBSearchResult[]);
      }
    } catch (err) {
      setError('Failed to search IGDB');
    } finally {
      setIsSearchingRematch(false);
    }
  };

  const handleConfirmRematch = async () => {
    if (!selectedRematch || !game) return;
    setIsRematching(true);
    setError(null);
    try {
      const response = await api.rematchGame(game.id, selectedRematch.igdbId);
      if (response.success) {
        onGameUpdated();
        onClose();
      } else {
        setError(response.error || 'Failed to rematch game');
      }
    } catch (err) {
      setError('Failed to rematch game');
    } finally {
      setIsRematching(false);
      setSelectedRematch(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUpdateTypeBadge = (type: string) => {
    switch (type) {
      case 'version':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-blue-600 text-blue-100">Version</span>;
      case 'dlc':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-purple-600 text-purple-100">DLC</span>;
      case 'better_release':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-green-600 text-green-100">Quality</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-600 text-yellow-100">Pending</span>;
      case 'grabbed':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-green-600 text-green-100">Downloaded</span>;
      case 'dismissed':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-gray-600 text-gray-300">Dismissed</span>;
      default:
        return null;
    }
  };

  const pendingUpdates = gameUpdates.filter(u => u.status === 'pending');
  const historyUpdates = gameUpdates.filter(u => u.status !== 'pending');

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !game) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updates: any = {
        store: store || null,
        folderPath: folderPath || null,
        monitored,
        status,
        updatePolicy,
        libraryId: libraryId || null,
      };

      const response = await api.updateGame(game.id, updates);

      if (response.success) {
        onGameUpdated();
        onClose();
      } else {
        setError(response.error || 'Failed to update game');
      }
    } catch (err) {
      setError('Failed to update game');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-game-modal-title"
    >
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full shadow-2xl border border-gray-600">
        {/* Header */}
        <div className="bg-gray-700 flex items-center justify-between p-6 border-b border-gray-600">
          <div>
            <h2 id="edit-game-modal-title" className="text-2xl font-bold text-white">Edit Game</h2>
            <p className="text-sm text-gray-300 mt-1">
              {game.title} {game.year && `(${game.year})`}
            </p>
            {game.steamName && (
              <p className="text-xs text-gray-500 mt-0.5">
                Steam name: {game.steamName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Close modal">
            <CloseIcon className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Change Match Section */}
          <div className="border border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRematch(!showRematch)}
              className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 transition"
              aria-expanded={showRematch}
              aria-controls="rematch-section"
            >
              <span className="text-sm font-medium text-gray-300">Change IGDB Match</span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${showRematch ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showRematch && (
              <div id="rematch-section" className="p-3 bg-gray-800 space-y-3">
                <p className="text-xs text-gray-400">
                  Search IGDB to find the correct game if this was matched incorrectly.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rematchQuery}
                    onChange={(e) => setRematchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchRematch()}
                    placeholder="Search for correct game..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSearchRematch}
                    disabled={isSearchingRematch || !rematchQuery.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium transition"
                  >
                    {isSearchingRematch ? 'Searching...' : 'Search'}
                  </button>
                </div>
                {/* Search Results */}
                {rematchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {rematchResults.map((result) => (
                      <button
                        key={result.igdbId}
                        onClick={() => setSelectedRematch(result)}
                        disabled={result.igdbId === game.igdbId}
                        className={`w-full flex items-center gap-3 p-2 rounded text-left transition ${
                          result.igdbId === game.igdbId
                            ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {result.coverUrl ? (
                          <img
                            src={result.coverUrl}
                            alt={result.title}
                            className="w-10 h-14 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-gray-600 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-xs">?</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {result.title}
                            {result.igdbId === game.igdbId && (
                              <span className="ml-2 text-xs text-green-400">(current)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            {result.year || 'Unknown year'}
                            {result.developer && ` • ${result.developer}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {isSearchingRematch && (
                  <p className="text-xs text-gray-400 text-center py-2">Searching IGDB...</p>
                )}
              </div>
            )}
          </div>

          {/* Store Selector */}
          <div>
            <StoreSelector value={store} onChange={setStore} label="Digital Store" />
            <p className="text-xs text-gray-400 mt-1">
              Select a store if you own this game digitally. Games with a store won't be downloaded.
            </p>
          </div>

          {/* Library Selector */}
          {libraries.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Library</label>
              <select
                value={libraryId || ''}
                onChange={(e) => setLibraryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Library (General)</option>
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name} {lib.platform ? `(${lib.platform})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Organize this game into a specific library collection.
              </p>
            </div>
          )}

          {/* Status Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'wanted' | 'downloading' | 'downloaded')}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="wanted">Wanted</option>
              <option value="downloading">Downloading</option>
              <option value="downloaded">Downloaded</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Set to "Wanted" to search for downloads, "Downloaded" if you already have it.
            </p>
          </div>

          {/* Folder Path */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Library Folder Path
            </label>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="e.g., C:\Games\Game Title (2023)"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              The folder where this game is stored on your system.
            </p>
          </div>

          {/* Monitored Status */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={monitored}
                onChange={(e) => setMonitored(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">
                Monitor this game for new releases
              </span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              When monitored, the system will automatically search for and download releases.
            </p>
          </div>

          {/* Update Tracking Section - only show for downloaded games */}
          {game.status === 'downloaded' && (
            <div className="border-t border-gray-600 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Update Tracking</h3>

              {/* Version Info */}
              <div className="bg-gray-800 rounded p-3 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Installed Version:</span>
                    <span className="ml-2 text-gray-200">
                      {game.installedVersion || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Quality:</span>
                    <span className="ml-2 text-gray-200">
                      {game.installedQuality || 'Unknown'}
                    </span>
                  </div>
                  {game.updateAvailable && game.latestVersion && (
                    <div className="col-span-2">
                      <span className="text-orange-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Update available: v{game.latestVersion}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Update Policy Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Update Policy
                </label>
                <select
                  value={updatePolicy}
                  onChange={(e) => setUpdatePolicy(e.target.value as 'notify' | 'auto' | 'ignore')}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="notify">Notify - Show badge when updates are available</option>
                  <option value="auto">Auto-download - Automatically grab updates</option>
                  <option value="ignore">Ignore - Don't check for updates</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Controls how the system handles updates for this game.
                </p>
              </div>

              {/* Pending Updates */}
              {pendingUpdates.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-orange-400 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Pending Updates ({pendingUpdates.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {pendingUpdates.map((update) => (
                      <div key={update.id} className="bg-gray-700 rounded p-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getUpdateTypeBadge(update.updateType)}
                              {update.version && <span className="text-xs text-gray-400">v{update.version}</span>}
                            </div>
                            <p className="text-xs text-gray-300 truncate" title={update.title}>
                              {update.title}
                            </p>
                            <div className="flex gap-2 text-xs text-gray-500 mt-1">
                              {update.size && <span>{formatBytes(update.size)}</span>}
                              {update.seeders !== undefined && <span>{update.seeders} seeders</span>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setUpdateToGrab(update)}
                              disabled={!update.downloadUrl}
                              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                              title="Download"
                            >
                              Grab
                            </button>
                            <button
                              onClick={() => setUpdateToDismiss(update)}
                              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded"
                              title="Dismiss"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Update History */}
              {historyUpdates.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Update History</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {historyUpdates.map((update) => (
                      <div key={update.id} className="bg-gray-700 rounded p-2 text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getUpdateTypeBadge(update.updateType)}
                          {getStatusBadge(update.status)}
                          <span className="text-xs text-gray-400 truncate" title={update.title}>
                            {update.version ? `v${update.version}` : update.title.substring(0, 30)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 ml-2">
                          {formatDate(update.detectedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoadingUpdates && (
                <div className="mt-4 text-center text-sm text-gray-400">
                  Loading update history...
                </div>
              )}

              {/* No Updates */}
              {!isLoadingUpdates && gameUpdates.length === 0 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  No updates detected yet
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-900 p-3 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-700 flex items-center justify-end gap-3 p-6 border-t border-gray-600">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded transition text-white bg-gray-600 hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Grab Update Confirmation Modal */}
      <ConfirmModal
        isOpen={updateToGrab !== null}
        title="Download Update"
        message={updateToGrab ? `Download "${updateToGrab.title}"?` : ''}
        confirmText={isProcessingUpdate ? 'Downloading...' : 'Download'}
        cancelText="Cancel"
        variant="info"
        onConfirm={handleGrabUpdate}
        onCancel={() => setUpdateToGrab(null)}
      />

      {/* Dismiss Update Confirmation Modal */}
      <ConfirmModal
        isOpen={updateToDismiss !== null}
        title="Dismiss Update"
        message={updateToDismiss ? `Dismiss "${updateToDismiss.title}"?` : ''}
        confirmText={isProcessingUpdate ? 'Dismissing...' : 'Dismiss'}
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleDismissUpdate}
        onCancel={() => setUpdateToDismiss(null)}
      />

      {/* Rematch Confirmation Modal */}
      <ConfirmModal
        isOpen={selectedRematch !== null}
        title="Change Game Match"
        message={selectedRematch ? `Change this game's IGDB match from "${game.title}" to "${selectedRematch.title}"? This will update the cover, metadata, and other game information.` : ''}
        confirmText={isRematching ? 'Updating...' : 'Confirm Change'}
        cancelText="Cancel"
        variant="info"
        onConfirm={handleConfirmRematch}
        onCancel={() => setSelectedRematch(null)}
      />
    </div>
  );
}

export default EditGameModal;
