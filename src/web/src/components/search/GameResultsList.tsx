import { SearchResult } from '../../api/client';
import GameResultCard from './GameResultCard';

interface GameResultsListProps {
  results: SearchResult[];
  addingGameId: number | null;
  selectedPlatforms: Record<number, string>;
  onPlatformChange: (igdbId: number, platform: string) => void;
  selectedLibraries: Record<number, number | null>;
  defaultLibraryId: number | null;
  onCardLibraryChange: (igdbId: number, libraryId: number | null) => void;
  onAddGame: (game: SearchResult, searchReleases: boolean) => void;
}

function GameResultsList({
  results,
  addingGameId,
  selectedPlatforms,
  onPlatformChange,
  selectedLibraries,
  defaultLibraryId,
  onCardLibraryChange,
  onAddGame,
}: GameResultsListProps) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">
          {results.length} game{results.length !== 1 ? 's' : ''} found
        </h3>
      </div>

      <div className="space-y-3">
        {results.map((game) => {
          const cardLibrary = selectedLibraries[game.igdbId];
          const effectiveLibrary = cardLibrary !== undefined ? cardLibrary : defaultLibraryId;
          return (
            <GameResultCard
              key={game.igdbId}
              game={game}
              addingGameId={addingGameId}
              selectedPlatform={selectedPlatforms[game.igdbId]}
              onPlatformChange={onPlatformChange}
              selectedLibraryId={effectiveLibrary}
              onLibraryChange={(libraryId) => onCardLibraryChange(game.igdbId, libraryId)}
              onAddGame={onAddGame}
            />
          );
        })}
      </div>
    </div>
  );
}

export default GameResultsList;
