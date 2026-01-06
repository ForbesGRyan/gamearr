import { useState, useEffect } from 'react';
import { api } from '../api/client';
import IndexerStatus from '../components/IndexerStatus';
import CategorySelector from '../components/CategorySelector';
import QBittorrentCategorySelector from '../components/QBittorrentCategorySelector';

interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

function Settings() {
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Prowlarr settings
  const [prowlarrUrl, setProwlarrUrl] = useState('');
  const [prowlarrApiKey, setProwlarrApiKey] = useState('');
  const [prowlarrTest, setProwlarrTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [isSavingProwlarr, setIsSavingProwlarr] = useState(false);

  // IGDB settings
  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [isSavingIgdb, setIsSavingIgdb] = useState(false);

  // qBittorrent settings
  const [qbHost, setQbHost] = useState('');
  const [qbUsername, setQbUsername] = useState('');
  const [qbPassword, setQbPassword] = useState('');
  const [qbTest, setQbTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [isSavingQb, setIsSavingQb] = useState(false);

  // Library path
  const [libraryPath, setLibraryPath] = useState('');
  const [isSavingPath, setIsSavingPath] = useState(false);

  // Dry-run mode
  const [dryRun, setDryRun] = useState(false);
  const [isSavingDryRun, setIsSavingDryRun] = useState(false);

  // Global save message
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load all settings on mount
  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [
        prowlarrUrlRes,
        prowlarrKeyRes,
        igdbIdRes,
        igdbSecretRes,
        qbHostRes,
        qbUserRes,
        qbPassRes,
        libraryRes,
        dryRunRes,
      ] = await Promise.all([
        api.getSetting('prowlarr_url'),
        api.getSetting('prowlarr_api_key'),
        api.getSetting('igdb_client_id'),
        api.getSetting('igdb_client_secret'),
        api.getSetting('qbittorrent_host'),
        api.getSetting('qbittorrent_username'),
        api.getSetting('qbittorrent_password'),
        api.getSetting('library_path'),
        api.getSetting('dry_run'),
      ]);

      if (prowlarrUrlRes.success && prowlarrUrlRes.data) setProwlarrUrl(prowlarrUrlRes.data as string);
      if (prowlarrKeyRes.success && prowlarrKeyRes.data) setProwlarrApiKey(prowlarrKeyRes.data as string);
      if (igdbIdRes.success && igdbIdRes.data) setIgdbClientId(igdbIdRes.data as string);
      if (igdbSecretRes.success && igdbSecretRes.data) setIgdbClientSecret(igdbSecretRes.data as string);
      if (qbHostRes.success && qbHostRes.data) setQbHost(qbHostRes.data as string);
      if (qbUserRes.success && qbUserRes.data) setQbUsername(qbUserRes.data as string);
      if (qbPassRes.success && qbPassRes.data) setQbPassword(qbPassRes.data as string);
      if (libraryRes.success && libraryRes.data) setLibraryPath(libraryRes.data as string);
      if (dryRunRes.success && dryRunRes.data !== undefined) setDryRun(dryRunRes.data as boolean);
    } catch (err) {
      setLoadError('Failed to load settings. Please refresh the page.');
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showSaveMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Prowlarr handlers
  const handleSaveProwlarr = async () => {
    if (!prowlarrUrl.trim()) {
      showSaveMessage('error', 'Prowlarr URL is required');
      return;
    }

    setIsSavingProwlarr(true);
    try {
      await Promise.all([
        api.updateSetting('prowlarr_url', prowlarrUrl.trim()),
        api.updateSetting('prowlarr_api_key', prowlarrApiKey),
      ]);
      showSaveMessage('success', 'Prowlarr settings saved!');
    } catch (err) {
      showSaveMessage('error', 'Failed to save Prowlarr settings');
    } finally {
      setIsSavingProwlarr(false);
    }
  };

  const testProwlarrConnection = async () => {
    setProwlarrTest({ status: 'testing' });
    try {
      const response = await api.testProwlarrConnection();
      if (response.success && response.data) {
        setProwlarrTest({ status: 'success', message: 'Connected successfully!' });
      } else {
        setProwlarrTest({ status: 'error', message: response.error || 'Connection failed' });
      }
    } catch (err) {
      setProwlarrTest({ status: 'error', message: 'Connection test failed' });
    }
  };

  // IGDB handlers
  const handleSaveIgdb = async () => {
    if (!igdbClientId.trim() || !igdbClientSecret.trim()) {
      showSaveMessage('error', 'Both IGDB Client ID and Secret are required');
      return;
    }

    setIsSavingIgdb(true);
    try {
      await Promise.all([
        api.updateSetting('igdb_client_id', igdbClientId.trim()),
        api.updateSetting('igdb_client_secret', igdbClientSecret.trim()),
      ]);
      showSaveMessage('success', 'IGDB settings saved!');
    } catch (err) {
      showSaveMessage('error', 'Failed to save IGDB settings');
    } finally {
      setIsSavingIgdb(false);
    }
  };

  // qBittorrent handlers
  const handleSaveQb = async () => {
    if (!qbHost.trim()) {
      showSaveMessage('error', 'qBittorrent host is required');
      return;
    }

    setIsSavingQb(true);
    try {
      await Promise.all([
        api.updateSetting('qbittorrent_host', qbHost.trim()),
        api.updateSetting('qbittorrent_username', qbUsername),
        api.updateSetting('qbittorrent_password', qbPassword),
      ]);
      showSaveMessage('success', 'qBittorrent settings saved!');
    } catch (err) {
      showSaveMessage('error', 'Failed to save qBittorrent settings');
    } finally {
      setIsSavingQb(false);
    }
  };

  const testQbConnection = async () => {
    setQbTest({ status: 'testing' });
    try {
      const response = await api.testQbittorrentConnection();
      if (response.success && response.data) {
        setQbTest({ status: 'success', message: 'Connected successfully!' });
      } else {
        setQbTest({ status: 'error', message: response.error || 'Connection failed' });
      }
    } catch (err) {
      setQbTest({ status: 'error', message: 'Connection test failed' });
    }
  };

  // Library path handler
  const handleSaveLibraryPath = async () => {
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
    } catch (err) {
      showSaveMessage('error', 'Failed to save library path');
    } finally {
      setIsSavingPath(false);
    }
  };

  // Dry-run handler
  const handleToggleDryRun = async () => {
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
    } catch (err) {
      showSaveMessage('error', 'Failed to update dry-run mode');
    } finally {
      setIsSavingDryRun(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-6 text-center">
        <p className="text-red-200 mb-4">{loadError}</p>
        <button
          onClick={loadAllSettings}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Settings</h2>

      {/* Global save message */}
      {saveMessage && (
        <div className={`mb-6 p-4 border rounded-lg ${
          saveMessage.type === 'success'
            ? 'bg-green-900 bg-opacity-50 border-green-700 text-green-200'
            : 'bg-red-900 bg-opacity-50 border-red-700 text-red-200'
        }`}>
          {saveMessage.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Dry-Run Mode */}
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-yellow-200">Dry-Run Mode</h3>
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

        {/* Prowlarr Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Prowlarr</h3>
          <p className="text-gray-400 mb-4">
            Configure Prowlarr for indexer management and release searching.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Prowlarr URL <span className="text-red-400">*</span>
              </label>
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
            <div className="flex gap-3">
              <button
                onClick={handleSaveProwlarr}
                disabled={isSavingProwlarr}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
              >
                {isSavingProwlarr ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={testProwlarrConnection}
                disabled={prowlarrTest.status === 'testing'}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50"
              >
                {prowlarrTest.status === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {prowlarrTest.status !== 'idle' && prowlarrTest.status !== 'testing' && (
              <p className={`text-sm mt-2 ${
                prowlarrTest.status === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {prowlarrTest.message}
              </p>
            )}
          </div>
        </div>

        {/* IGDB Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">IGDB API</h3>
          <p className="text-gray-400 mb-4">
            Configure your IGDB API credentials for game metadata.
            Get credentials from the{' '}
            <a
              href="https://dev.twitch.tv/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Twitch Developer Console
            </a>.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Client ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Your IGDB Client ID"
                value={igdbClientId}
                onChange={(e) => setIgdbClientId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Client Secret <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                placeholder="Your IGDB Client Secret"
                value={igdbClientSecret}
                onChange={(e) => setIgdbClientSecret(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSaveIgdb}
              disabled={isSavingIgdb}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
            >
              {isSavingIgdb ? 'Saving...' : 'Save'}
            </button>
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
              <label className="block text-sm text-gray-400 mb-1">
                Host <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="http://localhost:8080"
                value={qbHost}
                onChange={(e) => setQbHost(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                type="text"
                placeholder="admin"
                value={qbUsername}
                onChange={(e) => setQbUsername(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                placeholder="adminadmin"
                value={qbPassword}
                onChange={(e) => setQbPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveQb}
                disabled={isSavingQb}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
              >
                {isSavingQb ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={testQbConnection}
                disabled={qbTest.status === 'testing'}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50"
              >
                {qbTest.status === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {qbTest.status !== 'idle' && qbTest.status !== 'testing' && (
              <p className={`text-sm mt-2 ${
                qbTest.status === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {qbTest.message}
              </p>
            )}
          </div>
        </div>

        {/* Library Path */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Library Path</h3>
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

        {/* Category Selection */}
        <CategorySelector />

        {/* qBittorrent Category Filter */}
        <QBittorrentCategorySelector />

        {/* Indexer Status */}
        <IndexerStatus />
      </div>
    </div>
  );
}

export default Settings;
