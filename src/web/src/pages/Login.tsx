import { useEffect, useState } from 'react';
import { useNavigate, Link } from '../router/compat';
import { getAuthToken } from '../api/client';
import { useAuthStatus, useCurrentUser, useLogin } from '../queries/auth';
import { useToast } from '../contexts/ToastContext';
import { GamepadIcon } from '../components/Icons';

function Login() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const authStatus = useAuthStatus();
  const token = getAuthToken();

  // If auth is disabled, go straight to the app. If a valid token exists,
  // /auth/me will succeed and we also redirect.
  const me = useCurrentUser({
    enabled: authStatus.isSuccess && authStatus.data?.authEnabled === true && !!token,
  });

  useEffect(() => {
    if (!authStatus.isSuccess || !authStatus.data) return;

    if (!authStatus.data.authEnabled) {
      navigate('/');
      return;
    }

    if (token && me.isSuccess && me.data) {
      navigate('/');
    }
  }, [authStatus.isSuccess, authStatus.data, token, me.isSuccess, me.data, navigate]);

  const showRegisterLink =
    authStatus.isSuccess && authStatus.data?.hasUsers === false;

  const loginMutation = useLogin();
  const isLoading = loginMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      showToast('Please enter username and password', 'error');
      return;
    }

    try {
      await loginMutation.mutateAsync({ username, password, rememberMe });
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      showToast(message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <GamepadIcon className="w-12 h-12 text-blue-500" />
            <h1 className="text-4xl font-bold text-blue-500">Gamearr</h1>
          </div>
          <p className="text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-8 shadow-lg">
          <div className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-gray-300">
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </div>

          {showRegisterLink && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                No account yet?{' '}
                <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                  Create the first admin account
                </Link>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default Login;
