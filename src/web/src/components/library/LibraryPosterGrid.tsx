import GameCard from '../GameCard';
import type { Game } from './types';

interface LibraryPosterGridProps {
  games: Game[];
  selectedGameIds: Set<number>;
  onToggleMonitor: (id: number) => void;
  onDelete: (id: number) => void;
  onSearch: (game: Game) => void;
  onToggleSelect: (gameId: number) => void;
}

export function LibraryPosterGrid({
  games,
  selectedGameIds,
  onToggleMonitor,
  onDelete,
  onSearch,
  onToggleSelect,
}: LibraryPosterGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {games.map((game, index) => (
        <GameCard
          key={game.id}
          game={game}
          onToggleMonitor={onToggleMonitor}
          onDelete={onDelete}
          onSearch={onSearch}
          selected={selectedGameIds.has(game.id)}
          onToggleSelect={onToggleSelect}
          priority={index < 8}
        />
      ))}
    </div>
  );
}
