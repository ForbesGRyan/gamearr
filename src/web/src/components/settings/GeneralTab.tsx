import { useState, useCallback } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

interface GeneralTabProps {
  rssSyncInterval: number;
  setRssSyncInterval: (value: number) => void;
  searchSchedulerInterval: number;
  setSearchSchedulerInterval: (value: number) => void;
  autoGrabMinScore: number;
  setAutoGrabMinScore: (value: number) => void;
  autoGrabMinSeeders: number;
  setAutoGrabMinSeeders: (value: number) => void;
  trendingCacheInterval: number;
  setTrendingCacheInterval: (value: number) => void;
  torrentsCacheInterval: number;
  setTorrentsCacheInterval: (value: number) => void;
  updatePatchHandling: 'penalize' | 'hide' | 'warn_only';
  setUpdatePatchHandling: (value: 'penalize' | 'hide' | 'warn_only') => void;
  updatePatchPenalty: number;
  setUpdatePatchPenalty: (value: number) => void;
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
  trendingCacheInterval,
  setTrendingCacheInterval,
  torrentsCacheInterval,
  setTorrentsCacheInterval,
  updatePatchHandling,
  setUpdatePatchHandling,
  updatePatchPenalty,
  setUpdatePatchPenalty,
}: GeneralTabProps) {
  const { addToast } = useToast();
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);

  const handleSaveAutomation = useCallback(async () => {
    setIsSavingAutomation(true);
    try {
      const results = await Promise.all([
        api.updateSetting('rss_sync_interval', rssSyncInterval),
        api.updateSetting('search_scheduler_interval', searchSchedulerInterval),
        api.updateSetting('auto_grab_min_score', autoGrabMinScore),
        api.updateSetting('auto_grab_min_seeders', autoGrabMinSeeders),
        api.updateSetting('trending_games_cache_interval', trendingCacheInterval),
        api.updateSetting('top_torrents_cache_interval', torrentsCacheInterval),
        api.updateSetting('update_patch_handling', updatePatchHandling),
        api.updateSetting('update_patch_penalty', updatePatchPenalty),
      ]);

      const allSuccessful = results.every((r) => r.success);
      if (allSuccessful) {
        addToast('Automation settings saved! Changes will take effect on next job run.', 'success');
      } else {
        addToast('Some settings failed to save', 'error');
      }
    } catch {
      addToast('Failed to save automation settings', 'error');
    } finally {
      setIsSavingAutomation(false);
    }
  }, [rssSyncInterval, searchSchedulerInterval, autoGrabMinScore, autoGrabMinSeeders, trendingCacheInterval, torrentsCacheInterval, updatePatchHandling, updatePatchPenalty, addToast]);

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
      </div>

      {/* Update/Patch Detection Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Update/Patch Detection
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Control how Gamearr handles releases that are updates or patches only (not full games).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Update/Patch Handling Mode */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Update/Patch Handling
            </label>
            <select
              value={updatePatchHandling}
              onChange={(e) => setUpdatePatchHandling(e.target.value as 'penalize' | 'hide' | 'warn_only')}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            >
              <option value="penalize">Penalize Score</option>
              <option value="hide">Hide from Results</option>
              <option value="warn_only">Show Warning Only</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How to handle releases detected as update-only or patch-only
            </p>
          </div>

          {/* Update/Patch Penalty */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Score Penalty
            </label>
            <input
              type="number"
              min={0}
              max={200}
              value={updatePatchPenalty}
              onChange={(e) => setUpdatePatchPenalty(Math.max(0, Math.min(200, parseInt(e.target.value) || 80)))}
              disabled={updatePatchHandling !== 'penalize'}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Points to subtract from update/patch releases (0-200, only applies when penalizing)
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-700 rounded text-sm text-gray-300">
          <strong>Detection examples:</strong>
          <ul className="mt-2 space-y-1 text-gray-400">
            <li><span className="text-orange-400">Update Only:</span> "Game.Title.Update.v1.5-GROUP", "Game Title Update Only"</li>
            <li><span className="text-yellow-400">Patch Only:</span> "Game.Title.Patch.1.2-GROUP", "Game Title Patch Only"</li>
            <li><span className="text-green-400">Full Game:</span> "Game Title v1.5.3 Updated-GROUP" (includes updates)</li>
          </ul>
        </div>
      </div>

      {/* Cache Settings */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          Cache Settings
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Configure how often Gamearr refreshes cached data for the Discover page.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Trending Games Cache Interval */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Trending Games Cache (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={60}
              value={trendingCacheInterval}
              onChange={(e) => setTrendingCacheInterval(Math.max(5, Math.min(60, parseInt(e.target.value) || 15)))}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              How often to refresh trending games from IGDB (5-60 min)
            </p>
          </div>

          {/* Top Torrents Cache Interval */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Top Torrents Cache (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={torrentsCacheInterval}
              onChange={(e) => setTorrentsCacheInterval(Math.max(1, Math.min(30, parseInt(e.target.value) || 5)))}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <p className="text-xs text-gray-500 mt-1">
              How often to refresh top torrents from Prowlarr (1-30 min)
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveAutomation}
          disabled={isSavingAutomation}
          className="mt-4 w-full md:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {isSavingAutomation ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </>
  );
}
