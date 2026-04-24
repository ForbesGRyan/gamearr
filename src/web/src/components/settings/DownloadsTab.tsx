import { useState, useCallback } from 'react';
import QBittorrentCategorySelector from '../QBittorrentCategorySelector';
import { useToast } from '../../contexts/ToastContext';
import {
  useUpdateSetting,
  useTestQbittorrentConnection,
  useTestSabnzbdConnection,
} from '../../queries/settings';

interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

interface DownloadsTabProps {
  qbHost: string;
  setQbHost: (host: string) => void;
  qbUsername: string;
  setQbUsername: (username: string) => void;
  qbPassword: string;
  setQbPassword: (password: string) => void;
  sabHost: string;
  setSabHost: (host: string) => void;
  sabApiKey: string;
  setSabApiKey: (apiKey: string) => void;
  dryRun: boolean;
  setDryRun: (value: boolean) => void;
}

export default function DownloadsTab({
  qbHost,
  setQbHost,
  qbUsername,
  setQbUsername,
  qbPassword,
  setQbPassword,
  sabHost,
  setSabHost,
  sabApiKey,
  setSabApiKey,
  dryRun,
  setDryRun,
}: DownloadsTabProps) {
  const { addToast } = useToast();
  const [qbTest, setQbTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [sabTest, setSabTest] = useState<ConnectionTestResult>({ status: 'idle' });

  const updateSetting = useUpdateSetting();
  const testQb = useTestQbittorrentConnection();
  const testSab = useTestSabnzbdConnection();

  const [isSavingQb, setIsSavingQb] = useState(false);
  const [isSavingSab, setIsSavingSab] = useState(false);
  const [isSavingDryRun, setIsSavingDryRun] = useState(false);

  const handleSaveQb = useCallback(async () => {
    if (!qbHost.trim()) {
      addToast('qBittorrent host is required', 'error');
      return;
    }

    setIsSavingQb(true);
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'qbittorrent_host', value: qbHost.trim() }),
        updateSetting.mutateAsync({ key: 'qbittorrent_username', value: qbUsername }),
        updateSetting.mutateAsync({ key: 'qbittorrent_password', value: qbPassword }),
      ]);
      addToast('qBittorrent settings saved!', 'success');
    } catch {
      addToast('Failed to save qBittorrent settings', 'error');
    } finally {
      setIsSavingQb(false);
    }
  }, [qbHost, qbUsername, qbPassword, addToast, updateSetting]);

  const testQbConnection = useCallback(async () => {
    if (!qbHost.trim()) {
      setQbTest({ status: 'error', message: 'Enter host first' });
      return;
    }
    setQbTest({ status: 'testing' });
    try {
      await testQb.mutateAsync({
        host: qbHost.trim(),
        username: qbUsername,
        password: qbPassword,
      });
      setQbTest({ status: 'success', message: 'Connected successfully!' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setQbTest({ status: 'error', message });
    }
  }, [qbHost, qbUsername, qbPassword, testQb]);

  const handleSaveSab = useCallback(async () => {
    if (!sabHost.trim()) {
      addToast('SABnzbd host is required', 'error');
      return;
    }
    if (!sabApiKey.trim()) {
      addToast('SABnzbd API key is required', 'error');
      return;
    }

    setIsSavingSab(true);
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'sabnzbd_host', value: sabHost.trim() }),
        updateSetting.mutateAsync({ key: 'sabnzbd_api_key', value: sabApiKey.trim() }),
      ]);
      addToast('SABnzbd settings saved!', 'success');
    } catch {
      addToast('Failed to save SABnzbd settings', 'error');
    } finally {
      setIsSavingSab(false);
    }
  }, [sabHost, sabApiKey, addToast, updateSetting]);

  const testSabConnection = useCallback(async () => {
    if (!sabHost.trim() || !sabApiKey.trim()) {
      setSabTest({ status: 'error', message: 'Enter host and API key first' });
      return;
    }
    setSabTest({ status: 'testing' });
    try {
      await testSab.mutateAsync({
        host: sabHost.trim(),
        apiKey: sabApiKey.trim(),
      });
      setSabTest({ status: 'success', message: 'Connected successfully!' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setSabTest({ status: 'error', message });
    }
  }, [sabHost, sabApiKey, testSab]);

  const handleToggleDryRun = useCallback(async () => {
    setIsSavingDryRun(true);
    try {
      const newValue = !dryRun;
      await updateSetting.mutateAsync({ key: 'dry_run', value: newValue });
      setDryRun(newValue);
      addToast(`Dry-run mode ${newValue ? 'enabled' : 'disabled'}`, 'success');
    } catch {
      addToast('Failed to update dry-run mode', 'error');
    } finally {
      setIsSavingDryRun(false);
    }
  }, [dryRun, setDryRun, addToast, updateSetting]);

  return (
    <>
      {/* qBittorrent Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          qBittorrent
          <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">Torrents</span>
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Configure qBittorrent Web UI connection for torrent download management.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="setting-qb-host" className="block text-sm text-gray-400 mb-1">
              Host <span className="text-red-400">*</span>
            </label>
            <input
              id="setting-qb-host"
              type="text"
              placeholder="http://localhost:8080"
              value={qbHost}
              onChange={(e) => setQbHost(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label htmlFor="setting-qb-username" className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              id="setting-qb-username"
              type="text"
              placeholder="admin"
              value={qbUsername}
              onChange={(e) => setQbUsername(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label htmlFor="setting-qb-password" className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              id="setting-qb-password"
              type="password"
              placeholder="adminadmin"
              value={qbPassword}
              onChange={(e) => setQbPassword(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveQb}
              disabled={isSavingQb}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {isSavingQb ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={testQbConnection}
              disabled={testQb.isPending}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {testQb.isPending ? 'Testing...' : 'Test Connection'}
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

      {/* qBittorrent Category Filter */}
      <QBittorrentCategorySelector />

      {/* SABnzbd Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          SABnzbd
          <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded">Usenet</span>
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Configure SABnzbd connection for Usenet/NZB download management. Optional — only needed if you use Usenet indexers in Prowlarr.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="setting-sab-host" className="block text-sm text-gray-400 mb-1">
              Host <span className="text-red-400">*</span>
            </label>
            <input
              id="setting-sab-host"
              type="text"
              placeholder="http://localhost:8080"
              value={sabHost}
              onChange={(e) => setSabHost(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label htmlFor="setting-sab-apikey" className="block text-sm text-gray-400 mb-1">
              API Key <span className="text-red-400">*</span>
            </label>
            <input
              id="setting-sab-apikey"
              type="password"
              placeholder="Your SABnzbd API key"
              value={sabApiKey}
              onChange={(e) => setSabApiKey(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              Found in SABnzbd Settings &gt; General &gt; API Key
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveSab}
              disabled={isSavingSab}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {isSavingSab ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={testSabConnection}
              disabled={testSab.isPending}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {testSab.isPending ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          {sabTest.status !== 'idle' && sabTest.status !== 'testing' && (
            <p className={`text-sm mt-2 ${
              sabTest.status === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {sabTest.message}
            </p>
          )}
        </div>
      </div>

      {/* Dry-Run Mode */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg md:text-xl font-semibold mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Dry-Run Mode
            </h3>
            <p className="text-gray-400 text-sm">
              When enabled, Gamearr will log what it would download but won't actually send releases to download clients.
              Useful for testing your configuration.
            </p>
          </div>
          <button
            onClick={handleToggleDryRun}
            disabled={isSavingDryRun}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg font-semibold transition min-h-[44px] ${
              dryRun
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 hover:bg-gray-700 text-gray-200'
            } disabled:opacity-50`}
          >
            {isSavingDryRun ? 'Saving...' : dryRun ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>
    </>
  );
}
