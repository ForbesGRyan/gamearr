import { useState, useEffect } from 'react';
import { api, type LogFile } from '../../api/client';
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

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    setIsLoading(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        api.getSystemStatus(),
        api.getLogFiles(),
      ]);

      if (statusRes.success && statusRes.data) {
        setVersion(statusRes.data.version);
        setUptime(statusRes.data.uptime);
      }

      if (logsRes.success && logsRes.data) {
        setLogFiles(logsRes.data.files);
      }
    } catch (err) {
      console.error('Failed to load system info:', err);
    } finally {
      setIsLoading(false);
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
