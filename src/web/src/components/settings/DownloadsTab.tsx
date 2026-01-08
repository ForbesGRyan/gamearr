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
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

export default function DownloadsTab({
  qbHost,
  setQbHost,
  qbUsername,
  setQbUsername,
  qbPassword,
  setQbPassword,
  showSaveMessage,
}: DownloadsTabProps) {
  const [qbTest, setQbTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [isSavingQb, setIsSavingQb] = useState(false);

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

  return (
    <>
      {/* qBittorrent Settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          qBittorrent
        </h3>
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

      {/* qBittorrent Category Filter */}
      <QBittorrentCategorySelector />
    </>
  );
}
