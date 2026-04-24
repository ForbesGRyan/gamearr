import { useUpdateSettings, useTestProwlarrConnection } from '../../queries/settings';
import type { BaseStepProps, TestStatus } from './types';

interface ProwlarrStepProps extends BaseStepProps {
  url: string;
  setUrl: (value: string) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  testStatus: TestStatus;
  setTestStatus: (status: TestStatus) => void;
}

export default function ProwlarrStep({
  onNext,
  onBack,
  error,
  setError,
  url,
  setUrl,
  apiKey,
  setApiKey,
  testStatus,
  setTestStatus,
}: ProwlarrStepProps) {
  const updateSettings = useUpdateSettings();
  const testProwlarr = useTestProwlarrConnection();

  const handleTest = async () => {
    setTestStatus('testing');
    setError(null);

    try {
      // Thanks to the test-against-form-values route, we can validate the
      // credentials in-place without persisting them first.
      const connected = await testProwlarr.mutateAsync({
        url: url.trim(),
        apiKey: apiKey.trim(),
      });
      if (connected) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setError('Connection failed. Check URL and API key.');
      }
    } catch (err) {
      setTestStatus('error');
      setError(err instanceof Error ? err.message : 'Connection test failed');
    }
  };

  const handleSave = async () => {
    if (!url.trim() || !apiKey.trim()) {
      setError('Both URL and API Key are required');
      return;
    }

    setError(null);

    try {
      await updateSettings.mutateAsync({
        prowlarr_url: url.trim(),
        prowlarr_api_key: apiKey.trim(),
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Prowlarr settings');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-2">Prowlarr</h2>
      <p className="text-gray-400 mb-6">
        Prowlarr manages your indexers for searching releases.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="setup-prowlarr-url" className="block text-sm font-medium mb-2">Prowlarr URL *</label>
          <input
            id="setup-prowlarr-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:9696"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="setup-prowlarr-api-key" className="block text-sm font-medium mb-2">API Key *</label>
          <input
            id="setup-prowlarr-api-key"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Found in Prowlarr > Settings > General"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleTest}
          disabled={testStatus === 'testing' || !url || !apiKey}
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
          disabled={updateSettings.isPending}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          {updateSettings.isPending ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
