import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Indexer {
  id: number;
  name: string;
  enable: boolean;
  protocol: 'torrent' | 'usenet';
  privacy: 'public' | 'private' | 'semiPrivate';
}

function IndexerStatus() {
  const [indexers, setIndexers] = useState<Indexer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIndexers();
  }, []);

  const loadIndexers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getIndexers();

      if (response.success && response.data) {
        setIndexers(response.data as any);
      } else {
        setError(response.error || 'Failed to load indexers');
      }
    } catch (err) {
      setError('Failed to load indexers');
    } finally {
      setIsLoading(false);
    }
  };

  const getProtocolBadgeColor = (protocol: string) => {
    return protocol === 'torrent' ? 'bg-blue-700' : 'bg-purple-700';
  };

  const getPrivacyBadgeColor = (privacy: string) => {
    switch (privacy) {
      case 'public':
        return 'bg-green-700';
      case 'private':
        return 'bg-red-700';
      case 'semiPrivate':
        return 'bg-yellow-700';
      default:
        return 'bg-gray-700';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Indexers</h3>
        <button
          onClick={loadIndexers}
          className="text-sm text-blue-400 hover:text-blue-300 transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading indexers...</p>
        </div>
      ) : indexers.length === 0 ? (
        <div className="bg-gray-700 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-2">No indexers configured</p>
          <p className="text-gray-500 text-sm">
            Configure Prowlarr in Settings to enable indexers
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {indexers.map((indexer) => (
            <div
              key={indexer.id}
              className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${indexer.enable ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <span className="font-medium">{indexer.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`${getProtocolBadgeColor(indexer.protocol)} px-2 py-1 rounded text-xs`}>
                  {indexer.protocol}
                </span>
                <span className={`${getPrivacyBadgeColor(indexer.privacy)} px-2 py-1 rounded text-xs`}>
                  {indexer.privacy}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-center">
        {indexers.length} indexer{indexers.length !== 1 ? 's' : ''} available
      </div>
    </div>
  );
}

export default IndexerStatus;
