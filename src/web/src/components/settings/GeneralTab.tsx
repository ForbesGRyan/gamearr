import { useState, useCallback } from 'react';
import { api } from '../../api/client';

interface GeneralTabProps {
  libraryPath: string;
  setLibraryPath: (path: string) => void;
  dryRun: boolean;
  setDryRun: (value: boolean) => void;
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

export default function GeneralTab({
  libraryPath,
  setLibraryPath,
  dryRun,
  setDryRun,
  showSaveMessage,
}: GeneralTabProps) {
  const [isSavingPath, setIsSavingPath] = useState(false);
  const [isSavingDryRun, setIsSavingDryRun] = useState(false);

  const handleSaveLibraryPath = useCallback(async () => {
    if (!libraryPath.trim()) {
      showSaveMessage('error', 'Library path is required');
      return;
    }

    setIsSavingPath(true);
    try {
      const response = await api.updateSetting('library_path', libraryPath.trim());
      if (response.success) {
        showSaveMessage('success', 'Library path saved!');
      } else {
        showSaveMessage('error', response.error || 'Failed to save library path');
      }
    } catch {
      showSaveMessage('error', 'Failed to save library path');
    } finally {
      setIsSavingPath(false);
    }
  }, [libraryPath, showSaveMessage]);

  const handleToggleDryRun = useCallback(async () => {
    setIsSavingDryRun(true);
    try {
      const newValue = !dryRun;
      const response = await api.updateSetting('dry_run', newValue);
      if (response.success) {
        setDryRun(newValue);
        showSaveMessage('success', `Dry-run mode ${newValue ? 'enabled' : 'disabled'}`);
      } else {
        showSaveMessage('error', 'Failed to update dry-run mode');
      }
    } catch {
      showSaveMessage('error', 'Failed to update dry-run mode');
    } finally {
      setIsSavingDryRun(false);
    }
  }, [dryRun, setDryRun, showSaveMessage]);

  return (
    <>
      {/* Dry-Run Mode */}
      <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-2 text-yellow-200 flex items-center gap-2">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Dry-Run Mode
            </h3>
            <p className="text-yellow-300 text-sm">
              When enabled, Gamearr will log what it would download but won't actually send torrents to qBittorrent.
              Useful for testing your configuration.
            </p>
          </div>
          <button
            onClick={handleToggleDryRun}
            disabled={isSavingDryRun}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              dryRun
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-gray-600 hover:bg-gray-700 text-gray-200'
            } disabled:opacity-50`}
          >
            {isSavingDryRun ? 'Saving...' : dryRun ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Library Path */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Library Path
        </h3>
        <p className="text-gray-400 mb-4">
          Configure your game library folder. Gamearr will scan this location to detect existing games.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Library Folder Path <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={libraryPath}
              onChange={(e) => setLibraryPath(e.target.value)}
              placeholder="e.g., D:\Games or /mnt/games"
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Absolute path where organized game folders will be created
            </p>
          </div>
          <button
            onClick={handleSaveLibraryPath}
            disabled={isSavingPath || !libraryPath.trim()}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingPath ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
