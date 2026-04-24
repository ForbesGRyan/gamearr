import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

const FIVE_MINUTES = 5 * 60_000;

export function usePopularityTypes() {
  return useQuery({
    queryKey: queryKeys.discover.popularityTypes(),
    queryFn: async () => unwrap(await api.getPopularityTypes()),
    staleTime: FIVE_MINUTES,
  });
}

export function usePopularGames(type: number | undefined, limit: number = 50) {
  return useQuery({
    queryKey:
      type !== undefined
        ? queryKeys.discover.popular(type, limit)
        : ['discover', 'popular', 'disabled'],
    queryFn: async () => unwrap(await api.getPopularGames(type!, limit)),
    enabled: type !== undefined,
    staleTime: FIVE_MINUTES,
  });
}

export function useTopTorrents(
  query?: string,
  limit?: number,
  maxAgeDays?: number
) {
  return useQuery({
    queryKey: queryKeys.indexers.topTorrents(query, limit, maxAgeDays),
    queryFn: async () => unwrap(await api.getTopTorrents(query, limit, maxAgeDays)),
    staleTime: FIVE_MINUTES,
  });
}
