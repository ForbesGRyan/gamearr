import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSetting } from '../queries/settings';
import { queryKeys } from '../queries/keys';

// Lazy load tab components
const GeneralTab = lazy(() => import('../components/settings/GeneralTab'));
const LibrariesTab = lazy(() => import('../components/settings/LibrariesTab'));
const IndexersTab = lazy(() => import('../components/settings/IndexersTab'));
const DownloadsTab = lazy(() => import('../components/settings/DownloadsTab'));
const MetadataTab = lazy(() => import('../components/settings/MetadataTab'));
const NotificationsTab = lazy(() => import('../components/settings/NotificationsTab'));
const UpdatesTab = lazy(() => import('../components/settings/UpdatesTab'));
const SystemTab = lazy(() => import('../components/settings/SystemTab'));
const SecurityTab = lazy(() => import('../components/settings/SecurityTab'));

type SettingsTab = 'general' | 'libraries' | 'indexers' | 'downloads' | 'metadata' | 'notifications' | 'updates' | 'system' | 'security';

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}

function Settings() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: SettingsTab[] = ['general', 'libraries', 'indexers', 'downloads', 'metadata', 'notifications', 'updates', 'system', 'security'];

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam as SettingsTab)) {
      return tabParam as SettingsTab;
    }
    return 'general';
  });

  // Sync URL → state when URL changes externally (e.g., from nav dropdown)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const newTab: SettingsTab = (tabParam && validTabs.includes(tabParam as SettingsTab))
      ? (tabParam as SettingsTab)
      : 'general';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams]);

  // Update URL when tab changes via internal clicks
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    const expectedTab = activeTab === 'general' ? null : activeTab;
    if (expectedTab !== currentTab) {
      if (activeTab === 'general') {
        searchParams.delete('tab');
      } else {
        searchParams.set('tab', activeTab);
      }
      setSearchParams(searchParams, { replace: true });
    }
  }, [activeTab]);

  // Settings queries — one per key, cached individually.
  // Tabs keep their existing prop interfaces; Settings.tsx owns the edit
  // buffer (local useState) and seeds it from query data once on first load.
  const prowlarrUrlQ = useSetting<string>('prowlarr_url');
  const prowlarrKeyQ = useSetting<string>('prowlarr_api_key');
  const igdbIdQ = useSetting<string>('igdb_client_id');
  const igdbSecretQ = useSetting<string>('igdb_client_secret');
  const qbHostQ = useSetting<string>('qbittorrent_host');
  const qbUserQ = useSetting<string>('qbittorrent_username');
  const qbPassQ = useSetting<string>('qbittorrent_password');
  const sabHostQ = useSetting<string>('sabnzbd_host');
  const sabApiKeyQ = useSetting<string>('sabnzbd_api_key');
  const dryRunQ = useSetting<boolean>('dry_run');
  const updateEnabledQ = useSetting<boolean>('update_check_enabled');
  const updateScheduleQ = useSetting<'hourly' | 'daily' | 'weekly'>('update_check_schedule');
  const defaultPolicyQ = useSetting<'notify' | 'auto' | 'ignore'>('default_update_policy');
  const steamApiKeyQ = useSetting<string>('steam_api_key');
  const steamIdQ = useSetting<string>('steam_id');
  const gogRefreshTokenQ = useSetting<string>('gog_refresh_token');
  const rssSyncIntervalQ = useSetting<number>('rss_sync_interval');
  const searchIntervalQ = useSetting<number>('search_scheduler_interval');
  const minScoreQ = useSetting<number>('auto_grab_min_score');
  const minSeedersQ = useSetting<number>('auto_grab_min_seeders');
  const trendingCacheQ = useSetting<number>('trending_games_cache_interval');
  const torrentsCacheQ = useSetting<number>('top_torrents_cache_interval');
  const discordWebhookQ = useSetting<string>('discord_webhook_url');
  const updatePatchHandlingQ = useSetting<'penalize' | 'hide' | 'warn_only'>('update_patch_handling');
  const updatePatchPenaltyQ = useSetting<number>('update_patch_penalty');

  const allQueries = [
    prowlarrUrlQ, prowlarrKeyQ, igdbIdQ, igdbSecretQ, qbHostQ, qbUserQ, qbPassQ,
    sabHostQ, sabApiKeyQ, dryRunQ, updateEnabledQ, updateScheduleQ, defaultPolicyQ,
    steamApiKeyQ, steamIdQ, gogRefreshTokenQ, rssSyncIntervalQ, searchIntervalQ,
    minScoreQ, minSeedersQ, trendingCacheQ, torrentsCacheQ, discordWebhookQ,
    updatePatchHandlingQ, updatePatchPenaltyQ,
  ];

  const isLoading = allQueries.some((q) => q.isLoading);
  const firstError = allQueries.find((q) => q.isError)?.error as Error | undefined;
  const loadError = firstError ? 'Failed to load settings. Please refresh the page.' : null;

  // Local edit buffers — preserve prop interface for tabs.
  const [prowlarrUrl, setProwlarrUrl] = useState('');
  const [prowlarrApiKey, setProwlarrApiKey] = useState('');
  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [qbHost, setQbHost] = useState('');
  const [qbUsername, setQbUsername] = useState('');
  const [qbPassword, setQbPassword] = useState('');
  const [sabHost, setSabHost] = useState('');
  const [sabApiKey, setSabApiKey] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [rssSyncInterval, setRssSyncInterval] = useState(15);
  const [searchSchedulerInterval, setSearchSchedulerInterval] = useState(15);
  const [autoGrabMinScore, setAutoGrabMinScore] = useState(100);
  const [autoGrabMinSeeders, setAutoGrabMinSeeders] = useState(5);
  const [trendingCacheInterval, setTrendingCacheInterval] = useState(15);
  const [torrentsCacheInterval, setTorrentsCacheInterval] = useState(5);
  const [updatePatchHandling, setUpdatePatchHandling] = useState<'penalize' | 'hide' | 'warn_only'>('penalize');
  const [updatePatchPenalty, setUpdatePatchPenalty] = useState(80);
  const [updateCheckEnabled, setUpdateCheckEnabled] = useState(true);
  const [updateCheckSchedule, setUpdateCheckSchedule] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [defaultUpdatePolicy, setDefaultUpdatePolicy] = useState<'notify' | 'auto' | 'ignore'>('notify');
  const [steamApiKey, setSteamApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [gogRefreshToken, setGogRefreshToken] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');

  // Seed local buffers from query data exactly once, after first load completes.
  // A ref gates re-seeding so that mutation-driven cache refetches don't clobber
  // in-flight user edits in other tabs.
  const hasSeededRef = useRef(false);

  useEffect(() => {
    if (hasSeededRef.current) return;
    if (isLoading) return;
    hasSeededRef.current = true;

    if (prowlarrUrlQ.data) setProwlarrUrl(prowlarrUrlQ.data);
    if (prowlarrKeyQ.data) setProwlarrApiKey(prowlarrKeyQ.data);
    if (igdbIdQ.data) setIgdbClientId(igdbIdQ.data);
    if (igdbSecretQ.data) setIgdbClientSecret(igdbSecretQ.data);
    if (qbHostQ.data) setQbHost(qbHostQ.data);
    if (qbUserQ.data) setQbUsername(qbUserQ.data);
    if (qbPassQ.data) setQbPassword(qbPassQ.data);
    if (sabHostQ.data) setSabHost(sabHostQ.data);
    if (sabApiKeyQ.data) setSabApiKey(sabApiKeyQ.data);
    if (dryRunQ.data !== null && dryRunQ.data !== undefined) setDryRun(dryRunQ.data);
    if (updateEnabledQ.data !== null && updateEnabledQ.data !== undefined) setUpdateCheckEnabled(updateEnabledQ.data);
    if (updateScheduleQ.data) setUpdateCheckSchedule(updateScheduleQ.data);
    if (defaultPolicyQ.data) setDefaultUpdatePolicy(defaultPolicyQ.data);
    if (steamApiKeyQ.data) setSteamApiKey(steamApiKeyQ.data);
    if (steamIdQ.data) setSteamId(steamIdQ.data);
    if (gogRefreshTokenQ.data) setGogRefreshToken(gogRefreshTokenQ.data);
    if (rssSyncIntervalQ.data !== null && rssSyncIntervalQ.data !== undefined) setRssSyncInterval(rssSyncIntervalQ.data);
    if (searchIntervalQ.data !== null && searchIntervalQ.data !== undefined) setSearchSchedulerInterval(searchIntervalQ.data);
    if (minScoreQ.data !== null && minScoreQ.data !== undefined) setAutoGrabMinScore(minScoreQ.data);
    if (minSeedersQ.data !== null && minSeedersQ.data !== undefined) setAutoGrabMinSeeders(minSeedersQ.data);
    if (trendingCacheQ.data !== null && trendingCacheQ.data !== undefined) setTrendingCacheInterval(trendingCacheQ.data);
    if (torrentsCacheQ.data !== null && torrentsCacheQ.data !== undefined) setTorrentsCacheInterval(torrentsCacheQ.data);
    if (discordWebhookQ.data) setDiscordWebhookUrl(discordWebhookQ.data);
    if (updatePatchHandlingQ.data) setUpdatePatchHandling(updatePatchHandlingQ.data);
    if (updatePatchPenaltyQ.data !== null && updatePatchPenaltyQ.data !== undefined) setUpdatePatchPenalty(updatePatchPenaltyQ.data);
  }, [isLoading]);

  const handleRetry = () => {
    hasSeededRef.current = false;
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
  };

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

  if (loadError) {
    return (
      <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-6 text-center">
        <p className="text-red-200 mb-4">{loadError}</p>
        <button
          onClick={handleRetry}
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
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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
    {
      id: 'system',
      label: 'System',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Security',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Settings</h2>
        <p className="text-gray-400 text-sm md:text-base">Configure Gamearr's integrations and preferences</p>
      </div>

      <div className="md:hidden mb-6">
        <label htmlFor="settings-section" className="block text-sm text-gray-400 mb-2">Settings Section</label>
        <select
          id="settings-section"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as SettingsTab)}
          className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-white min-h-[44px]"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:block border-b border-gray-700 mb-6">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
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
              trendingCacheInterval={trendingCacheInterval}
              setTrendingCacheInterval={setTrendingCacheInterval}
              torrentsCacheInterval={torrentsCacheInterval}
              setTorrentsCacheInterval={setTorrentsCacheInterval}
            />
          )}

          {activeTab === 'libraries' && (
            <LibrariesTab />
          )}

          {activeTab === 'indexers' && (
            <IndexersTab
              prowlarrUrl={prowlarrUrl}
              setProwlarrUrl={setProwlarrUrl}
              prowlarrApiKey={prowlarrApiKey}
              setProwlarrApiKey={setProwlarrApiKey}
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
              sabHost={sabHost}
              setSabHost={setSabHost}
              sabApiKey={sabApiKey}
              setSabApiKey={setSabApiKey}
              dryRun={dryRun}
              setDryRun={setDryRun}
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
              gogRefreshToken={gogRefreshToken}
              setGogRefreshToken={setGogRefreshToken}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsTab
              discordWebhookUrl={discordWebhookUrl}
              setDiscordWebhookUrl={setDiscordWebhookUrl}
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
              updatePatchHandling={updatePatchHandling}
              setUpdatePatchHandling={setUpdatePatchHandling}
              updatePatchPenalty={updatePatchPenalty}
              setUpdatePatchPenalty={setUpdatePatchPenalty}
            />
          )}

          {activeTab === 'system' && (
            <SystemTab />
          )}

          {activeTab === 'security' && (
            <SecurityTab />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default Settings;
