import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Game } from '../api/client';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useGames() {
  return useQuery({
    queryKey: queryKeys.games.list(),
    queryFn: async () => unwrap(await api.getGames()),
  });
}

export function useGame(id: number | undefined) {
  return useQuery({
    queryKey: id !== undefined ? queryKeys.games.detail(id) : ['games', 'detail', 'disabled'],
    queryFn: async () => unwrap(await api.getGame(id!)),
    enabled: id !== undefined,
  });
}

export function useGameBySlug(platform: string | undefined, slug: string | undefined) {
  const enabled = Boolean(platform && slug);
  return useQuery({
    queryKey:
      platform && slug
        ? queryKeys.games.bySlug(platform, slug)
        : ['games', 'slug', 'disabled'],
    queryFn: async () => unwrap(await api.getGameBySlug(platform!, slug!)),
    enabled,
  });
}

export function useDeleteGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.deleteGame(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.games.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
    },
  });
}

export function useBatchUpdateGames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      gameIds: number[];
      updates: { monitored?: boolean; status?: 'wanted' | 'downloading' | 'downloaded' };
    }) => unwrap(await api.batchUpdateGames(vars.gameIds, vars.updates)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.games.all });
    },
  });
}

export function useBatchDeleteGames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gameIds: number[]) =>
      unwrap(await api.batchDeleteGames(gameIds)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.games.all });
    },
  });
}

export type { Game };
