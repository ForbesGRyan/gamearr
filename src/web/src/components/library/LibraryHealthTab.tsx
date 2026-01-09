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
  onOrganizeFile: (filePath: string) => void;
  onDismissDuplicate: (group: DuplicateGroup) => void;
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
                        onClick={() => onOrganizeFile(file.path)}
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
    </div>
  );
}
