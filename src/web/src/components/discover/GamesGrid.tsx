import { PopularGame, GameSearchResult, MultiplayerInfo } from './types';
import GameCard from './GameCard';

interface GamesGridProps {
  filteredGames: PopularGame[];
  totalGames: number;
  isLoading: boolean;
  popularityTypeName: string;
  activeFilterCount: number;
  addingGameId: number | null;
  onAddToLibrary: (game: GameSearchResult) => void;
  onClearFilters: () => void;
  getMultiplayerBadges: (mp: MultiplayerInfo | undefined) => string[];
}

export default function GamesGrid({
  filteredGames,
  totalGames,
  isLoading,
  popularityTypeName,
  activeFilterCount,
  addingGameId,
  onAddToLibrary,
  onClearFilters,
  getMultiplayerBadges,
}: GamesGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Results count */}
      <div className="mb-4 text-gray-400">
        Showing {filteredGames.length} of {totalGames} games ranked by {popularityTypeName}
        {activeFilterCount > 0 && (
          <span className="ml-2 text-blue-400">
            ({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)
          </span>
        )}
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredGames.map((pg) => (
          <GameCard
            key={pg.game.igdbId}
            popularGame={pg}
            isAdding={addingGameId === pg.game.igdbId}
            onAddToLibrary={() => onAddToLibrary(pg.game)}
            getMultiplayerBadges={getMultiplayerBadges}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredGames.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          {totalGames === 0 ? (
            <>
              <h3 className="text-xl font-medium text-gray-300 mb-2">No games available</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                We couldn't find any games for this popularity ranking. This may be a temporary issue with IGDB. Try selecting a different ranking type.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-medium text-gray-300 mb-2">No games match your filters</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-4">
                Try adjusting your genre, theme, or multiplayer filters to see more games.
              </p>
              <button
                onClick={onClearFilters}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition text-white"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
