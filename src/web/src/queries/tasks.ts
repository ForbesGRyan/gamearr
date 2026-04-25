import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListTasksParams } from '../api/client';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useTasks(params: ListTasksParams = {}, opts?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: async () => unwrap(await api.getTasks(params)),
    refetchInterval: opts?.refetchInterval ?? 5_000,
    staleTime: 2_000,
  });
}

export function useRetryTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.retryTask(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.deleteTask(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}
