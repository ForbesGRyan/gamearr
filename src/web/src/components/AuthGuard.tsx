import { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getAuthToken, clearAuthToken, onAuthEvent, type AuthUser } from '../api/client';

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

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);

  const checkAuth = async () => {
    try {
      // First check if auth is enabled
      const statusResult = await api.getAuthStatus();

      if (!statusResult.success || !statusResult.data) {
        // Can't check status, assume auth is disabled
        setState('authenticated');
        return;
      }

      const { authEnabled, hasUsers } = statusResult.data;

      // If auth is not enabled, allow access
      if (!authEnabled) {
        setState('authenticated');
        return;
      }

      // If no users exist, redirect to register
      if (!hasUsers) {
        navigate('/register');
        return;
      }

      // Auth is enabled, check for valid token
      const token = getAuthToken();
      if (!token) {
        navigate('/login');
        return;
      }

      // Validate token by calling /auth/me
      const meResult = await api.getCurrentUser();

      if (meResult.success && meResult.data) {
        setUser(meResult.data);
        setState('authenticated');
      } else {
        // Token is invalid
        clearAuthToken();
        navigate('/login');
      }
    } catch {
      // On error, assume not authenticated
      clearAuthToken();
      navigate('/login');
    }
  };

  const refreshUser = async () => {
    const result = await api.getCurrentUser();
    if (result.success && result.data) {
      setUser(result.data);
    }
  };

  const logout = async () => {
    await api.logout();
    clearAuthToken();
    setUser(null);
    navigate('/login');
  };

  useEffect(() => {
    checkAuth();

    // Listen for auth events (unauthorized responses)
    const unsubscribe = onAuthEvent((event) => {
      if (event === 'unauthorized') {
        setUser(null);
        setState('unauthenticated');
        navigate('/login');
      }
    });

    return unsubscribe;
  }, [navigate]);

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
        isLoading: state === 'checking',
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthGuard;
