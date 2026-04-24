import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useSearchGames(
  query: string,
  options?: { enabled?: boolean; minLength?: number }
) {
  const minLength = options?.minLength ?? 1;
  const trimmed = query.trim();
  const enabled = (options?.enabled ?? true) && trimmed.length >= minLength;
  return useQuery({
    queryKey: queryKeys.search.games(trimmed),
    queryFn: async () => unwrap(await api.searchGames(trimmed)),
    enabled,
    staleTime: 60_000,
  });
}

export function useManualSearchReleases(
  query: string,
  options?: { enabled?: boolean; minLength?: number }
) {
  const minLength = options?.minLength ?? 1;
  const trimmed = query.trim();
  const enabled = (options?.enabled ?? true) && trimmed.length >= minLength;
  return useQuery({
    queryKey: queryKeys.search.releases(trimmed),
    queryFn: async () => unwrap(await api.manualSearchReleases(trimmed)),
    enabled,
    staleTime: 60_000,
  });
}
