import { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import { api } from '../api/client';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

// Lazy load tab components
const GeneralTab = lazy(() => import('../components/settings/GeneralTab'));
const LibrariesTab = lazy(() => import('../components/settings/LibrariesTab'));
const IndexersTab = lazy(() => import('../components/settings/IndexersTab'));
const DownloadsTab = lazy(() => import('../components/settings/DownloadsTab'));
const MetadataTab = lazy(() => import('../components/settings/MetadataTab'));
const UpdatesTab = lazy(() => import('../components/settings/UpdatesTab'));

type SettingsTab = 'general' | 'libraries' | 'indexers' | 'downloads' | 'metadata' | 'updates';

// Loading fallback component
function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}

function Settings() {
  // Tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Prowlarr settings
  const [prowlarrUrl, setProwlarrUrl] = useState('');
  const [prowlarrApiKey, setProwlarrApiKey] = useState('');

  // IGDB settings
  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');

  // qBittorrent settings
  const [qbHost, setQbHost] = useState('');
  const [qbUsername, setQbUsername] = useState('');
  const [qbPassword, setQbPassword] = useState('');

  // Dry-run mode (default ON for safety)
  const [dryRun, setDryRun] = useState(true);

  // Automation settings
  const [rssSyncInterval, setRssSyncInterval] = useState(15);
  const [searchSchedulerInterval, setSearchSchedulerInterval] = useState(15);
  const [autoGrabMinScore, setAutoGrabMinScore] = useState(100);
  const [autoGrabMinSeeders, setAutoGrabMinSeeders] = useState(5);

  // Update check settings
  const [updateCheckEnabled, setUpdateCheckEnabled] = useState(true);
  const [updateCheckSchedule, setUpdateCheckSchedule] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [defaultUpdatePolicy, setDefaultUpdatePolicy] = useState<'notify' | 'auto' | 'ignore'>('notify');

  // Steam settings
  const [steamApiKey, setSteamApiKey] = useState('');
  const [steamId, setSteamId] = useState('');

  // Global save message
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Timeout ref for cleanup
  const saveMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all settings on mount
  useEffect(() => {
    loadAllSettings();

    // Cleanup timeout on unmount
    return () => {
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
    };
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
        dryRunRes,
        updateEnabledRes,
        updateScheduleRes,
        defaultPolicyRes,
        steamApiKeyRes,
        steamIdRes,
        rssSyncIntervalRes,
        searchIntervalRes,
        minScoreRes,
        minSeedersRes,
      ] = await Promise.all([
        api.getSetting('prowlarr_url'),
        api.getSetting('prowlarr_api_key'),
        api.getSetting('igdb_client_id'),
        api.getSetting('igdb_client_secret'),
        api.getSetting('qbittorrent_host'),
        api.getSetting('qbittorrent_username'),
        api.getSetting('qbittorrent_password'),
        api.getSetting('dry_run'),
        api.getSetting('update_check_enabled'),
        api.getSetting('update_check_schedule'),
        api.getSetting('default_update_policy'),
        api.getSetting('steam_api_key'),
        api.getSetting('steam_id'),
        api.getSetting('rss_sync_interval'),
        api.getSetting('search_scheduler_interval'),
        api.getSetting('auto_grab_min_score'),
        api.getSetting('auto_grab_min_seeders'),
      ]);

      if (prowlarrUrlRes.success && prowlarrUrlRes.data) setProwlarrUrl(prowlarrUrlRes.data as string);
      if (prowlarrKeyRes.success && prowlarrKeyRes.data) setProwlarrApiKey(prowlarrKeyRes.data as string);
      if (igdbIdRes.success && igdbIdRes.data) setIgdbClientId(igdbIdRes.data as string);
      if (igdbSecretRes.success && igdbSecretRes.data) setIgdbClientSecret(igdbSecretRes.data as string);
      if (qbHostRes.success && qbHostRes.data) setQbHost(qbHostRes.data as string);
      if (qbUserRes.success && qbUserRes.data) setQbUsername(qbUserRes.data as string);
      if (qbPassRes.success && qbPassRes.data) setQbPassword(qbPassRes.data as string);
      if (dryRunRes.success && dryRunRes.data !== undefined) setDryRun(dryRunRes.data as boolean);
      if (updateEnabledRes.success && updateEnabledRes.data !== undefined) setUpdateCheckEnabled(updateEnabledRes.data as boolean);
      if (updateScheduleRes.success && updateScheduleRes.data) setUpdateCheckSchedule(updateScheduleRes.data as 'hourly' | 'daily' | 'weekly');
      if (defaultPolicyRes.success && defaultPolicyRes.data) setDefaultUpdatePolicy(defaultPolicyRes.data as 'notify' | 'auto' | 'ignore');
      if (steamApiKeyRes.success && steamApiKeyRes.data) setSteamApiKey(steamApiKeyRes.data as string);
      if (steamIdRes.success && steamIdRes.data) setSteamId(steamIdRes.data as string);
      if (rssSyncIntervalRes.success && rssSyncIntervalRes.data !== undefined) setRssSyncInterval(rssSyncIntervalRes.data as number);
      if (searchIntervalRes.success && searchIntervalRes.data !== undefined) setSearchSchedulerInterval(searchIntervalRes.data as number);
      if (minScoreRes.success && minScoreRes.data !== undefined) setAutoGrabMinScore(minScoreRes.data as number);
      if (minSeedersRes.success && minSeedersRes.data !== undefined) setAutoGrabMinSeeders(minSeedersRes.data as number);
    } catch (err) {
      setLoadError('Failed to load settings. Please refresh the page.');
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showSaveMessage = useCallback((type: 'success' | 'error', text: string) => {
    // Clear any existing timeout
    if (saveMessageTimeoutRef.current) {
      clearTimeout(saveMessageTimeoutRef.current);
    }
    setSaveMessage({ type, text });
    saveMessageTimeoutRef.current = setTimeout(() => setSaveMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
  }, []);

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

  const tabs: { id: SettingsTab; label: string; icon: JSX.Element }[] = [
    {
      id: 'general',
      label: 'General',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'libraries',
      label: 'Libraries',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
    {
      id: 'indexers',
      label: 'Indexers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
    },
    {
      id: 'downloads',
      label: 'Downloads',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      ),
    },
    {
      id: 'metadata',
      label: 'Metadata',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      id: 'updates',
      label: 'Updates',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Settings</h2>
        <p className="text-gray-400">Configure Gamearr's integrations and preferences</p>
      </div>

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

      {/* Tab Navigation */}
      <div className="border-b border-gray-700 mb-6">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content with Suspense */}
      <div className="space-y-6">
        <Suspense fallback={<TabLoading />}>
          {activeTab === 'general' && (
            <GeneralTab
              rssSyncInterval={rssSyncInterval}
              setRssSyncInterval={setRssSyncInterval}
              searchSchedulerInterval={searchSchedulerInterval}
              setSearchSchedulerInterval={setSearchSchedulerInterval}
              autoGrabMinScore={autoGrabMinScore}
              setAutoGrabMinScore={setAutoGrabMinScore}
              autoGrabMinSeeders={autoGrabMinSeeders}
              setAutoGrabMinSeeders={setAutoGrabMinSeeders}
              showSaveMessage={showSaveMessage}
            />
          )}

          {activeTab === 'libraries' && (
            <LibrariesTab showSaveMessage={showSaveMessage} />
          )}

          {activeTab === 'indexers' && (
            <IndexersTab
              prowlarrUrl={prowlarrUrl}
              setProwlarrUrl={setProwlarrUrl}
              prowlarrApiKey={prowlarrApiKey}
              setProwlarrApiKey={setProwlarrApiKey}
              showSaveMessage={showSaveMessage}
            />
          )}

          {activeTab === 'downloads' && (
            <DownloadsTab
              qbHost={qbHost}
              setQbHost={setQbHost}
              qbUsername={qbUsername}
              setQbUsername={setQbUsername}
              qbPassword={qbPassword}
              setQbPassword={setQbPassword}
              dryRun={dryRun}
              setDryRun={setDryRun}
              showSaveMessage={showSaveMessage}
            />
          )}

          {activeTab === 'metadata' && (
            <MetadataTab
              igdbClientId={igdbClientId}
              setIgdbClientId={setIgdbClientId}
              igdbClientSecret={igdbClientSecret}
              setIgdbClientSecret={setIgdbClientSecret}
              steamApiKey={steamApiKey}
              setSteamApiKey={setSteamApiKey}
              steamId={steamId}
              setSteamId={setSteamId}
              showSaveMessage={showSaveMessage}
            />
          )}

          {activeTab === 'updates' && (
            <UpdatesTab
              updateCheckEnabled={updateCheckEnabled}
              setUpdateCheckEnabled={setUpdateCheckEnabled}
              updateCheckSchedule={updateCheckSchedule}
              setUpdateCheckSchedule={setUpdateCheckSchedule}
              defaultUpdatePolicy={defaultUpdatePolicy}
              setDefaultUpdatePolicy={setDefaultUpdatePolicy}
              showSaveMessage={showSaveMessage}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default Settings;
