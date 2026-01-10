import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

type Step = 'welcome' | 'library' | 'igdb' | 'prowlarr' | 'qbittorrent' | 'complete';

interface StepConfig {
  id: Step;
  title: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with Gamearr' },
  { id: 'library', title: 'Library', description: 'Where your games are stored' },
  { id: 'igdb', title: 'IGDB', description: 'Game metadata provider' },
  { id: 'prowlarr', title: 'Prowlarr', description: 'Indexer manager' },
  { id: 'qbittorrent', title: 'qBittorrent', description: 'Download client' },
  { id: 'complete', title: 'Complete', description: 'Setup finished' },
];

export function Setup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Form state
  const [libraryName, setLibraryName] = useState('Main Library');
  const [libraryPath, setLibraryPath] = useState('');
  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [prowlarrUrl, setProwlarrUrl] = useState('http://localhost:9696');
  const [prowlarrApiKey, setProwlarrApiKey] = useState('');
  const [qbHost, setQbHost] = useState('http://localhost:8080');
  const [qbUsername, setQbUsername] = useState('');
  const [qbPassword, setQbPassword] = useState('');

  // Check if setup is already complete
  useEffect(() => {
    const checkSetup = async () => {
      const response = await api.getSetupStatus();
      if (response.success && response.data?.isComplete) {
        navigate('/');
      }
    };
    checkSetup();
  }, [navigate]);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
      setError(null);
      setTestStatus('idle');
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
      setError(null);
      setTestStatus('idle');
    }
  };

  const handleLibrarySave = async () => {
    if (!libraryPath.trim()) {
      setError('Library path is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.createLibrary({
        name: libraryName.trim() || 'Main Library',
        path: libraryPath.trim(),
        monitored: true,
        downloadEnabled: true,
      });

      if (response.success) {
        goNext();
      } else {
        setError(response.error || 'Failed to create library');
      }
    } catch (err) {
      setError('Failed to save library settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIGDBSave = async () => {
    if (!igdbClientId.trim() || !igdbClientSecret.trim()) {
      setError('Both Client ID and Client Secret are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.updateSettings({
        igdb_client_id: igdbClientId.trim(),
        igdb_client_secret: igdbClientSecret.trim(),
      });

      if (response.success) {
        goNext();
      } else {
        setError(response.error || 'Failed to save IGDB settings');
      }
    } catch (err) {
      setError('Failed to save IGDB settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProwlarrTest = async () => {
    setTestStatus('testing');
    setError(null);

    try {
      // Save first, then test
      await api.updateSettings({
        prowlarr_url: prowlarrUrl.trim(),
        prowlarr_api_key: prowlarrApiKey.trim(),
      });

      const response = await api.testProwlarrConnection();
      if (response.success && response.data) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setError('Connection failed. Check URL and API key.');
      }
    } catch (err) {
      setTestStatus('error');
      setError('Connection test failed');
    }
  };

  const handleProwlarrSave = async () => {
    if (!prowlarrUrl.trim() || !prowlarrApiKey.trim()) {
      setError('Both URL and API Key are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.updateSettings({
        prowlarr_url: prowlarrUrl.trim(),
        prowlarr_api_key: prowlarrApiKey.trim(),
      });

      if (response.success) {
        goNext();
      } else {
        setError(response.error || 'Failed to save Prowlarr settings');
      }
    } catch (err) {
      setError('Failed to save Prowlarr settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQBittorrentTest = async () => {
    setTestStatus('testing');
    setError(null);

    try {
      // Save first, then test
      await api.updateSettings({
        qbittorrent_host: qbHost.trim(),
        qbittorrent_username: qbUsername.trim(),
        qbittorrent_password: qbPassword,
      });

      const response = await api.testQbittorrentConnection();
      if (response.success && response.data) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setError('Connection failed. Check host and credentials.');
      }
    } catch (err) {
      setTestStatus('error');
      setError('Connection test failed');
    }
  };

  const handleQBittorrentSave = async () => {
    if (!qbHost.trim() || !qbUsername.trim() || !qbPassword) {
      setError('All fields are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.updateSettings({
        qbittorrent_host: qbHost.trim(),
        qbittorrent_username: qbUsername.trim(),
        qbittorrent_password: qbPassword,
      });

      if (response.success) {
        goNext();
      } else {
        setError(response.error || 'Failed to save qBittorrent settings');
      }
    } catch (err) {
      setError('Failed to save qBittorrent settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    navigate('/');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center">
            <div className="text-6xl mb-6">🎮</div>
            <h2 className="text-3xl font-bold mb-4">Welcome to Gamearr</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Let's get your game library set up. This wizard will guide you through
              connecting your services.
            </p>
            <button
              onClick={goNext}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-medium text-lg transition"
            >
              Get Started
            </button>
          </div>
        );

      case 'library':
        return (
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-2">Library Location</h2>
            <p className="text-gray-400 mb-6">
              Where should Gamearr store and organize your games?
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Library Name</label>
                <input
                  type="text"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  placeholder="Main Library"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Library Path *</label>
                <input
                  type="text"
                  value={libraryPath}
                  onChange={(e) => setLibraryPath(e.target.value)}
                  placeholder="/path/to/games or C:\Games"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The folder where your games will be organized
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={goBack}
                className="text-gray-400 hover:text-white transition"
              >
                Back
              </button>
              <button
                onClick={handleLibrarySave}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        );

      case 'igdb':
        return (
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-2">IGDB API</h2>
            <p className="text-gray-400 mb-6">
              IGDB provides game metadata (covers, descriptions, ratings).
            </p>

            <div className="bg-gray-700/50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-300 mb-2">To get your credentials:</p>
              <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
                <li>Go to <a href="https://dev.twitch.tv/console" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">dev.twitch.tv/console</a></li>
                <li>Create or sign in to your Twitch account</li>
                <li>Register a new application</li>
                <li>Copy the Client ID and generate a Client Secret</li>
              </ol>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Client ID *</label>
                <input
                  type="text"
                  value={igdbClientId}
                  onChange={(e) => setIgdbClientId(e.target.value)}
                  placeholder="Your IGDB Client ID"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Client Secret *</label>
                <input
                  type="password"
                  value={igdbClientSecret}
                  onChange={(e) => setIgdbClientSecret(e.target.value)}
                  placeholder="Your IGDB Client Secret"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={goBack}
                className="text-gray-400 hover:text-white transition"
              >
                Back
              </button>
              <button
                onClick={handleIGDBSave}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        );

      case 'prowlarr':
        return (
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-2">Prowlarr</h2>
            <p className="text-gray-400 mb-6">
              Prowlarr manages your indexers for searching releases.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Prowlarr URL *</label>
                <input
                  type="text"
                  value={prowlarrUrl}
                  onChange={(e) => setProwlarrUrl(e.target.value)}
                  placeholder="http://localhost:9696"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">API Key *</label>
                <input
                  type="text"
                  value={prowlarrApiKey}
                  onChange={(e) => setProwlarrApiKey(e.target.value)}
                  placeholder="Found in Prowlarr > Settings > General"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleProwlarrTest}
                disabled={testStatus === 'testing' || !prowlarrUrl || !prowlarrApiKey}
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

            <div className="flex justify-between mt-8">
              <button
                onClick={goBack}
                className="text-gray-400 hover:text-white transition"
              >
                Back
              </button>
              <button
                onClick={handleProwlarrSave}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        );

      case 'qbittorrent':
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
                  value={qbHost}
                  onChange={(e) => setQbHost(e.target.value)}
                  placeholder="http://localhost:8080"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Username *</label>
                <input
                  type="text"
                  value={qbUsername}
                  onChange={(e) => setQbUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password *</label>
                <input
                  type="password"
                  value={qbPassword}
                  onChange={(e) => setQbPassword(e.target.value)}
                  placeholder="Your qBittorrent password"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleQBittorrentTest}
                disabled={testStatus === 'testing' || !qbHost || !qbUsername || !qbPassword}
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

            <div className="flex justify-between mt-8">
              <button
                onClick={goBack}
                className="text-gray-400 hover:text-white transition"
              >
                Back
              </button>
              <button
                onClick={handleQBittorrentSave}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold mb-4">You're All Set!</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Gamearr is configured and ready to use. Start by adding games to your library
              or import existing games from your folders.
            </p>
            <button
              onClick={handleFinish}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-medium text-lg transition"
            >
              Start Using Gamearr
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Progress bar */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <div className="bg-gray-800 px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              {STEPS.filter(s => s.id !== 'welcome' && s.id !== 'complete').map((step, index) => {
                const stepIndex = STEPS.findIndex(s => s.id === step.id);
                const isActive = currentStepIndex >= stepIndex;
                const isCurrent = currentStep === step.id;

                return (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isActive ? 'bg-blue-600' : 'bg-gray-700'
                      } ${isCurrent ? 'ring-2 ring-blue-400' : ''}`}
                    >
                      {index + 1}
                    </div>
                    {index < 3 && (
                      <div
                        className={`w-16 sm:w-24 h-1 mx-2 ${
                          currentStepIndex > stepIndex ? 'bg-blue-600' : 'bg-gray-700'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Library</span>
              <span>IGDB</span>
              <span>Prowlarr</span>
              <span>qBittorrent</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {renderStepContent()}
      </div>
    </div>
  );
}
