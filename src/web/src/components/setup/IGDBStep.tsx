import { useState } from 'react';
import { api } from '../../api/client';
import type { BaseStepProps } from './types';

interface IGDBStepProps extends BaseStepProps {
  clientId: string;
  setClientId: (value: string) => void;
  clientSecret: string;
  setClientSecret: (value: string) => void;
}

export default function IGDBStep({
  onNext,
  onBack,
  error,
  setError,
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
}: IGDBStepProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Both Client ID and Client Secret are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.updateSettings({
        igdb_client_id: clientId.trim(),
        igdb_client_secret: clientSecret.trim(),
      });

      if (response.success) {
        onNext();
      } else {
        setError(response.error || 'Failed to save IGDB settings');
      }
    } catch {
      setError('Failed to save IGDB settings');
    } finally {
      setIsLoading(false);
    }
  };

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
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your IGDB Client ID"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Client Secret *</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
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
