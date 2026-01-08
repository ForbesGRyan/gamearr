import { useState, useCallback } from 'react';
import { api } from '../../api/client';

interface UpdatesTabProps {
  updateCheckEnabled: boolean;
  setUpdateCheckEnabled: (enabled: boolean) => void;
  updateCheckSchedule: 'hourly' | 'daily' | 'weekly';
  setUpdateCheckSchedule: (schedule: 'hourly' | 'daily' | 'weekly') => void;
  defaultUpdatePolicy: 'notify' | 'auto' | 'ignore';
  setDefaultUpdatePolicy: (policy: 'notify' | 'auto' | 'ignore') => void;
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

export default function UpdatesTab({
  updateCheckEnabled,
  setUpdateCheckEnabled,
  updateCheckSchedule,
  setUpdateCheckSchedule,
  defaultUpdatePolicy,
  setDefaultUpdatePolicy,
  showSaveMessage,
}: UpdatesTabProps) {
  const [isSavingUpdateSettings, setIsSavingUpdateSettings] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  const handleSaveUpdateSettings = useCallback(async () => {
    setIsSavingUpdateSettings(true);
    try {
      await Promise.all([
        api.updateSetting('update_check_enabled', updateCheckEnabled),
        api.updateSetting('update_check_schedule', updateCheckSchedule),
        api.updateSetting('default_update_policy', defaultUpdatePolicy),
      ]);
      showSaveMessage('success', 'Update check settings saved!');
    } catch {
      showSaveMessage('error', 'Failed to save update check settings');
    } finally {
      setIsSavingUpdateSettings(false);
    }
  }, [updateCheckEnabled, updateCheckSchedule, defaultUpdatePolicy, showSaveMessage]);

  const handleCheckUpdatesNow = useCallback(async () => {
    setIsCheckingUpdates(true);
    try {
      const response = await api.checkAllUpdates();
      if (response.success && response.data) {
        const { checked, updatesFound } = response.data as { checked: number; updatesFound: number };
        showSaveMessage('success', `Checked ${checked} games, found ${updatesFound} updates`);
      } else {
        showSaveMessage('error', response.error || 'Failed to check for updates');
      }
    } catch {
      showSaveMessage('error', 'Failed to check for updates');
    } finally {
      setIsCheckingUpdates(false);
    }
  }, [showSaveMessage]);

  return (
    <>
      {/* Update Checking */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Update Checking
        </h3>
        <p className="text-gray-400 mb-4">
          Configure automatic checking for game updates, DLC, and better quality releases.
        </p>
        <div className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-300">Enable Update Checking</label>
              <p className="text-xs text-gray-500 mt-1">
                Automatically check downloaded games for available updates
              </p>
            </div>
            <button
              onClick={() => setUpdateCheckEnabled(!updateCheckEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                updateCheckEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                  updateCheckEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Check Schedule</label>
            <select
              value={updateCheckSchedule}
              onChange={(e) => setUpdateCheckSchedule(e.target.value as 'hourly' | 'daily' | 'weekly')}
              disabled={!updateCheckEnabled}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Default Update Policy</label>
            <select
              value={defaultUpdatePolicy}
              onChange={(e) => setDefaultUpdatePolicy(e.target.value as 'notify' | 'auto' | 'ignore')}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
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
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveUpdateSettings}
              disabled={isSavingUpdateSettings}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
            >
              {isSavingUpdateSettings ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={handleCheckUpdatesNow}
              disabled={isCheckingUpdates || !updateCheckEnabled}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 flex items-center gap-2"
            >
              {isCheckingUpdates ? (
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
    </>
  );
}
