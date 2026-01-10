import { useState } from 'react';
import { formatBytes, formatTimestamp } from '../../utils/formatters';
import { FolderIcon } from '../Icons';
import { api } from '../../api/client';
import type { LooseFile, DuplicateGroup } from './types';

interface LibraryHealthTabProps {
  isLoading: boolean;
  isLoaded: boolean;
  duplicates: DuplicateGroup[];
  looseFiles: LooseFile[];
  organizingFile: string | null;
  onOrganizeFile: (filePath: string, folderName: string) => void;
  onDismissDuplicate: (group: DuplicateGroup) => void;
}

// Get the target folder name from a file (name without extension)
function getTargetFolderName(fileName: string, extension: string): string {
  return fileName.replace(new RegExp(`${extension.replace('.', '\\.')}$`, 'i'), '');
}

// Get the target folder path from a file path
function getTargetFolderPath(filePath: string, fileName: string, extension: string): string {
  const folderName = getTargetFolderName(fileName, extension);
  const parentDir = filePath.substring(0, filePath.lastIndexOf(fileName));
  return `${parentDir}${folderName}`;
}

export function LibraryHealthTab({
  isLoading,
  isLoaded,
  duplicates,
  looseFiles,
  organizingFile,
  onOrganizeFile,
  onDismissDuplicate,
}: LibraryHealthTabProps) {
  const [confirmingFile, setConfirmingFile] = useState<LooseFile | null>(null);
  const [customFolderName, setCustomFolderName] = useState<string>('');

  const handleOrganizeClick = (file: LooseFile) => {
    setConfirmingFile(file);
    // Set default folder name (filename without extension)
    setCustomFolderName(getTargetFolderName(file.name, file.extension));
  };

  const handleConfirmOrganize = () => {
    if (confirmingFile && customFolderName.trim()) {
      onOrganizeFile(confirmingFile.path, customFolderName.trim());
      setConfirmingFile(null);
      setCustomFolderName('');
    }
  };

  const handleCancelOrganize = () => {
    setConfirmingFile(null);
    setCustomFolderName('');
  };
  if (isLoading && !isLoaded) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">Scanning library health...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Duplicates Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Potential Duplicates
          {duplicates.length > 0 && (
            <span className="ml-2 bg-yellow-600 text-white text-sm px-2 py-0.5 rounded-full">
              {duplicates.length}
            </span>
          )}
        </h3>

        {duplicates.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg">
            <div className="w-10 h-10 text-green-500 flex-shrink-0">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-gray-200 font-medium">No duplicates detected</p>
              <p className="text-gray-400 text-sm">Your library doesn't have any games with similar titles that might be duplicates.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {duplicates.map((group, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-yellow-400 font-medium">
                    {group.similarity}% similar
                  </span>
                  <button
                    onClick={() => onDismissDuplicate(group)}
                    className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-gray-600 transition"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {group.games.map((game) => (
                    <div key={game.id} className="bg-gray-800 rounded p-3">
                      <h4 className="font-medium truncate" title={game.title}>
                        {game.title}
                      </h4>
                      <div className="text-sm text-gray-400 mt-1 space-y-1">
                        {game.year && <p>Year: {game.year}</p>}
                        <p>Status: <span className={`capitalize ${
                          game.status === 'downloaded' ? 'text-green-400' :
                          game.status === 'downloading' ? 'text-blue-400' : 'text-yellow-400'
                        }`}>{game.status}</span></p>
                        {game.size !== undefined && (
                          <p>Size: {formatBytes(game.size)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loose Files Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Loose Files
          {looseFiles.length > 0 && (
            <span className="ml-2 bg-orange-600 text-white text-sm px-2 py-0.5 rounded-full">
              {looseFiles.length}
            </span>
          )}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          These archive and ISO files are sitting directly in your library folder.
          Click "Organize" to create a folder and move the file into it.
        </p>

        {looseFiles.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg">
            <div className="w-10 h-10 text-green-500 flex-shrink-0">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-gray-200 font-medium">No loose files found</p>
              <p className="text-gray-400 text-sm">All files in your library folder are properly organized within game folders.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Size</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Modified</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {looseFiles.map((file) => (
                  <tr key={file.path} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="py-3 pr-4">
                      <span className="font-medium truncate block max-w-md" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500 block truncate max-w-lg" title={file.path}>
                        {file.path}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {formatBytes(file.size)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="uppercase text-xs bg-gray-600 px-2 py-1 rounded">
                        {file.extension.replace('.', '')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {formatTimestamp(file.modifiedAt)}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleOrganizeClick(file)}
                        disabled={organizingFile === file.path}
                        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition disabled:opacity-50"
                      >
                        {organizingFile === file.path ? 'Organizing...' : 'Organize'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Organize Confirmation Modal */}
      {confirmingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Organize File
            </h3>

            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">File to organize:</p>
                <p className="font-medium text-white break-all">{confirmingFile.name}</p>
                <p className="text-xs text-gray-500 mt-1 break-all">{confirmingFile.path}</p>
              </div>

              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-sm">Will be moved to:</span>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <label className="text-sm text-gray-400 mb-2 block">Target folder name:</label>
                <input
                  type="text"
                  value={customFolderName}
                  onChange={(e) => setCustomFolderName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter folder name"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Full path: <span className="text-gray-400">{confirmingFile.path.substring(0, confirmingFile.path.lastIndexOf(confirmingFile.name))}<span className="text-green-400">{customFolderName || '...'}</span>/</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  The file will be moved into this folder. If the folder doesn't exist, it will be created.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelOrganize}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOrganize}
                disabled={!customFolderName.trim()}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Organize File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
