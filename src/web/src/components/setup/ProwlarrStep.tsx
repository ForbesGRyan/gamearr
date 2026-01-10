import { useState } from 'react';
import { api } from '../../api/client';
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
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    setTestStatus('testing');
    setError(null);

    try {
      // Save first, then test
      await api.updateSettings({
        prowlarr_url: url.trim(),
        prowlarr_api_key: apiKey.trim(),
      });

      const response = await api.testProwlarrConnection();
      if (response.success && response.data) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setError('Connection failed. Check URL and API key.');
      }
    } catch {
      setTestStatus('error');
      setError('Connection test failed');
    }
  };

  const handleSave = async () => {
    if (!url.trim() || !apiKey.trim()) {
      setError('Both URL and API Key are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.updateSettings({
        prowlarr_url: url.trim(),
        prowlarr_api_key: apiKey.trim(),
      });

      if (response.success) {
        onNext();
      } else {
        setError(response.error || 'Failed to save Prowlarr settings');
      }
    } catch {
      setError('Failed to save Prowlarr settings');
    } finally {
      setIsLoading(false);
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
          <label className="block text-sm font-medium mb-2">Prowlarr URL *</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:9696"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">API Key *</label>
          <input
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
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
