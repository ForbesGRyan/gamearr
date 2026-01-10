import { useState, useCallback } from 'react';
import { api } from '../../api/client';

interface GeneralTabProps {
  rssSyncInterval: number;
  setRssSyncInterval: (value: number) => void;
  searchSchedulerInterval: number;
  setSearchSchedulerInterval: (value: number) => void;
  autoGrabMinScore: number;
  setAutoGrabMinScore: (value: number) => void;
  autoGrabMinSeeders: number;
  setAutoGrabMinSeeders: (value: number) => void;
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

export default function GeneralTab({
  rssSyncInterval,
  setRssSyncInterval,
  searchSchedulerInterval,
  setSearchSchedulerInterval,
  autoGrabMinScore,
  setAutoGrabMinScore,
  autoGrabMinSeeders,
  setAutoGrabMinSeeders,
  showSaveMessage,
}: GeneralTabProps) {
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);

  const handleSaveAutomation = useCallback(async () => {
    setIsSavingAutomation(true);
    try {
      const results = await Promise.all([
        api.updateSetting('rss_sync_interval', rssSyncInterval),
        api.updateSetting('search_scheduler_interval', searchSchedulerInterval),
        api.updateSetting('auto_grab_min_score', autoGrabMinScore),
        api.updateSetting('auto_grab_min_seeders', autoGrabMinSeeders),
      ]);

      const allSuccessful = results.every((r) => r.success);
      if (allSuccessful) {
        showSaveMessage('success', 'Automation settings saved! Changes will take effect on next job run.');
      } else {
        showSaveMessage('error', 'Some settings failed to save');
      }
    } catch {
      showSaveMessage('error', 'Failed to save automation settings');
    } finally {
      setIsSavingAutomation(false);
    }
  }, [rssSyncInterval, searchSchedulerInterval, autoGrabMinScore, autoGrabMinSeeders, showSaveMessage]);

  return (
    <>
      {/* Automation Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Automation Settings
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Configure how often Gamearr searches for releases and the criteria for automatic downloads.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* RSS Sync Interval */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              RSS Sync Interval (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={1440}
              value={rssSyncInterval}
              onChange={(e) => setRssSyncInterval(Math.max(5, Math.min(1440, parseInt(e.target.value) || 15)))}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              How often to fetch new releases from RSS feeds (5-1440 min)
            </p>
          </div>

          {/* Search Scheduler Interval */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Search Interval (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={1440}
              value={searchSchedulerInterval}
              onChange={(e) => setSearchSchedulerInterval(Math.max(5, Math.min(1440, parseInt(e.target.value) || 15)))}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              How often to actively search for wanted games (5-1440 min)
            </p>
          </div>

          {/* Auto-Grab Min Score */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Minimum Quality Score
            </label>
            <input
              type="number"
              min={0}
              max={500}
              value={autoGrabMinScore}
              onChange={(e) => setAutoGrabMinScore(Math.max(0, Math.min(500, parseInt(e.target.value) || 100)))}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              Releases must score at least this to auto-download (0-500)
            </p>
          </div>

          {/* Auto-Grab Min Seeders */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Minimum Seeders
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={autoGrabMinSeeders}
              onChange={(e) => setAutoGrabMinSeeders(Math.max(0, Math.min(100, parseInt(e.target.value) || 5)))}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              Releases must have at least this many seeders (0-100)
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-700 rounded text-sm text-gray-300">
          <strong>Current auto-grab criteria:</strong> Score {'>='} {autoGrabMinScore} AND Seeders {'>='} {autoGrabMinSeeders}
        </div>

        <button
          onClick={handleSaveAutomation}
          disabled={isSavingAutomation}
          className="mt-4 w-full md:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {isSavingAutomation ? 'Saving...' : 'Save Automation Settings'}
        </button>
      </div>
    </>
  );
}
