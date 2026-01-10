interface FilterPanelProps {
  availableGenres: string[];
  availableThemes: string[];
  selectedGenres: string[];
  selectedThemes: string[];
  multiplayerOnly: boolean;
  activeFilterCount: number;
  onToggleGenre: (genre: string) => void;
  onToggleTheme: (theme: string) => void;
  onToggleMultiplayer: () => void;
  onClearFilters: () => void;
}

export default function FilterPanel({
  availableGenres,
  availableThemes,
  selectedGenres,
  selectedThemes,
  multiplayerOnly,
  activeFilterCount,
  onToggleGenre,
  onToggleTheme,
  onToggleMultiplayer,
  onClearFilters,
}: FilterPanelProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 mb-4 border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-medium">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-400 hover:text-blue-300 min-h-[44px] px-2 flex items-center"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
        {/* Genres */}
        <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-2">Genres</label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {availableGenres.map(genre => (
              <button
                key={genre}
                onClick={() => onToggleGenre(genre)}
                className={`text-xs px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2 sm:py-1 rounded transition ${
                  selectedGenres.includes(genre)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {genre}
              </button>
            ))}
            {availableGenres.length === 0 && (
              <span className="text-xs text-gray-500">No genres available</span>
            )}
          </div>
        </div>

        {/* Themes */}
        <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-2">Themes</label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {availableThemes.map(theme => (
              <button
                key={theme}
                onClick={() => onToggleTheme(theme)}
                className={`text-xs px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2 sm:py-1 rounded transition ${
                  selectedThemes.includes(theme)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {theme}
              </button>
            ))}
            {availableThemes.length === 0 && (
              <span className="text-xs text-gray-500">No themes available</span>
            )}
          </div>
        </div>

        {/* Multiplayer */}
        <div className="w-full sm:w-auto">
          <label className="block text-sm text-gray-400 mb-2">Features</label>
          <button
            onClick={onToggleMultiplayer}
            className={`text-xs px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2 sm:py-1 rounded transition ${
              multiplayerOnly
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Multiplayer Only
          </button>
        </div>
      </div>
    </div>
  );
}
