import { useState, useCallback } from 'react';
import { api } from '../../api/client';
import QBittorrentCategorySelector from '../QBittorrentCategorySelector';

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
  dryRun: boolean;
  setDryRun: (value: boolean) => void;
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

export default function DownloadsTab({
  qbHost,
  setQbHost,
  qbUsername,
  setQbUsername,
  qbPassword,
  setQbPassword,
  dryRun,
  setDryRun,
  showSaveMessage,
}: DownloadsTabProps) {
  const [qbTest, setQbTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [isSavingQb, setIsSavingQb] = useState(false);
  const [isSavingDryRun, setIsSavingDryRun] = useState(false);

  const handleSaveQb = useCallback(async () => {
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
    } catch {
      showSaveMessage('error', 'Failed to save qBittorrent settings');
    } finally {
      setIsSavingQb(false);
    }
  }, [qbHost, qbUsername, qbPassword, showSaveMessage]);

  const testQbConnection = useCallback(async () => {
    setQbTest({ status: 'testing' });
    try {
      const response = await api.testQbittorrentConnection();
      if (response.success && response.data) {
        setQbTest({ status: 'success', message: 'Connected successfully!' });
      } else {
        setQbTest({ status: 'error', message: response.error || 'Connection failed' });
      }
    } catch {
      setQbTest({ status: 'error', message: 'Connection test failed' });
    }
  }, []);

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
      {/* qBittorrent Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          qBittorrent
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Configure qBittorrent Web UI connection for download management.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Host <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="http://localhost:8080"
              value={qbHost}
              onChange={(e) => setQbHost(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              placeholder="admin"
              value={qbUsername}
              onChange={(e) => setQbUsername(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
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
              disabled={qbTest.status === 'testing'}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
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

      {/* qBittorrent Category Filter */}
      <QBittorrentCategorySelector />

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
              When enabled, Gamearr will log what it would download but won't actually send torrents to qBittorrent.
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
