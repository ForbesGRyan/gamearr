import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken, clearAuthToken, emitAuthEvent } from '../api/client';
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

export function useUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.auth.users(),
    queryFn: async () => unwrap(await api.getUsers()),
    enabled: options?.enabled ?? true,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      username: string;
      password: string;
      rememberMe?: boolean;
    }) => unwrap(await api.login(vars.username, vars.password, vars.rememberMe ?? false)),
    onSuccess: (data) => {
      setAuthToken(data.token);
      emitAuthEvent('login');
      qc.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.logout()),
    onSettled: () => {
      // Always clear token and caches regardless of server response — even a
      // failed logout request should tear down client-side state so the user
      // is no longer trusted locally.
      clearAuthToken();
      qc.clear();
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { username: string; password: string }) =>
      unwrap(await api.register(vars.username, vars.password)),
    onSuccess: (data) => {
      setAuthToken(data.token);
      emitAuthEvent('login');
      qc.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (vars: { currentPassword: string; newPassword: string }) =>
      unwrap(await api.changePassword(vars.currentPassword, vars.newPassword)),
  });
}

export function useGenerateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.generateApiKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.revokeApiKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      username: string;
      password: string;
      role?: 'admin' | 'user' | 'viewer';
    }) => unwrap(await api.createUser(vars.username, vars.password, vars.role ?? 'user')),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.users() });
      qc.invalidateQueries({ queryKey: queryKeys.auth.status() });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.deleteUser(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.users() });
      qc.invalidateQueries({ queryKey: queryKeys.auth.status() });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (vars: { id: number; newPassword: string }) =>
      unwrap(await api.resetUserPassword(vars.id, vars.newPassword)),
  });
}

export function useEnableAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.enableAuth()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.status() });
    },
  });
}

export function useDisableAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.disableAuth()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.status() });
    },
  });
}
