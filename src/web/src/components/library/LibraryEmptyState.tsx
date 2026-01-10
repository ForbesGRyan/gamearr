interface LibraryEmptyStateProps {
  onAddGame: () => void;
}

export function LibraryEmptyState({ onAddGame }: LibraryEmptyStateProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-300 mb-2">No games yet</h3>
      <p className="text-gray-500 mb-6">Add your first game to start building your library</p>
      <button
        onClick={onAddGame}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition"
      >
        Add Game
      </button>
    </div>
  );
}
