import { useMemo } from 'react';
import type { GameRow } from './libraryColumns';

export function useLibraryFilterOptions(games: GameRow[]) {
  const allGenres = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) g.parsedGenres.forEach((v) => s.add(v));
    return Array.from(s).sort();
  }, [games]);

  const allGameModes = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) g.parsedGameModes.forEach((v) => s.add(v));
    return Array.from(s).sort();
  }, [games]);

  const allStores = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) {
      g.stores?.forEach((store) => s.add(store.name));
      if (g.store) s.add(g.store);
    }
    return Array.from(s).sort();
  }, [games]);

  return { allGenres, allGameModes, allStores };
}
