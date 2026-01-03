import { useState, useEffect } from 'react';
import { api } from '../api/client';
import IndexerStatus from '../components/IndexerStatus';
import CategorySelector from '../components/CategorySelector';
import QBittorrentCategorySelector from '../components/QBittorrentCategorySelector';

function Settings() {
  const [prowlarrUrl, setProwlarrUrl] = useState('');
  const [prowlarrApiKey, setProwlarrApiKey] = useState('');
  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [libraryPath, setLibraryPath] = useState('');
  const [isSavingPath, setIsSavingPath] = useState(false);
  const [pathSaveMessage, setPathSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadLibraryPath();
  }, []);

  const loadLibraryPath = async () => {
    try {
      const response = await api.getSetting('library_path');
      if (response.success && response.data) {
        setLibraryPath(response.data as string);
      }
    } catch (err) {
      console.error('Failed to load library path');
    }
  };

  const handleSaveLibraryPath = async () => {
    setIsSavingPath(true);
    setPathSaveMessage(null);

    try {
      const response = await api.updateSetting('library_path', libraryPath);
      if (response.success) {
        setPathSaveMessage('Library path saved successfully!');
        setTimeout(() => setPathSaveMessage(null), 3000);
      } else {
        setPathSaveMessage('Failed to save library path');
      }
    } catch (err) {
      setPathSaveMessage('Failed to save library path');
    } finally {
      setIsSavingPath(false);
    }
  };

  const testProwlarrConnection = async () => {
    setTestStatus('Testing...');
    // TODO: Implement in Phase 7
    setTimeout(() => {
      setTestStatus('Connection test functionality coming in Phase 7');
    }, 1000);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Prowlarr Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Prowlarr</h3>
          <p className="text-gray-400 mb-4">
            Configure Prowlarr for indexer management and release searching.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Prowlarr URL</label>
              <input
                type="text"
                placeholder="http://localhost:9696"
                value={prowlarrUrl}
                onChange={(e) => setProwlarrUrl(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <input
                type="password"
                placeholder="Your Prowlarr API Key"
                value={prowlarrApiKey}
                onChange={(e) => setProwlarrApiKey(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={testProwlarrConnection}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
            >
              Test Connection
            </button>
            {testStatus && (
              <p className="text-sm text-gray-400 mt-2">{testStatus}</p>
            )}
          </div>
        </div>

        {/* IGDB Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">IGDB API</h3>
          <p className="text-gray-400 mb-4">
            Configure your IGDB API credentials for game metadata.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Client ID</label>
              <input
                type="text"
                placeholder="Your IGDB Client ID"
                value={igdbClientId}
                onChange={(e) => setIgdbClientId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Client Secret</label>
              <input
                type="password"
                placeholder="Your IGDB Client Secret"
                value={igdbClientSecret}
                onChange={(e) => setIgdbClientSecret(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* qBittorrent Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">qBittorrent</h3>
          <p className="text-gray-400 mb-4">
            Configure qBittorrent Web UI connection for download management.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Host</label>
              <input
                type="text"
                placeholder="http://localhost:8080"
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                type="text"
                placeholder="admin"
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                placeholder="adminadmin"
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
              onClick={() => {
                setTimeout(() => {
                  alert('Connection test functionality coming in Phase 7');
                }, 100);
              }}
            >
              Test Connection
            </button>
          </div>
        </div>

        {/* Paths */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Library Path</h3>
          <p className="text-gray-400 mb-4">
            Configure your game library folder. Gamearr will scan this location to detect existing games.
          </p>

          {pathSaveMessage && (
            <div className={`mb-4 p-3 border rounded text-sm ${
              pathSaveMessage.includes('success')
                ? 'bg-green-900 bg-opacity-50 border-green-700 text-green-200'
                : 'bg-red-900 bg-opacity-50 border-red-700 text-red-200'
            }`}>
              {pathSaveMessage}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Library Folder Path</label>
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
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingPath ? 'Saving...' : 'Save Library Path'}
            </button>
          </div>
        </div>

        {/* Category Selection */}
        <CategorySelector />

        {/* qBittorrent Category Filter */}
        <QBittorrentCategorySelector />

        {/* Indexer Status */}
        <IndexerStatus />

        <p className="text-sm text-gray-500 text-center">
          Full settings persistence (API credentials, paths) will be implemented in Phase 7
        </p>
      </div>
    </div>
  );
}

export default Settings;
