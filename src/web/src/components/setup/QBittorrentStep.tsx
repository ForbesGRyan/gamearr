import { useState } from 'react';
import { api } from '../../api/client';
import type { BaseStepProps, TestStatus } from './types';

interface QBittorrentStepProps extends BaseStepProps {
  host: string;
  setHost: (value: string) => void;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  testStatus: TestStatus;
  setTestStatus: (status: TestStatus) => void;
}

export default function QBittorrentStep({
  onNext,
  onBack,
  error,
  setError,
  host,
  setHost,
  username,
  setUsername,
  password,
  setPassword,
  testStatus,
  setTestStatus,
}: QBittorrentStepProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    setTestStatus('testing');
    setError(null);

    try {
      // Save first, then test
      await api.updateSettings({
        qbittorrent_host: host.trim(),
        qbittorrent_username: username.trim(),
        qbittorrent_password: password,
      });

      const response = await api.testQbittorrentConnection();
      if (response.success && response.data) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setError('Connection failed. Check host and credentials.');
      }
    } catch {
      setTestStatus('error');
      setError('Connection test failed');
    }
  };

  const handleSave = async () => {
    if (!host.trim() || !username.trim()) {
      setError('Host and username are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.updateSettings({
        qbittorrent_host: host.trim(),
        qbittorrent_username: username.trim(),
        qbittorrent_password: password,
      });

      if (response.success) {
        onNext();
      } else {
        setError(response.error || 'Failed to save qBittorrent settings');
      }
    } catch {
      setError('Failed to save qBittorrent settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-2">qBittorrent</h2>
      <p className="text-gray-400 mb-6">
        qBittorrent handles your downloads.
      </p>

      <div className="bg-gray-700/50 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-400">
          Make sure the Web UI is enabled in qBittorrent:<br />
          <span className="text-gray-300">Tools → Options → Web UI → Enable</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Host URL *</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="http://localhost:8080"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Username *</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank if not set"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleTest}
          disabled={testStatus === 'testing' || !host || !username}
          className="w-full bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {testStatus === 'testing' ? (
            <>Testing...</>
          ) : testStatus === 'success' ? (
            <><span className="text-green-400">✓</span> Connected</>
          ) : testStatus === 'error' ? (
            <><span className="text-red-400">✗</span> Test Failed</>
          ) : (
            'Test Connection'
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="text-gray-500 hover:text-gray-300 text-sm transition"
        >
          Skip
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
