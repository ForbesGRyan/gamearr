import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Download } from '../api/client';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

type DownloadClient = 'qbittorrent' | 'sabnzbd';

const POLL_INTERVAL_MS = 15_000;

export function useDownloads(includeCompleted: boolean = true) {
  return useQuery({
    queryKey: queryKeys.downloads.list(includeCompleted),
    queryFn: async () => unwrap(await api.getDownloads(includeCompleted)),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

export function usePauseDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; client: DownloadClient }) =>
      unwrap(await api.pauseDownload(vars.id, vars.client)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.downloads.all });
    },
  });
}

export function useResumeDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; client: DownloadClient }) =>
      unwrap(await api.resumeDownload(vars.id, vars.client)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.downloads.all });
    },
  });
}

export function usePauseAllDownloads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.pauseAllDownloads()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.downloads.all });
    },
  });
}

export function useResumeAllDownloads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.resumeAllDownloads()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.downloads.all });
    },
  });
}

export function useCancelDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      deleteFiles?: boolean;
      client?: DownloadClient;
    }) =>
      unwrap(
        await api.cancelDownload(
          vars.id,
          vars.deleteFiles ?? false,
          vars.client
        )
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.downloads.all });
    },
  });
}

export type { Download };
