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

  // Update check settings
  const [updateCheckEnabled, setUpdateCheckEnabled] = useState(true);
  const [updateCheckSchedule, setUpdateCheckSchedule] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [defaultUpdatePolicy, setDefaultUpdatePolicy] = useState<'notify' | 'auto' | 'ignore'>('notify');
  const [isSavingUpdateSettings, setIsSavingUpdateSettings] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

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
        updateEnabledRes,
        updateScheduleRes,
        defaultPolicyRes,
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
        api.getSetting('update_check_enabled'),
        api.getSetting('update_check_schedule'),
        api.getSetting('default_update_policy'),
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
      if (updateEnabledRes.success && updateEnabledRes.data !== undefined) setUpdateCheckEnabled(updateEnabledRes.data as boolean);
      if (updateScheduleRes.success && updateScheduleRes.data) setUpdateCheckSchedule(updateScheduleRes.data as 'hourly' | 'daily' | 'weekly');
      if (defaultPolicyRes.success && defaultPolicyRes.data) setDefaultUpdatePolicy(defaultPolicyRes.data as 'notify' | 'auto' | 'ignore');
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

  // Update check handlers
  const handleSaveUpdateSettings = async () => {
    setIsSavingUpdateSettings(true);
    try {
      await Promise.all([
        api.updateSetting('update_check_enabled', updateCheckEnabled),
        api.updateSetting('update_check_schedule', updateCheckSchedule),
        api.updateSetting('default_update_policy', defaultUpdatePolicy),
      ]);
      showSaveMessage('success', 'Update check settings saved!');
    } catch (err) {
      showSaveMessage('error', 'Failed to save update check settings');
    } finally {
      setIsSavingUpdateSettings(false);
    }
  };

  const handleCheckUpdatesNow = async () => {
    setIsCheckingUpdates(true);
    try {
      const response = await api.checkAllUpdates();
      if (response.success && response.data) {
        const { checked, updatesFound } = response.data as { checked: number; updatesFound: number };
        showSaveMessage('success', `Checked ${checked} games, found ${updatesFound} updates`);
      } else {
        showSaveMessage('error', response.error || 'Failed to check for updates');
      }
    } catch (err) {
      showSaveMessage('error', 'Failed to check for updates');
    } finally {
      setIsCheckingUpdates(false);
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

        {/* Update Checking */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Update Checking</h3>
          <p className="text-gray-400 mb-4">
            Configure automatic checking for game updates, DLC, and better quality releases.
          </p>
          <div className="space-y-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">Enable Update Checking</label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically check downloaded games for available updates
                </p>
              </div>
              <button
                onClick={() => setUpdateCheckEnabled(!updateCheckEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  updateCheckEnabled ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    updateCheckEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Check Schedule</label>
              <select
                value={updateCheckSchedule}
                onChange={(e) => setUpdateCheckSchedule(e.target.value as 'hourly' | 'daily' | 'weekly')}
                disabled={!updateCheckEnabled}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option value="hourly">Hourly (for testing)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How often to check for updates
              </p>
            </div>

            {/* Default Policy */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Default Update Policy</label>
              <select
                value={defaultUpdatePolicy}
                onChange={(e) => setDefaultUpdatePolicy(e.target.value as 'notify' | 'auto' | 'ignore')}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="notify">Notify - Show badge when updates are available</option>
                <option value="auto">Auto-download - Automatically grab updates</option>
                <option value="ignore">Ignore - Don't check for updates</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Default policy for new games (can be overridden per-game)
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveUpdateSettings}
                disabled={isSavingUpdateSettings}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
              >
                {isSavingUpdateSettings ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={handleCheckUpdatesNow}
                disabled={isCheckingUpdates || !updateCheckEnabled}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 flex items-center gap-2"
              >
                {isCheckingUpdates ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Checking...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Check Now
                  </>
                )}
              </button>
            </div>
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
