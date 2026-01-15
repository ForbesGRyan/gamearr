import { useState, useCallback } from 'react';
import { api } from '../../api/client';
import IndexerStatus from '../IndexerStatus';
import CategorySelector from '../CategorySelector';
import { useToast } from '../../contexts/ToastContext';

interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

interface IndexersTabProps {
  prowlarrUrl: string;
  setProwlarrUrl: (url: string) => void;
  prowlarrApiKey: string;
  setProwlarrApiKey: (key: string) => void;
}

export default function IndexersTab({
  prowlarrUrl,
  setProwlarrUrl,
  prowlarrApiKey,
  setProwlarrApiKey,
}: IndexersTabProps) {
  const { addToast } = useToast();
  const [prowlarrTest, setProwlarrTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [isSavingProwlarr, setIsSavingProwlarr] = useState(false);

  const handleSaveProwlarr = useCallback(async () => {
    if (!prowlarrUrl.trim()) {
      addToast('Prowlarr URL is required', 'error');
      return;
    }

    setIsSavingProwlarr(true);
    try {
      await Promise.all([
        api.updateSetting('prowlarr_url', prowlarrUrl.trim()),
        api.updateSetting('prowlarr_api_key', prowlarrApiKey),
      ]);
      addToast('Prowlarr settings saved!', 'success');
    } catch {
      addToast('Failed to save Prowlarr settings', 'error');
    } finally {
      setIsSavingProwlarr(false);
    }
  }, [prowlarrUrl, prowlarrApiKey, addToast]);

  const testProwlarrConnection = useCallback(async () => {
    setProwlarrTest({ status: 'testing' });
    try {
      const response = await api.testProwlarrConnection();
      if (response.success && response.data) {
        setProwlarrTest({ status: 'success', message: 'Connected successfully!' });
      } else {
        setProwlarrTest({ status: 'error', message: response.error || 'Connection failed' });
      }
    } catch {
      setProwlarrTest({ status: 'error', message: 'Connection test failed' });
    }
  }, []);

  return (
    <>
      {/* Prowlarr Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          Prowlarr
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Configure Prowlarr for indexer management and release searching.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Prowlarr URL <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="http://localhost:9696"
              value={prowlarrUrl}
              onChange={(e) => setProwlarrUrl(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              placeholder="Your Prowlarr API Key"
              value={prowlarrApiKey}
              onChange={(e) => setProwlarrApiKey(e.target.value)}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveProwlarr}
              disabled={isSavingProwlarr}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {isSavingProwlarr ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={testProwlarrConnection}
              disabled={prowlarrTest.status === 'testing'}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              {prowlarrTest.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          {prowlarrTest.status !== 'idle' && prowlarrTest.status !== 'testing' && (
            <p className={`text-sm mt-2 ${
              prowlarrTest.status === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {prowlarrTest.message}
            </p>
          )}
        </div>
      </div>

      {/* Category Selection */}
      <CategorySelector />

      {/* Indexer Status */}
      <IndexerStatus />
    </>
  );
}
