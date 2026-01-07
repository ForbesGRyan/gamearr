import { useState, useEffect } from 'react';
import { api } from '../api/client';
import StoreSelector from './StoreSelector';
import { CloseIcon } from './Icons';

interface Game {
  id: number;
  title: string;
  year?: number;
  coverUrl?: string;
  monitored: boolean;
  status: 'wanted' | 'downloading' | 'downloaded';
  platform: string;
  store?: string | null;
  folderPath?: string | null;
  // Update tracking fields
  updateAvailable?: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
  installedQuality?: string | null;
  updatePolicy?: 'notify' | 'auto' | 'ignore';
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load game data when modal opens
  useEffect(() => {
    if (game) {
      setStore(game.store || null);
      setFolderPath(game.folderPath || '');
      setMonitored(game.monitored);
      setStatus(game.status);
      setUpdatePolicy(game.updatePolicy || 'notify');
    }
  }, [game]);

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
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg max-w-2xl w-full shadow-2xl border border-gray-600"
        style={{ backgroundColor: 'rgb(17, 24, 39)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b border-gray-600"
          style={{ backgroundColor: 'rgb(31, 41, 55)' }}
        >
          <div>
            <h2 className="text-2xl font-bold text-white">Edit Game</h2>
            <p className="text-sm text-gray-300 mt-1">
              {game.title} {game.year && `(${game.year})`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Store Selector */}
          <div>
            <StoreSelector value={store} onChange={setStore} label="Digital Store" />
            <p className="text-xs text-gray-400 mt-1">
              Select a store if you own this game digitally. Games with a store won't be downloaded.
            </p>
          </div>

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
            </div>
          )}

          {error && (
            <div
              className="p-3 border border-red-700 rounded text-red-200 text-sm"
              style={{ backgroundColor: 'rgb(127, 29, 29)' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 p-6 border-t border-gray-600"
          style={{ backgroundColor: 'rgb(31, 41, 55)' }}
        >
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
    </div>
  );
}

export default EditGameModal;
