import GameCard from '../GameCard';
import type { Game, PosterSize } from './types';

interface LibraryPosterGridProps {
  games: Game[];
  selectedGameIds: Set<number>;
  onToggleMonitor: (id: number) => void;
  onDelete: (id: number) => void;
  onSearch: (game: Game) => void;
  onToggleSelect: (gameId: number) => void;
  size?: PosterSize;
}

const GRID_CLASSES: Record<PosterSize, string> = {
  sm: 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3',
  md: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
  lg: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5',
};

export function LibraryPosterGrid({
  games,
  selectedGameIds,
  onToggleMonitor,
  onDelete,
  onSearch,
  onToggleSelect,
  size = 'md',
}: LibraryPosterGridProps) {
  return (
    <div className={GRID_CLASSES[size]}>
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
