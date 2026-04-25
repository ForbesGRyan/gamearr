import { useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useUpdateSetting } from '../../queries/settings';
import { useCheckAllUpdates } from '../../queries/updates';

interface UpdatesTabProps {
  updateCheckEnabled: boolean;
  setUpdateCheckEnabled: (enabled: boolean) => void;
  updateCheckSchedule: 'hourly' | 'daily' | 'weekly';
  setUpdateCheckSchedule: (schedule: 'hourly' | 'daily' | 'weekly') => void;
  defaultUpdatePolicy: 'notify' | 'auto' | 'ignore';
  setDefaultUpdatePolicy: (policy: 'notify' | 'auto' | 'ignore') => void;
  updatePatchHandling: 'penalize' | 'hide' | 'warn_only';
  setUpdatePatchHandling: (value: 'penalize' | 'hide' | 'warn_only') => void;
  updatePatchPenalty: number;
  setUpdatePatchPenalty: (value: number) => void;
}

export default function UpdatesTab({
  updateCheckEnabled,
  setUpdateCheckEnabled,
  updateCheckSchedule,
  setUpdateCheckSchedule,
  defaultUpdatePolicy,
  setDefaultUpdatePolicy,
  updatePatchHandling,
  setUpdatePatchHandling,
  updatePatchPenalty,
  setUpdatePatchPenalty,
}: UpdatesTabProps) {
  const { addToast } = useToast();
  const updateSetting = useUpdateSetting();
  const checkAllUpdates = useCheckAllUpdates();

  const handleSaveUpdateSettings = useCallback(async () => {
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'update_check_enabled', value: updateCheckEnabled }),
        updateSetting.mutateAsync({ key: 'update_check_schedule', value: updateCheckSchedule }),
        updateSetting.mutateAsync({ key: 'default_update_policy', value: defaultUpdatePolicy }),
        updateSetting.mutateAsync({ key: 'update_patch_handling', value: updatePatchHandling }),
        updateSetting.mutateAsync({ key: 'update_patch_penalty', value: updatePatchPenalty }),
      ]);
      addToast('Update check settings saved!', 'success');
    } catch {
      addToast('Failed to save update check settings', 'error');
    }
  }, [updateCheckEnabled, updateCheckSchedule, defaultUpdatePolicy, updatePatchHandling, updatePatchPenalty, addToast, updateSetting]);

  const handleToggleUpdateCheckEnabled = useCallback(async () => {
    const next = !updateCheckEnabled;
    setUpdateCheckEnabled(next);
    try {
      await updateSetting.mutateAsync({ key: 'update_check_enabled', value: next });
    } catch {
      setUpdateCheckEnabled(!next);
      addToast('Failed to update setting', 'error');
    }
  }, [updateCheckEnabled, setUpdateCheckEnabled, updateSetting, addToast]);

  const handleCheckUpdatesNow = useCallback(async () => {
    try {
      const data = await checkAllUpdates.mutateAsync();
      const { checked, updatesFound } = data as { checked: number; updatesFound: number };
      addToast(`Checked ${checked} games, found ${updatesFound} updates`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check for updates';
      addToast(message, 'error');
    }
  }, [addToast, checkAllUpdates]);

  return (
    <>
      {/* Update Checking */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Update Checking
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          Configure automatic checking for game updates, DLC, and better quality releases.
        </p>
        <div className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <label htmlFor="setting-update-check-enabled" className="block text-sm font-medium text-gray-300">Enable Update Checking</label>
              <p className="text-xs text-gray-500 mt-1">
                Automatically check downloaded games for available updates
              </p>
            </div>
            <button
              onClick={handleToggleUpdateCheckEnabled}
              className={`relative inline-flex h-8 w-14 md:h-6 md:w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                updateCheckEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-7 w-7 md:h-5 md:w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                  updateCheckEnabled ? 'translate-x-6 md:translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Schedule */}
          <div>
            <label htmlFor="setting-update-check-schedule" className="block text-sm font-medium text-gray-300 mb-2">Check Schedule</label>
            <select
              id="setting-update-check-schedule"
              value={updateCheckSchedule}
              onChange={(e) => setUpdateCheckSchedule(e.target.value as 'hourly' | 'daily' | 'weekly')}
              disabled={!updateCheckEnabled}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 text-base"
            >
              <option value="hourly">Hourly (for testing)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How often to check for updates
            </p>
          </div>

          {/* Default Policy */}
          <div>
            <label htmlFor="setting-default-update-policy" className="block text-sm font-medium text-gray-300 mb-2">Default Update Policy</label>
            <select
              id="setting-default-update-policy"
              value={defaultUpdatePolicy}
              onChange={(e) => setDefaultUpdatePolicy(e.target.value as 'notify' | 'auto' | 'ignore')}
              className="w-full px-4 py-3 md:py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-base"
            >
              <option value="notify">Notify - Show badge when updates are available</option>
              <option value="auto">Auto-download - Automatically grab updates</option>
              <option value="ignore">Ignore - Don't check for updates</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Default policy for new games (can be overridden per-game)
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleCheckUpdatesNow}
              disabled={checkAllUpdates.isPending || !updateCheckEnabled}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
            >
              {checkAllUpdates.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Check Now
                </>
              )}
            </button>
          </div>
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
            <label htmlFor="setting-update-patch-handling" className="block text-sm text-gray-400 mb-1">
              Update/Patch Handling
            </label>
            <select
              id="setting-update-patch-handling"
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
            <label htmlFor="setting-update-patch-penalty" className="block text-sm text-gray-400 mb-1">
              Score Penalty
            </label>
            <input
              id="setting-update-patch-penalty"
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

        <button
          onClick={handleSaveUpdateSettings}
          disabled={updateSetting.isPending}
          className="mt-4 w-full md:w-auto bg-green-600 hover:bg-green-700 px-4 py-3 md:py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {updateSetting.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </>
  );
}
