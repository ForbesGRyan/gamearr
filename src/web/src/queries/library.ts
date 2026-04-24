import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useLibraryScanCount() {
  return useQuery({
    queryKey: queryKeys.libraries.scanCount(),
    queryFn: async () => unwrap(await api.getLibraryScanCount()),
  });
}

export function useLibraryHealthCount() {
  return useQuery({
    queryKey: queryKeys.libraries.healthCount(),
    queryFn: async () => unwrap(await api.getLibraryHealthCount()),
  });
}

export function useLibraryDuplicates() {
  return useQuery({
    queryKey: queryKeys.libraries.duplicates(),
    queryFn: async () => unwrap(await api.getLibraryDuplicates()),
  });
}

export function useLibraryLooseFiles() {
  return useQuery({
    queryKey: queryKeys.libraries.looseFiles(),
    queryFn: async () => unwrap(await api.getLibraryLooseFiles()),
  });
}

export function useScanLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.scanLibrary()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
    },
  });
}

export function useAutoMatchFolder() {
  return useMutation({
    mutationFn: async (vars: { parsedTitle: string; parsedYear?: number }) =>
      unwrap(await api.autoMatchFolder(vars.parsedTitle, vars.parsedYear)),
  });
}

export function useMatchLibraryFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      folderPath: Parameters<typeof api.matchLibraryFolder>[0];
      folderName: Parameters<typeof api.matchLibraryFolder>[1];
      igdbGame: Parameters<typeof api.matchLibraryFolder>[2];
      store?: Parameters<typeof api.matchLibraryFolder>[3];
      libraryId?: Parameters<typeof api.matchLibraryFolder>[4];
    }) =>
      unwrap(
        await api.matchLibraryFolder(
          vars.folderPath,
          vars.folderName,
          vars.igdbGame,
          vars.store,
          vars.libraryId
        )
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
      qc.invalidateQueries({ queryKey: queryKeys.games.list() });
    },
  });
}

export function useOrganizeLooseFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { filePath: string; folderName: string }) =>
      unwrap(await api.organizeLooseFile(vars.filePath, vars.folderName)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.looseFiles() });
      qc.invalidateQueries({ queryKey: queryKeys.libraries.healthCount() });
    },
  });
}
