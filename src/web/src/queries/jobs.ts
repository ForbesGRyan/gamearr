import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useScheduledJobs(opts?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: async () => unwrap(await api.getScheduledJobs()),
    refetchInterval: opts?.refetchInterval ?? 5_000,
    staleTime: 2_000,
  });
}

export function useRunScheduledJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => unwrap(await api.runScheduledJob(name)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}
