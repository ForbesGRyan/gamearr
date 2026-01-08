import { useState, useCallback } from 'react';
import { api } from '../../api/client';

interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

interface MetadataTabProps {
  igdbClientId: string;
  setIgdbClientId: (id: string) => void;
  igdbClientSecret: string;
  setIgdbClientSecret: (secret: string) => void;
  steamApiKey: string;
  setSteamApiKey: (key: string) => void;
  steamId: string;
  setSteamId: (id: string) => void;
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

export default function MetadataTab({
  igdbClientId,
  setIgdbClientId,
  igdbClientSecret,
  setIgdbClientSecret,
  steamApiKey,
  setSteamApiKey,
  steamId,
  setSteamId,
  showSaveMessage,
}: MetadataTabProps) {
  const [isSavingIgdb, setIsSavingIgdb] = useState(false);
  const [isSavingSteam, setIsSavingSteam] = useState(false);
  const [steamTest, setSteamTest] = useState<ConnectionTestResult>({ status: 'idle' });

  const handleSaveIgdb = useCallback(async () => {
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
    } catch {
      showSaveMessage('error', 'Failed to save IGDB settings');
    } finally {
      setIsSavingIgdb(false);
    }
  }, [igdbClientId, igdbClientSecret, showSaveMessage]);

  const handleSaveSteam = useCallback(async () => {
    setIsSavingSteam(true);
    try {
      await Promise.all([
        api.updateSetting('steam_api_key', steamApiKey),
        api.updateSetting('steam_id', steamId),
      ]);
      showSaveMessage('success', 'Steam settings saved!');
    } catch {
      showSaveMessage('error', 'Failed to save Steam settings');
    } finally {
      setIsSavingSteam(false);
    }
  }, [steamApiKey, steamId, showSaveMessage]);

  const testSteamConnection = useCallback(async () => {
    setSteamTest({ status: 'testing' });
    try {
      const response = await api.testSteamConnection();
      if (response.success && response.data) {
        setSteamTest({ status: 'success', message: 'Connected successfully!' });
      } else {
        setSteamTest({ status: 'error', message: response.error || 'Connection failed' });
      }
    } catch {
      setSteamTest({ status: 'error', message: 'Connection test failed' });
    }
  }, []);

  return (
    <>
      {/* IGDB Settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
          IGDB API
        </h3>
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

      {/* Steam Settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.07.16-1.5.44l-5.23-2.16C2.31 6.67 6.63 2 12 2m6.19 8.25c0-1.31-1.07-2.38-2.38-2.38s-2.38 1.07-2.38 2.38 1.07 2.38 2.38 2.38 2.38-1.07 2.38-2.38m-12.7 5.85c0 1.1.9 1.99 1.99 1.99.89 0 1.64-.58 1.9-1.38l-1.73-.71c-.41.13-.86.06-1.21-.21a1.35 1.35 0 0 1-.25-1.9l-1.33-.55c-.49.47-.77 1.11-.77 1.8l.4-.04z"/>
          </svg>
          Steam Integration
        </h3>
        <p className="text-gray-400 mb-4">
          Connect your Steam account to import your owned games.
          Get your API key from{' '}
          <a
            href="https://steamcommunity.com/dev/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Steam Web API
          </a>.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Steam API Key
            </label>
            <input
              type="password"
              placeholder="Your Steam Web API Key"
              value={steamApiKey}
              onChange={(e) => setSteamApiKey(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Steam ID
            </label>
            <input
              type="text"
              placeholder="Your 64-bit Steam ID (e.g., 76561198012345678)"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              View your Steam profile - the ID is in the URL (e.g., steamcommunity.com/profiles/<span className="text-gray-400">76561198012345678</span>)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveSteam}
              disabled={isSavingSteam}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
            >
              {isSavingSteam ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={testSteamConnection}
              disabled={steamTest.status === 'testing' || !steamApiKey || !steamId}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50"
            >
              {steamTest.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          {steamTest.status !== 'idle' && steamTest.status !== 'testing' && (
            <div className={`p-3 rounded ${steamTest.status === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
              {steamTest.message}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
