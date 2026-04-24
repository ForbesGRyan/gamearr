import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function usePendingUpdates() {
  return useQuery({
    queryKey: queryKeys.updates.pending(),
    queryFn: async () => unwrap(await api.getPendingUpdates()),
  });
}

export function useCheckAllUpdates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.checkAllUpdates()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.updates.pending() });
      qc.invalidateQueries({ queryKey: queryKeys.games.all });
    },
  });
}
