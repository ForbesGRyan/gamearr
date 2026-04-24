import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DownloadHistoryEntry,
  Game,
  GameEvent,
  GameIntegrationData,
  GameUpdate,
  GrabbedRelease,
  Release,
} from '../api/client';
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

export function useGameReleases(gameId: number | undefined) {
  return useQuery({
    queryKey:
      gameId !== undefined
        ? queryKeys.games.releases(gameId)
        : ['games', 'releases', 'disabled'],
    queryFn: async () => unwrap(await api.getGameReleases(gameId!)),
    enabled: gameId !== undefined,
  });
}

export function useGameHistory(gameId: number | undefined) {
  return useQuery({
    queryKey:
      gameId !== undefined
        ? queryKeys.games.history(gameId)
        : ['games', 'history', 'disabled'],
    queryFn: async () => unwrap(await api.getGameHistory(gameId!)),
    enabled: gameId !== undefined,
  });
}

export function useGameUpdates(gameId: number | undefined) {
  return useQuery({
    queryKey:
      gameId !== undefined
        ? queryKeys.games.updates(gameId)
        : ['games', 'updates', 'disabled'],
    queryFn: async () => unwrap(await api.getGameUpdates(gameId!)),
    enabled: gameId !== undefined,
  });
}

export function useGameEvents(gameId: number | undefined) {
  return useQuery({
    queryKey:
      gameId !== undefined
        ? queryKeys.games.events(gameId)
        : ['games', 'events', 'disabled'],
    queryFn: async () => unwrap(await api.getGameEvents(gameId!)),
    enabled: gameId !== undefined,
  });
}

export function useGameIntegrations(gameId: number | undefined) {
  return useQuery({
    queryKey:
      gameId !== undefined
        ? queryKeys.games.integrations(gameId)
        : ['games', 'integrations', 'disabled'],
    queryFn: async () => unwrap(await api.getGameIntegrations(gameId!)),
    enabled: gameId !== undefined,
    staleTime: 5 * 60_000,
  });
}

export function useSearchReleasesForGame(
  gameId: number | undefined,
  options?: { enabled?: boolean }
) {
  const enabled = gameId !== undefined && (options?.enabled ?? true);
  return useQuery({
    queryKey:
      gameId !== undefined
        ? queryKeys.search.releasesForGame(gameId)
        : ['search', 'releases', 'game', 'disabled'],
    queryFn: async () => unwrap(await api.searchReleases(gameId!)),
    enabled,
    staleTime: 60_000,
  });
}

export function useAddGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (game: Parameters<typeof api.addGame>[0]) =>
      unwrap(await api.addGame(game)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
    },
  });
}

export function useUpdateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: number;
      updates: Parameters<typeof api.updateGame>[1];
    }) => unwrap(await api.updateGame(vars.id, vars.updates)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
    },
  });
}

export function useUpdateGameStores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: number; stores: string[] }) =>
      unwrap(await api.updateGameStores(vars.id, vars.stores)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
    },
  });
}

export function useRematchGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: number; igdbId: number }) =>
      unwrap(await api.rematchGame(vars.id, vars.igdbId)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
    },
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

// Optimistic monitor toggle: flip the Game's `monitored` flag in the
// games.list cache immediately so the UI reacts with zero latency, then
// reconcile with the server response. On failure, the snapshot taken in
// onMutate is restored.
export function useToggleMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.toggleMonitor(id)),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.games.list() });
      const previous = qc.getQueryData<Game[]>(queryKeys.games.list());
      if (previous) {
        qc.setQueryData<Game[]>(
          queryKeys.games.list(),
          previous.map((g) =>
            g.id === id ? { ...g, monitored: !g.monitored } : g
          )
        );
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.games.list(), ctx.previous);
      }
    },
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
      qc.invalidateQueries({ queryKey: queryKeys.games.detail(id) });
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
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.games.list() });
      const previous = qc.getQueryData<Game[]>(queryKeys.games.list());
      if (previous) {
        const selected = new Set(vars.gameIds);
        qc.setQueryData<Game[]>(
          queryKeys.games.list(),
          previous.map((g) =>
            selected.has(g.id) ? { ...g, ...vars.updates } : g
          )
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.games.list(), ctx.previous);
      }
    },
    onSettled: () => {
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

export function useDeleteGameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: number; folderId: number }) =>
      unwrap(await api.deleteGameFolder(vars.gameId, vars.folderId)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.detail(vars.gameId) });
      qc.invalidateQueries({ queryKey: queryKeys.games.folders(vars.gameId) });
    },
  });
}

export function useSetFolderAsPrimary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: number; folderId: number }) =>
      unwrap(await api.setFolderAsPrimary(vars.gameId, vars.folderId)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.detail(vars.gameId) });
      qc.invalidateQueries({ queryKey: queryKeys.games.folders(vars.gameId) });
    },
  });
}

export function useGrabRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      gameId: number;
      release: Parameters<typeof api.grabRelease>[1];
    }) => unwrap(await api.grabRelease(vars.gameId, vars.release)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.releases(vars.gameId) });
      qc.invalidateQueries({ queryKey: queryKeys.games.detail(vars.gameId) });
      qc.invalidateQueries({ queryKey: queryKeys.downloads.all });
    },
  });
}

export function useCheckGameForUpdates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: number) =>
      unwrap(await api.checkGameForUpdates(gameId)),
    onSuccess: (_data, gameId) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.updates(gameId) });
      qc.invalidateQueries({ queryKey: queryKeys.updates.pending() });
    },
  });
}

export function useGrabUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updateId: number) => unwrap(await api.grabUpdate(updateId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.games.all });
      qc.invalidateQueries({ queryKey: queryKeys.updates.pending() });
      qc.invalidateQueries({ queryKey: queryKeys.downloads.all });
    },
  });
}

export function useDismissUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updateId: number) => unwrap(await api.dismissUpdate(updateId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.games.all });
      qc.invalidateQueries({ queryKey: queryKeys.updates.pending() });
    },
  });
}

export function useSyncGameIntegrations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: number) =>
      unwrap(await api.syncGameIntegrations(gameId)),
    onSuccess: (_data, gameId) => {
      qc.invalidateQueries({ queryKey: queryKeys.games.integrations(gameId) });
    },
  });
}

export type {
  DownloadHistoryEntry,
  Game,
  GameEvent,
  GameIntegrationData,
  GameUpdate,
  GrabbedRelease,
  Release,
};
