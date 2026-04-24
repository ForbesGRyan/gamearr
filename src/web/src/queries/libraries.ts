import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateLibraryRequest,
  Library,
  UpdateLibraryRequest,
} from '../api/client';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useLibraries() {
  return useQuery({
    queryKey: queryKeys.libraries.list(),
    queryFn: async () => unwrap(await api.getLibraries()),
  });
}

export function useLibrary(id: number | undefined) {
  return useQuery({
    queryKey: id !== undefined ? queryKeys.libraries.detail(id) : ['libraries', 'detail', 'disabled'],
    queryFn: async () => unwrap(await api.getLibrary(id!)),
    enabled: id !== undefined,
  });
}

export function useLibraryPlatforms() {
  return useQuery({
    queryKey: queryKeys.libraries.platforms(),
    queryFn: async () => unwrap(await api.getLibraryPlatforms()),
    staleTime: 5 * 60_000,
  });
}

export function useCreateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (library: CreateLibraryRequest) =>
      unwrap(await api.createLibrary(library)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
    },
  });
}

export function useUpdateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: number; updates: UpdateLibraryRequest }) =>
      unwrap(await api.updateLibrary(vars.id, vars.updates)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
      qc.invalidateQueries({ queryKey: queryKeys.libraries.detail(vars.id) });
    },
  });
}

export function useDeleteLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.deleteLibrary(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries.all });
    },
  });
}

export type { Library };
