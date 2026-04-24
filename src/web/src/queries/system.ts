import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppUpdateSettings } from '../api/client';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useSystemStatus() {
  return useQuery({
    queryKey: queryKeys.system.status(),
    queryFn: async () => unwrap(await api.getSystemStatus()),
    staleTime: 30_000,
  });
}

export function useSetupStatus() {
  return useQuery({
    queryKey: queryKeys.system.setupStatus(),
    queryFn: async () => unwrap(await api.getSetupStatus()),
    staleTime: 5 * 60_000,
  });
}

export function useLogFiles() {
  return useQuery({
    queryKey: queryKeys.system.logs(),
    queryFn: async () => unwrap(await api.getLogFiles()),
  });
}

export function useLogFileContent(
  filename: string | undefined,
  options?: { enabled?: boolean }
) {
  const enabled = filename !== undefined && (options?.enabled ?? true);
  return useQuery({
    queryKey:
      filename !== undefined
        ? queryKeys.system.logContent(filename)
        : ['system', 'logs', 'disabled'],
    queryFn: async () => unwrap(await api.getLogFileContent(filename!)),
    enabled,
    staleTime: 10_000,
  });
}

export function useAppUpdateStatus() {
  return useQuery({
    queryKey: queryKeys.system.appUpdate(),
    queryFn: async () => unwrap(await api.getAppUpdateStatus()),
    staleTime: 5 * 60_000,
  });
}

export function useAppUpdateSettings() {
  return useQuery({
    queryKey: queryKeys.system.appUpdateSettings(),
    queryFn: async () => unwrap(await api.getAppUpdateSettings()),
    staleTime: 5 * 60_000,
  });
}

export function useCheckForAppUpdates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.checkForAppUpdates()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.system.appUpdate() });
    },
  });
}

export function useDismissAppUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.dismissAppUpdate()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.system.appUpdate() });
    },
  });
}

export function useUpdateAppUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<AppUpdateSettings>) =>
      unwrap(await api.updateAppUpdateSettings(settings)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.system.appUpdateSettings() });
    },
  });
}

export function useSkipSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.skipSetup()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.system.setupStatus() });
    },
  });
}
