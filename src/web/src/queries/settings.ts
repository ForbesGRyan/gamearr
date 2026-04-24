import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.list(),
    queryFn: async () => unwrap(await api.getSettings()),
  });
}

export function useSetting<T = string>(
  key: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.settings.byKey(key),
    queryFn: async (): Promise<T | null> => {
      const res = await api.getSetting<T>(key);
      // Treat a not-yet-configured / server-rejected setting as "no value"
      // rather than a hard error. This matches the pre-migration behavior
      // where Settings.tsx silently ignored per-key failures and fell back
      // to defaults, and prevents one bad/renamed key from blocking the
      // whole Settings page.
      if (!res.success) {
        return null;
      }
      return (res.data ?? null) as T | null;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      key: string;
      value: string | boolean | number;
    }) => unwrap(await api.updateSetting(vars.key, vars.value)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.byKey(vars.key) });
      qc.invalidateQueries({ queryKey: queryKeys.settings.list() });
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Parameters<typeof api.updateSettings>[0]) =>
      unwrap(await api.updateSettings(settings)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}

// Prowlarr categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.settings.categories(),
    queryFn: async () => unwrap(await api.getCategories()),
    staleTime: 5 * 60_000,
  });
}

export function useSelectedCategories() {
  return useQuery({
    queryKey: queryKeys.settings.categoriesSelected(),
    queryFn: async () => unwrap(await api.getSelectedCategories()),
  });
}

export function useUpdateCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categories: number[]) =>
      unwrap(await api.updateCategories(categories)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.categoriesSelected() });
    },
  });
}

// qBittorrent categories
export function useQBittorrentCategories() {
  return useQuery({
    queryKey: queryKeys.settings.qbittorrentCategories(),
    queryFn: async () => unwrap(await api.getQBittorrentCategories()),
    staleTime: 5 * 60_000,
  });
}

export function useQBittorrentCategory() {
  return useQuery({
    queryKey: queryKeys.settings.qbittorrentCategory(),
    queryFn: async () => unwrap(await api.getQBittorrentCategory()),
  });
}

export function useUpdateQBittorrentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (category: string) =>
      unwrap(await api.updateQBittorrentCategory(category)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.qbittorrentCategory() });
    },
  });
}

// Connection tests — one-shot mutations (no cache, no invalidation).
// Pass config object to validate un-saved form values, or omit to test saved settings.

export function useTestProwlarrConnection() {
  return useMutation({
    mutationFn: async (config?: { url: string; apiKey: string }) =>
      unwrap(await api.testProwlarrConnection(config)),
  });
}

export function useTestQbittorrentConnection() {
  return useMutation({
    mutationFn: async (
      config?: { host: string; username?: string; password?: string }
    ) => unwrap(await api.testQbittorrentConnection(config)),
  });
}

export function useTestSabnzbdConnection() {
  return useMutation({
    mutationFn: async (config?: { host: string; apiKey: string }) =>
      unwrap(await api.testSabnzbdConnection(config)),
  });
}

export function useTestSteamConnection() {
  return useMutation({
    mutationFn: async () => unwrap(await api.testSteamConnection()),
  });
}

export function useTestDiscordConnection() {
  return useMutation({
    mutationFn: async (config?: { webhookUrl: string }) =>
      unwrap(await api.testDiscordConnection(config)),
  });
}

export function useTestGogConnection() {
  return useMutation({
    mutationFn: async () => unwrap(await api.testGogConnection()),
  });
}

export function useGogAuthUrl() {
  return useMutation({
    mutationFn: async () => unwrap(await api.getGogAuthUrl()),
  });
}

export function useExchangeGogCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => unwrap(await api.exchangeGogCode(code)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.byKey('gog_refresh_token') });
    },
  });
}

// Library path test — one-shot mutation for LibrariesTab form validation.
export function useTestLibraryPath() {
  return useMutation({
    mutationFn: async (path: string) => unwrap(await api.testLibraryPath(path)),
  });
}
