import { useState, useMemo } from 'react';
import { GamepadIcon } from '../Icons';
import StoreSelector from '../StoreSelector';
import { LibraryPagination } from './LibraryPagination';
import type { LibraryFolder, AutoMatchSuggestion } from './types';
import type { Library } from '../../api/client';

interface LibraryScanTabProps {
  isScanLoaded: boolean;
  isScanning: boolean;
  libraryFolders: LibraryFolder[];
  autoMatchSuggestions: Record<string, AutoMatchSuggestion>;
  isAutoMatching: Record<string, boolean>;
  selectedStore: Record<string, string | undefined>;
  libraries: Library[];
  selectedLibrary: Record<string, number | undefined>;
  onScanLibrary: () => void;
  onAutoMatch: (folder: LibraryFolder) => void;
  onManualMatch: (folder: LibraryFolder) => void;
  onIgnoreFolder: (folderPath: string) => void;
  onConfirmAutoMatch: (folder: LibraryFolder) => void;
  onEditAutoMatch: (folder: LibraryFolder) => void;
  onCancelAutoMatch: (folder: LibraryFolder) => void;
  onStoreChange: (folderPath: string, store: string | undefined) => void;
  onLibraryChange: (folderPath: string, libraryId: number | undefined) => void;
  onOpenSteamImport: () => void;
}

export function LibraryScanTab({
  isScanLoaded,
  isScanning,
  libraryFolders,
  autoMatchSuggestions,
  isAutoMatching,
  selectedStore,
  libraries,
  selectedLibrary,
  onScanLibrary,
  onAutoMatch,
  onManualMatch,
  onIgnoreFolder,
  onConfirmAutoMatch,
  onEditAutoMatch,
  onCancelAutoMatch,
  onStoreChange,
  onLibraryChange,
  onOpenSteamImport,
}: LibraryScanTabProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('library-scan-page-size');
    return saved ? parseInt(saved, 10) : 25;
  });

  // Calculate paginated folders
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(libraryFolders.length / pageSize));
  }, [libraryFolders.length, pageSize]);

  const paginatedFolders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return libraryFolders.slice(startIndex, startIndex + pageSize);
  }, [libraryFolders, currentPage, pageSize]);

  // Reset to page 1 when folders change significantly
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    localStorage.setItem('library-scan-page-size', newSize.toString());
  };

  return (
    <>
      {/* Import Sources */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Import from Steam</h3>
            <p className="text-sm text-gray-400">Import games from your Steam library</p>
          </div>
          <button
            onClick={onOpenSteamImport}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.07.16-1.5.44l-5.23-2.16C2.31 6.67 6.63 2 12 2m6.19 8.25c0-1.31-1.07-2.38-2.38-2.38s-2.38 1.07-2.38 2.38 1.07 2.38 2.38 2.38 2.38-1.07 2.38-2.38m-12.7 5.85c0 1.1.9 1.99 1.99 1.99.89 0 1.64-.58 1.9-1.38l-1.73-.71c-.41.13-.86.06-1.21-.21a1.35 1.35 0 0 1-.25-1.9l-1.33-.55c-.49.47-.77 1.11-.77 1.8l.4-.04z"/>
            </svg>
            Import from Steam
          </button>
        </div>
      </div>

      {!isScanLoaded ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-lg mb-4">
            Scan your library to find and import unmatched game folders.
          </p>
          <button
            onClick={onScanLibrary}
            disabled={isScanning}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded transition disabled:opacity-50"
          >
            {isScanning ? 'Scanning...' : 'Scan Library Now'}
          </button>
        </div>
      ) : libraryFolders.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-green-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-300 mb-2">All folders imported</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Every folder in your library has been matched to a game or ignored. Add new games to your library folder and scan again to import them.
          </p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">
            Folders to Import ({libraryFolders.length})
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            These folders aren't linked to any games yet. Click "Match" to search and link each
            folder to a game, or "Ignore" to hide it.
          </p>
          <div className="space-y-3">
            {paginatedFolders.map((folder) => {
              const suggestion = autoMatchSuggestions[folder.path];
              const isMatching = isAutoMatching[folder.path];

              return (
                <div key={folder.path} className="bg-gray-700 rounded p-4">
                  {/* Folder Info */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span>
                          {folder.cleanedTitle}
                          {folder.parsedYear && ` (${folder.parsedYear})`}
                        </span>
                        {folder.parsedVersion && (
                          <span className="px-2 py-0.5 text-xs bg-blue-600 rounded">
                            v{folder.parsedVersion}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {folder.relativePath || folder.folderName}
                      </div>
                    </div>
                    {!suggestion && (
                      <div className="flex gap-2">
                        <button
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => onAutoMatch(folder)}
                          disabled={isMatching}
                        >
                          {isMatching ? 'Searching...' : 'Auto Match'}
                        </button>
                        <button
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm"
                          onClick={() => onManualMatch(folder)}
                        >
                          Manual Match
                        </button>
                        <button
                          className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition text-sm"
                          onClick={() => onIgnoreFolder(folder.path)}
                        >
                          Ignore
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Auto-Match Suggestion Card */}
                  {suggestion && (
                    <div className="mt-4 p-4 bg-gray-800 rounded border border-green-600">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-20 h-28 rounded flex-shrink-0 bg-gray-700">
                          {suggestion.coverUrl ? (
                            <img
                              src={suggestion.coverUrl}
                              alt={suggestion.title}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <GamepadIcon className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-green-400 text-sm font-medium mb-1">
                            Suggested Match
                          </div>
                          <h4 className="font-semibold text-lg">
                            {suggestion.title}
                            {suggestion.year && (
                              <span className="text-gray-400 ml-2">({suggestion.year})</span>
                            )}
                          </h4>
                          {suggestion.platforms && (
                            <p className="text-sm text-gray-400 mt-1">
                              {suggestion.platforms.slice(0, 3).join(', ')}
                            </p>
                          )}
                          {suggestion.summary && (
                            <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                              {suggestion.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mb-4 flex gap-4">
                        <div className="flex-1">
                          <StoreSelector
                            value={selectedStore[folder.path] || null}
                            onChange={(store) => onStoreChange(folder.path, store || undefined)}
                            label="Digital Store (Optional)"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Select a store if you own this game digitally.
                          </p>
                        </div>
                        {libraries.length > 0 && (
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Add to Library
                            </label>
                            <select
                              value={selectedLibrary[folder.path] || ''}
                              onChange={(e) => onLibraryChange(folder.path, e.target.value ? Number(e.target.value) : undefined)}
                              className="w-full bg-gray-600 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                            >
                              <option value="">No Library (General)</option>
                              {libraries.map((lib) => (
                                <option key={lib.id} value={lib.id}>
                                  {lib.name} {lib.platform ? `(${lib.platform})` : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                              Organize this game into a library.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition text-sm flex-1"
                          onClick={() => onConfirmAutoMatch(folder)}
                        >
                          Confirm Match
                        </button>
                        <button
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-sm"
                          onClick={() => onEditAutoMatch(folder)}
                        >
                          Edit Match
                        </button>
                        <button
                          className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition text-sm"
                          onClick={() => onCancelAutoMatch(folder)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <LibraryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={libraryFolders.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            itemLabel="folders"
          />
        </div>
      )}
    </>
  );
}
