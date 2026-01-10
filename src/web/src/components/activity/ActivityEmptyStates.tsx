interface LoadingStateProps {
  // No props needed, but interface for consistency
}

export function LoadingState(_props: LoadingStateProps) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-400 text-lg">Loading downloads...</p>
    </div>
  );
}

interface NoDownloadsStateProps {
  // No props needed
}

export function NoDownloadsState(_props: NoDownloadsStateProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-300 mb-2">No active downloads</h3>
      <p className="text-gray-500 mb-6">
        Download releases from the Search page or game cards to see activity here
      </p>
    </div>
  );
}

interface NoMatchingDownloadsStateProps {
  onClearFilters: () => void;
}

export function NoMatchingDownloadsState({ onClearFilters }: NoMatchingDownloadsStateProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-300 mb-2">No matching downloads</h3>
      <p className="text-gray-500 mb-6">No downloads match your search or filter criteria</p>
      <button onClick={onClearFilters} className="text-blue-400 hover:text-blue-300">
        Clear filters
      </button>
    </div>
  );
}
