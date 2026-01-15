import { useState, useEffect } from 'react';
import { api, type LogFile, type AppUpdateStatus, type AppUpdateSettings } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

export default function SystemTab() {
  const { addToast } = useToast();
  const [version, setVersion] = useState<string>('');
  const [uptime, setUptime] = useState<number>(0);
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [logTotalLines, setLogTotalLines] = useState<number>(0);
  const [isLoadingLog, setIsLoadingLog] = useState(false);

  // Application update state
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [updateSettings, setUpdateSettings] = useState<AppUpdateSettings | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isSavingUpdateSettings, setIsSavingUpdateSettings] = useState(false);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    setIsLoading(true);
    try {
      const [statusRes, logsRes, updateStatusRes, updateSettingsRes] = await Promise.all([
        api.getSystemStatus(),
        api.getLogFiles(),
        api.getAppUpdateStatus(),
        api.getAppUpdateSettings(),
      ]);

      if (statusRes.success && statusRes.data) {
        setVersion(statusRes.data.version);
        setUptime(statusRes.data.uptime);
      }

      if (logsRes.success && logsRes.data) {
        setLogFiles(logsRes.data.files);
      }

      if (updateStatusRes.success && updateStatusRes.data) {
        setUpdateStatus(updateStatusRes.data);
      }

      if (updateSettingsRes.success && updateSettingsRes.data) {
        setUpdateSettings(updateSettingsRes.data);
      }
    } catch (err) {
      console.error('Failed to load system info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const res = await api.checkForAppUpdates();
      if (res.success && res.data) {
        // Refresh the full update status
        const statusRes = await api.getAppUpdateStatus();
        if (statusRes.success && statusRes.data) {
          setUpdateStatus(statusRes.data);
        }
        if (res.data.updateAvailable) {
          addToast(`New version available: v${res.data.latestVersion}`, 'info');
        } else {
          addToast('Gamearr is up to date', 'success');
        }
      } else {
        addToast(res.error || 'Failed to check for updates', 'error');
      }
    } catch (err) {
      addToast('Failed to check for updates', 'error');
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleUpdateSettingChange = async (key: keyof AppUpdateSettings, value: boolean | string) => {
    if (!updateSettings) return;

    setIsSavingUpdateSettings(true);
    try {
      const res = await api.updateAppUpdateSettings({ [key]: value });
      if (res.success) {
        setUpdateSettings({ ...updateSettings, [key]: value });
        addToast('Update settings saved', 'success');
      } else {
        addToast(res.error || 'Failed to save settings', 'error');
      }
    } catch (err) {
      addToast('Failed to save settings', 'error');
    } finally {
      setIsSavingUpdateSettings(false);
    }
  };

  const handleViewLog = async (filename: string) => {
    setSelectedLog(filename);
    setIsLoadingLog(true);
    setLogContent('');

    try {
      const res = await api.getLogFileContent(filename);
      if (res.success && res.data) {
        setLogContent(res.data.content);
        setLogTotalLines(res.data.totalLines);
      } else {
        addToast(res.error || 'Failed to load log file', 'error');
      }
    } catch (err) {
      addToast('Failed to load log file', 'error');
    } finally {
      setIsLoadingLog(false);
    }
  };

  const handleDownloadLog = async (filename: string) => {
    try {
      await api.downloadLogFile(filename);
    } catch (err) {
      addToast('Failed to download log file', 'error');
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.length > 0 ? parts.join(' ') : '< 1m';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Version Info */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          System Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Version</p>
            <p className="text-xl font-mono font-semibold text-white">{version}</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Uptime</p>
            <p className="text-xl font-mono font-semibold text-white">{formatUptime(uptime)}</p>
          </div>
        </div>
      </div>

      {/* Application Updates */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Application Updates
        </h3>

        {/* Update Status */}
        {updateStatus && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-400">Current Version:</span>
                  <span className="font-mono font-semibold text-white">v{updateStatus.currentVersion}</span>
                </div>
                {updateStatus.latestVersion && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">Latest Version:</span>
                    <span className="font-mono font-semibold text-white">v{updateStatus.latestVersion}</span>
                    {updateStatus.updateAvailable && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                        Update Available
                      </span>
                    )}
                  </div>
                )}
                {updateStatus.lastChecked && (
                  <div className="text-sm text-gray-400">
                    Last checked: {new Date(updateStatus.lastChecked).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {updateStatus.updateAvailable && updateStatus.releaseUrl && (
                  <a
                    href={updateStatus.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors text-sm font-medium"
                  >
                    View Release
                  </a>
                )}
                <button
                  onClick={handleCheckForUpdates}
                  disabled={isCheckingUpdates}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {isCheckingUpdates ? 'Checking...' : 'Check Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Settings */}
        {updateSettings && (
          <div className="space-y-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Automatic Update Checking</p>
                <p className="text-sm text-gray-400">Periodically check for new Gamearr versions</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateSettings.enabled}
                  onChange={(e) => handleUpdateSettingChange('enabled', e.target.checked)}
                  disabled={isSavingUpdateSettings}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Schedule Dropdown */}
            {updateSettings.enabled && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Check Frequency</p>
                  <p className="text-sm text-gray-400">How often to check for updates</p>
                </div>
                <select
                  value={updateSettings.schedule}
                  onChange={(e) => handleUpdateSettingChange('schedule', e.target.value as 'daily' | 'weekly' | 'monthly')}
                  disabled={isSavingUpdateSettings}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Files */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Log Files
        </h3>
        <p className="text-gray-400 mb-4 text-sm md:text-base">
          View or download application log files for troubleshooting.
        </p>

        {logFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No log files found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 font-medium">Filename</th>
                  <th className="pb-3 font-medium">Size</th>
                  <th className="pb-3 font-medium hidden md:table-cell">Last Modified</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {logFiles.map((file) => (
                  <tr key={file.name} className="hover:bg-gray-750">
                    <td className="py-3 font-mono text-sm">{file.name}</td>
                    <td className="py-3 text-sm text-gray-400">{file.sizeFormatted}</td>
                    <td className="py-3 text-sm text-gray-400 hidden md:table-cell">
                      {formatDate(file.modified)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {file.viewable && (
                          <button
                            onClick={() => handleViewLog(file.name)}
                            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded transition"
                          >
                            View
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadLog(file.name)}
                          className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 rounded transition"
                        >
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-semibold">{selectedLog}</h3>
                {logTotalLines > 1000 && (
                  <p className="text-sm text-gray-400">
                    Showing last 1,000 of {logTotalLines.toLocaleString()} lines
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadLog(selectedLog)}
                  className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 rounded transition"
                >
                  Download
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-gray-400 hover:text-white transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isLoadingLog ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap break-all">
                  {logContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
