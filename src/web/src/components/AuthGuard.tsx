import { useEffect, createContext, useContext, useCallback } from 'react';
import { useNavigate } from '../router/compat';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken, onAuthEvent, type AuthUser } from '../api/client';
import { useAuthStatus, useCurrentUser, useLogout } from '../queries/auth';
import { queryKeys } from '../queries/keys';

// Auth context to share user info across components
interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthGuardProps {
  children: React.ReactNode;
}

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const statusQuery = useAuthStatus();
  const token = getAuthToken();
  const authEnabled = statusQuery.data?.authEnabled ?? false;
  const hasUsers = statusQuery.data?.hasUsers ?? false;

  // Only fetch the current user when auth is enabled AND a token is present.
  // Otherwise the endpoint isn't meaningful and would just 401.
  const meQuery = useCurrentUser({
    enabled: statusQuery.isSuccess && authEnabled && !!token,
  });

  // Derive the guard state from query results.
  let state: AuthState;
  if (statusQuery.isLoading) {
    state = 'checking';
  } else if (!statusQuery.isSuccess) {
    // Can't reach the status endpoint — assume auth is disabled and let through.
    // Mirrors original behavior on statusResult failure.
    state = 'authenticated';
  } else if (!authEnabled) {
    state = 'authenticated';
  } else if (!hasUsers) {
    // Auth is on but no accounts exist yet — redirect handled in the effect below.
    state = 'checking';
  } else if (!token) {
    state = 'unauthenticated';
  } else if (meQuery.isLoading) {
    state = 'checking';
  } else if (meQuery.isSuccess && meQuery.data) {
    state = 'authenticated';
  } else {
    // Token is present but /auth/me failed — treat as unauthenticated.
    state = 'unauthenticated';
  }

  const user: AuthUser | null = meQuery.data ?? null;

  // Handle redirects as side effects of state changes.
  useEffect(() => {
    if (statusQuery.isLoading) return;
    if (!statusQuery.isSuccess) return;

    if (!authEnabled) return;

    if (!hasUsers) {
      navigate('/register');
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    if (meQuery.isError) {
      navigate('/login');
    }
  }, [
    statusQuery.isLoading,
    statusQuery.isSuccess,
    authEnabled,
    hasUsers,
    token,
    meQuery.isError,
    navigate,
  ]);

  // Bridge the api client's auth event bus into the Query cache so other
  // parts of the app (Login page, 401 handler) can trigger a re-validation
  // without importing the QueryClient.
  useEffect(() => {
    const unsubscribe = onAuthEvent((event) => {
      if (event === 'unauthorized') {
        queryClient.removeQueries({ queryKey: queryKeys.auth.me() });
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
        navigate('/login');
      } else if (event === 'login') {
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      } else if (event === 'logout') {
        queryClient.removeQueries({ queryKey: queryKeys.auth.me() });
      }
    });
    return unsubscribe;
  }, [queryClient, navigate]);

  const refreshUser = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
  }, [queryClient]);

  const logoutMutation = useLogout();
  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // clearAuthToken + cache clear happens in onSettled regardless.
    }
    navigate('/login');
  }, [logoutMutation, navigate]);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (state === 'unauthenticated') {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: state === 'authenticated',
        isLoading: false,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
