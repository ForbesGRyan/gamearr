import { useEffect, useState } from 'react';
import { useNavigate, Link } from '../router/compat';
import { useAuthStatus, useRegister } from '../queries/auth';
import { useToast } from '../contexts/ToastContext';
import { GamepadIcon } from '../components/Icons';

function Register() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const authStatus = useAuthStatus();
  const isCheckingStatus = authStatus.isLoading;

  useEffect(() => {
    if (!authStatus.isSuccess || !authStatus.data) return;

    // Auth is disabled — registration doesn't apply, send to main app
    if (!authStatus.data.authEnabled) {
      navigate('/');
      return;
    }

    // Users already exist — this page is only for first-time setup
    if (authStatus.data.hasUsers) {
      showToast('An admin account already exists', 'info');
      navigate('/login');
    }
  }, [authStatus.isSuccess, authStatus.data, navigate, showToast]);

  const registerMutation = useRegister();
  const isLoading = registerMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      showToast('Please enter username and password', 'error');
      return;
    }

    if (username.length < 3) {
      showToast('Username must be at least 3 characters', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    try {
      await registerMutation.mutateAsync({ username, password });
      showToast('Account created successfully!', 'success');
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      showToast(message, 'error');
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <GamepadIcon className="w-12 h-12 text-blue-500" />
            <h1 className="text-4xl font-bold text-blue-500">Gamearr</h1>
          </div>
          <p className="text-gray-400">Create your admin account</p>
        </div>

        <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-200">
            This is the first-time setup. The account you create will be the admin account with full access to all features.
          </p>
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
                placeholder="Choose a username (min. 3 characters)"
                autoComplete="username"
                minLength={3}
                maxLength={50}
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
                placeholder="Choose a password (min. 8 characters)"
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
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
                  Creating account...
                </span>
              ) : (
                'Create Admin Account'
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
