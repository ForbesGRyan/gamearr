import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from './keys';
import { unwrap } from './unwrap';

export function useAuthStatus() {
  return useQuery({
    queryKey: queryKeys.auth.status(),
    queryFn: async () => unwrap(await api.getAuthStatus()),
    staleTime: 5 * 60_000,
  });
}

export function useCurrentUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => unwrap(await api.getCurrentUser()),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
    retry: false,
  });
}
