import { useState, useCallback, useEffect } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
  username?: string;
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
  gogRefreshToken: string;
  setGogRefreshToken: (token: string) => void;
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
  gogRefreshToken,
  setGogRefreshToken,
}: MetadataTabProps) {
  const { addToast } = useToast();
  const [isSavingIgdb, setIsSavingIgdb] = useState(false);
  const [isSavingSteam, setIsSavingSteam] = useState(false);
  const [isSavingGog, setIsSavingGog] = useState(false);
  const [steamTest, setSteamTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [gogTest, setGogTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [isGogLoggingIn, setIsGogLoggingIn] = useState(false);
  const [showGogCodeInput, setShowGogCodeInput] = useState(false);
  const [gogCode, setGogCode] = useState('');
  const [isExchangingCode, setIsExchangingCode] = useState(false);

  // Check GOG connection on mount if token exists
  useEffect(() => {
    if (gogRefreshToken) {
      testGogConnection();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveIgdb = useCallback(async () => {
    if (!igdbClientId.trim() || !igdbClientSecret.trim()) {
      addToast('Both IGDB Client ID and Secret are required', 'error');
      return;
    }

    setIsSavingIgdb(true);
    try {
      await Promise.all([
        api.updateSetting('igdb_client_id', igdbClientId.trim()),
        api.updateSetting('igdb_client_secret', igdbClientSecret.trim()),
      ]);
      addToast('IGDB settings saved!', 'success');
    } catch {
      addToast('Failed to save IGDB settings', 'error');
    } finally {
      setIsSavingIgdb(false);
    }
  }, [igdbClientId, igdbClientSecret, addToast]);

  const handleSaveSteam = useCallback(async () => {
    setIsSavingSteam(true);
    try {
      await Promise.all([
        api.updateSetting('steam_api_key', steamApiKey),
        api.updateSetting('steam_id', steamId),
      ]);
      addToast('Steam settings saved!', 'success');
    } catch {
      addToast('Failed to save Steam settings', 'error');
    } finally {
      setIsSavingSteam(false);
    }
  }, [steamApiKey, steamId, addToast]);

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

  const handleSaveGog = useCallback(async () => {
    setIsSavingGog(true);
    try {
      await api.updateSetting('gog_refresh_token', gogRefreshToken);
      addToast('GOG settings saved!', 'success');
    } catch {
      addToast('Failed to save GOG settings', 'error');
    } finally {
      setIsSavingGog(false);
    }
  }, [gogRefreshToken, addToast]);

  const testGogConnection = useCallback(async () => {
    setGogTest({ status: 'testing' });
    try {
      const response = await api.testGogConnection();
      if (response.success && response.data?.connected) {
        setGogTest({
          status: 'success',
          message: response.data.username ? `Connected as ${response.data.username}` : 'Connected successfully!',
          username: response.data.username,
        });
      } else {
        setGogTest({ status: 'error', message: response.error || 'Connection failed' });
      }
    } catch {
      setGogTest({ status: 'error', message: 'Connection test failed' });
    }
  }, []);

  const handleGogLogin = useCallback(async () => {
    setIsGogLoggingIn(true);
    try {
      const response = await api.getGogAuthUrl();
      if (response.success && response.data?.url) {
        // Open popup for GOG login
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
          response.data.url,
          'GOG Login',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
        // Show code input after opening popup
        setShowGogCodeInput(true);
        setIsGogLoggingIn(false);
      } else {
        setIsGogLoggingIn(false);
        addToast(response.error || 'Failed to get GOG login URL', 'error');
      }
    } catch {
      setIsGogLoggingIn(false);
      addToast('Failed to start GOG login', 'error');
    }
  }, [addToast]);

  const handleGogCodeSubmit = useCallback(async () => {
    if (!gogCode.trim()) {
      addToast('Please paste the URL or code', 'error');
      return;
    }

    // Extract code from URL if user pasted full URL
    let code = gogCode.trim();
    if (code.includes('code=')) {
      try {
        const url = new URL(code.startsWith('http') ? code : `https://${code}`);
        const extractedCode = url.searchParams.get('code');
        if (extractedCode) {
          code = extractedCode;
        }
      } catch {
        // If URL parsing fails, try regex as fallback
        const match = code.match(/code=([^&]+)/);
        if (match) {
          code = match[1];
        }
      }
    }

    setIsExchangingCode(true);
    try {
      const response = await api.exchangeGogCode(code);
      if (response.success) {
        setGogTest({
          status: 'success',
          message: response.data?.username ? `Connected as ${response.data.username}` : 'Connected successfully!',
          username: response.data?.username,
        });
        addToast(`Connected to GOG${response.data?.username ? ` as ${response.data.username}` : ''}`, 'success');
        setShowGogCodeInput(false);
        setGogCode('');
        // Reload to get updated token
        window.location.reload();
      } else {
        addToast(response.error || 'Failed to connect to GOG', 'error');
      }
    } catch {
      addToast('Failed to exchange code', 'error');
    } finally {
      setIsExchangingCode(false);
    }
  }, [gogCode, addToast]);

  const handleGogLogout = useCallback(async () => {
    setIsSavingGog(true);
    try {
      await api.updateSetting('gog_refresh_token', '');
      setGogRefreshToken('');
      setGogTest({ status: 'idle' });
      addToast('Disconnected from GOG', 'success');
    } catch {
      addToast('Failed to disconnect from GOG', 'error');
    } finally {
      setIsSavingGog(false);
    }
  }, [setGogRefreshToken, addToast]);

  return (
    <>
      {/* IGDB Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
          IGDB API
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
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
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Register an application in the Twitch Developer Console. Use <span className="text-gray-400 font-mono break-all">http://localhost</span> for the OAuth Redirect URL.
          </p>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Client ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Your IGDB Client ID"
              value={igdbClientId}
              onChange={(e) => setIgdbClientId(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
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
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              Found under your application's settings in the Twitch Developer Console
            </p>
          </div>
          <button
            onClick={handleSaveIgdb}
            disabled={isSavingIgdb}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
          >
            {isSavingIgdb ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Steam Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.07.16-1.5.44l-5.23-2.16C2.31 6.67 6.63 2 12 2m6.19 8.25c0-1.31-1.07-2.38-2.38-2.38s-2.38 1.07-2.38 2.38 1.07 2.38 2.38 2.38 2.38-1.07 2.38-2.38m-12.7 5.85c0 1.1.9 1.99 1.99 1.99.89 0 1.64-.58 1.9-1.38l-1.73-.71c-.41.13-.86.06-1.21-.21a1.35 1.35 0 0 1-.25-1.9l-1.33-.55c-.49.47-.77 1.11-.77 1.8l.4-.04z"/>
          </svg>
          Steam Integration
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Steam API Key
            </label>
            <input
              type="password"
              placeholder="Your Steam Web API Key"
              value={steamApiKey}
              onChange={(e) => setSteamApiKey(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              When registering, you can use <span className="text-gray-400 font-mono">localhost</span> for the domain name
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Steam ID
            </label>
            <input
              type="text"
              placeholder="Your 64-bit Steam ID"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              View your Steam profile - copy the number from the URL: <span className="break-all">steamcommunity.com/profiles/<span className="text-blue-400 font-mono">XXXXXXXXX</span></span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveSteam}
              disabled={isSavingSteam}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {isSavingSteam ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={testSteamConnection}
              disabled={steamTest.status === 'testing' || !steamApiKey || !steamId}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
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

      {/* GOG Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="url(#gogGradient)" strokeWidth="4"/>
            <defs>
              <linearGradient id="gogGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d946ef"/>
                <stop offset="100%" stopColor="#7c3aed"/>
              </linearGradient>
            </defs>
          </svg>
          GOG Integration
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Connect your GOG account to import your owned games.
        </p>
        <div className="space-y-4">
          {/* Connected status */}
          {gogTest.status === 'success' && gogTest.username && (
            <div className="flex items-center justify-between p-3 rounded bg-green-900/30 border border-green-700">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-green-400">Connected as <strong>{gogTest.username}</strong></span>
              </div>
              <button
                onClick={handleGogLogout}
                disabled={isSavingGog}
                className="text-sm text-red-400 hover:text-red-300 transition"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Login button - show when not connected and not showing code input */}
          {gogTest.status !== 'success' && !showGogCodeInput && (
            <div className="space-y-3">
              <button
                onClick={handleGogLogin}
                disabled={isGogLoggingIn}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 px-6 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="4"/>
                </svg>
                {isGogLoggingIn ? 'Opening login...' : 'Login with GOG'}
              </button>
              <p className="text-xs text-gray-500">
                Click to open GOG login in a popup window.
              </p>
            </div>
          )}

          {/* Code input - show after login popup opens */}
          {showGogCodeInput && gogTest.status !== 'success' && (
            <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
              <div className="space-y-2">
                <h4 className="font-medium text-purple-400">Step 2: Paste the URL</h4>
                <p className="text-sm text-gray-400">
                  After logging in, copy the <strong>entire URL</strong> from the browser's address bar and paste it below.
                </p>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="https://embed.gog.com/on_login_success?origin=client&code=..."
                  value={gogCode}
                  onChange={(e) => setGogCode(e.target.value)}
                  className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 focus:outline-none text-base font-mono text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGogCodeSubmit}
                  disabled={isExchangingCode || !gogCode.trim()}
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
                >
                  {isExchangingCode ? 'Connecting...' : 'Connect'}
                </button>
                <button
                  onClick={() => { setShowGogCodeInput(false); setGogCode(''); }}
                  className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 px-4 py-3 md:py-2 rounded transition min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error status */}
          {gogTest.status === 'error' && (
            <div className="p-3 rounded bg-red-900/50 text-red-400">
              {gogTest.message}
            </div>
          )}

          {/* Advanced: Manual token input */}
          <details className="text-sm">
            <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
              Advanced: Manual token entry
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">
                Alternatively, you can enter a refresh token manually. Get it from{' '}
                <a
                  href="https://github.com/Mixaill/awesome-gog-galaxy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  GOG Galaxy tools
                </a>{' '}
                or your GOG Galaxy client's database.
              </p>
              <input
                type="password"
                placeholder="Paste refresh token here"
                value={gogRefreshToken}
                onChange={(e) => setGogRefreshToken(e.target.value)}
                className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
              />
              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                <button
                  onClick={handleSaveGog}
                  disabled={isSavingGog || !gogRefreshToken}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
                >
                  {isSavingGog ? 'Saving...' : 'Save Token'}
                </button>
                <button
                  onClick={testGogConnection}
                  disabled={gogTest.status === 'testing' || !gogRefreshToken}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
                >
                  {gogTest.status === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
