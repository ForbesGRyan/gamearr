import { useState, useEffect } from 'react';
import { api, GameIntegrationData } from '../../api/client';
import { RefreshIcon, ClockIcon, LinuxIcon } from '../Icons';

interface GameIntegrationSectionProps {
  gameId: number;
}

// ProtonDB tier colors
const tierColors: Record<string, string> = {
  native: 'bg-green-500',
  platinum: 'bg-purple-500',
  gold: 'bg-yellow-500',
  silver: 'bg-gray-400',
  bronze: 'bg-orange-500',
  borked: 'bg-red-500',
  pending: 'bg-gray-600',
};

function GameIntegrationSection({ gameId }: GameIntegrationSectionProps) {
  const [data, setData] = useState<GameIntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const response = await api.getGameIntegrations(gameId);
    if (response.success && response.data) {
      setData(response.data);
      setError(null);
    } else {
      setError(response.error || 'Failed to load integration data');
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    const response = await api.syncGameIntegrations(gameId);
    if (response.success && response.data) {
      setData(response.data);
      setError(null);
    } else {
      setError(response.error || 'Failed to sync');
    }
    setSyncing(false);
  };

  useEffect(() => {
    loadData();
  }, [gameId]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">External Data</h3>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition disabled:opacity-50"
          title="Refresh data from HowLongToBeat and ProtonDB"
        >
          <RefreshIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HowLongToBeat */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClockIcon className="w-5 h-5 text-blue-400" />
            <h4 className="font-medium">HowLongToBeat</h4>
          </div>

          {data?.hltb.hltbId ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Main Story</span>
                <span className="font-semibold text-blue-400">{data.hltb.mainFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Main + Extras</span>
                <span className="font-semibold text-purple-400">{data.hltb.mainExtraFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Completionist</span>
                <span className="font-semibold text-orange-400">{data.hltb.completionistFormatted}</span>
              </div>
              {data.hltb.lastSync && (
                <p className="text-xs text-gray-500 mt-2">
                  Updated: {new Date(data.hltb.lastSync).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              {data?.hltb.lastSync ? 'No match found' : 'Not synced yet'}
            </div>
          )}
        </div>

        {/* ProtonDB */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <LinuxIcon className="w-5 h-5 text-yellow-400" />
            <h4 className="font-medium">ProtonDB (Linux/Steam Deck)</h4>
          </div>

          {data?.protonDb.tier ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className={`${tierColors[data.protonDb.tier]} px-3 py-1 rounded-full text-sm font-semibold text-white`}
                >
                  {data.protonDb.tierLabel}
                </span>
                {data.protonDb.isPlayable ? (
                  <span className="text-green-400 text-sm">Playable</span>
                ) : (
                  <span className="text-red-400 text-sm">Issues</span>
                )}
              </div>
              <p className="text-sm text-gray-400">
                {data.protonDb.tierDescription}
              </p>
              {data.protonDb.lastSync && (
                <p className="text-xs text-gray-500">
                  Updated: {new Date(data.protonDb.lastSync).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              {data?.protonDb.lastSync
                ? 'No data (requires Steam app ID)'
                : 'Not synced yet'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameIntegrationSection;
