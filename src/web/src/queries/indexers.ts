import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useIndexers() {
  return useQuery({
    queryKey: queryKeys.indexers.list(),
    queryFn: async () => unwrap(await api.getIndexers()),
    staleTime: 60_000,
  });
}
