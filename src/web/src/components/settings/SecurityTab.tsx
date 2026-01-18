import { useState, useEffect } from 'react';
import { api, type AuthUser, type AuthStatus, setAuthToken } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../AuthGuard';

function SecurityTab() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  // Auth status state
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Enable auth state (for when auth is disabled)
  const [enableUsername, setEnableUsername] = useState('');
  const [enablePassword, setEnablePassword] = useState('');
  const [enableConfirmPassword, setEnableConfirmPassword] = useState('');
  const [isEnabling, setIsEnabling] = useState(false);

  // Disable auth state
  const [isDisabling, setIsDisabling] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isRevokingKey, setIsRevokingKey] = useState(false);

  // User management state (admin only)
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user' | 'viewer'>('user');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Password reset state (for when auth is disabled)
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Load auth status on mount
  useEffect(() => {
    loadAuthStatus();
  }, []);

  // Load user data
  useEffect(() => {
    if (user?.hasApiKey !== undefined) {
      setHasApiKey(user.hasApiKey);
    }
  }, [user]);

  // Load users list for admin OR when auth is disabled but users exist
  useEffect(() => {
    if ((isAdmin && authStatus?.authEnabled) || (!authStatus?.authEnabled && authStatus?.hasUsers)) {
      loadUsers();
    }
  }, [isAdmin, authStatus?.authEnabled, authStatus?.hasUsers]);

  const loadAuthStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const result = await api.getAuthStatus();
      if (result.success && result.data) {
        setAuthStatus(result.data);
      }
    } catch {
      showToast('Failed to load auth status', 'error');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await api.getUsers();
      if (result.success && result.data) {
        setUsers(result.data);
      }
    } catch {
      showToast('Failed to load users', 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Enable authentication handler (with new admin user)
  const handleEnableAuthWithUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!enableUsername || !enablePassword) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (enableUsername.length < 3) {
      showToast('Username must be at least 3 characters', 'error');
      return;
    }

    if (enablePassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    if (enablePassword !== enableConfirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setIsEnabling(true);
    try {
      const result = await api.register(enableUsername, enablePassword);
      if (result.success && result.data) {
        // Save the token
        setAuthToken(result.data.token);
        showToast('Authentication enabled! You are now logged in.', 'success');
        // Reload auth status and refresh user
        await loadAuthStatus();
        await refreshUser();
        // Clear form
        setEnableUsername('');
        setEnablePassword('');
        setEnableConfirmPassword('');
      } else {
        showToast(result.error || 'Failed to enable authentication', 'error');
      }
    } catch {
      showToast('Failed to enable authentication', 'error');
    } finally {
      setIsEnabling(false);
    }
  };

  // Enable authentication handler (when users already exist)
  const handleEnableAuthOnly = async () => {
    if (!confirm('Enable authentication? You will need to log in with your existing account to access Gamearr.')) {
      return;
    }

    setIsEnabling(true);
    try {
      const result = await api.enableAuth();
      if (result.success) {
        showToast('Authentication enabled. Please log in.', 'success');
        // Redirect to login page
        window.location.href = '/login';
      } else {
        showToast(result.error || 'Failed to enable authentication', 'error');
      }
    } catch {
      showToast('Failed to enable authentication', 'error');
    } finally {
      setIsEnabling(false);
    }
  };

  // Disable authentication handler
  const handleDisableAuth = async () => {
    if (!confirm('Are you sure you want to disable authentication? Anyone will be able to access Gamearr without logging in.')) {
      return;
    }

    setIsDisabling(true);
    try {
      const result = await api.disableAuth();
      if (result.success) {
        showToast('Authentication disabled', 'success');
        await loadAuthStatus();
      } else {
        showToast(result.error || 'Failed to disable authentication', 'error');
      }
    } catch {
      showToast('Failed to disable authentication', 'error');
    } finally {
      setIsDisabling(false);
    }
  };

  // Reset user password handler (for when auth is disabled)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetUserId) {
      return;
    }

    if (!resetPassword) {
      showToast('Please enter a new password', 'error');
      return;
    }

    if (resetPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setIsResettingPassword(true);
    try {
      const result = await api.resetUserPassword(resetUserId, resetPassword);
      if (result.success) {
        showToast('Password reset successfully', 'success');
        setResetUserId(null);
        setResetPassword('');
        setResetConfirmPassword('');
      } else {
        showToast(result.error || 'Failed to reset password', 'error');
      }
    } catch {
      showToast('Failed to reset password', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Password change handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await api.changePassword(currentPassword, newPassword);
      if (result.success) {
        showToast('Password changed successfully', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(result.error || 'Failed to change password', 'error');
      }
    } catch {
      showToast('Failed to change password', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // API key handlers
  const handleGenerateApiKey = async () => {
    setIsGeneratingKey(true);
    try {
      const result = await api.generateApiKey();
      if (result.success && result.data) {
        setApiKey(result.data.apiKey);
        setHasApiKey(true);
        await refreshUser();
        showToast('API key generated. Copy it now - it will not be shown again!', 'success');
      } else {
        showToast(result.error || 'Failed to generate API key', 'error');
      }
    } catch {
      showToast('Failed to generate API key', 'error');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!confirm('Are you sure you want to revoke your API key? Any applications using it will stop working.')) {
      return;
    }

    setIsRevokingKey(true);
    try {
      const result = await api.revokeApiKey();
      if (result.success) {
        setApiKey(null);
        setHasApiKey(false);
        await refreshUser();
        showToast('API key revoked', 'success');
      } else {
        showToast(result.error || 'Failed to revoke API key', 'error');
      }
    } catch {
      showToast('Failed to revoke API key', 'error');
    } finally {
      setIsRevokingKey(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      showToast('API key copied to clipboard', 'success');
    }
  };

  // User management handlers
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUsername || !newUserPassword) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (newUsername.length < 3) {
      showToast('Username must be at least 3 characters', 'error');
      return;
    }

    if (newUserPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    setIsAddingUser(true);
    try {
      const result = await api.createUser(newUsername, newUserPassword, newUserRole);
      if (result.success) {
        showToast('User created successfully', 'success');
        setNewUsername('');
        setNewUserPassword('');
        setNewUserRole('user');
        setShowAddUser(false);
        loadUsers();
      } else {
        showToast(result.error || 'Failed to create user', 'error');
      }
    } catch {
      showToast('Failed to create user', 'error');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
      return;
    }

    try {
      const result = await api.deleteUser(userId);
      if (result.success) {
        showToast('User deleted', 'success');
        loadUsers();
      } else {
        showToast(result.error || 'Failed to delete user', 'error');
      }
    } catch {
      showToast('Failed to delete user', 'error');
    }
  };

  // Loading state
  if (isLoadingStatus) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Auth is disabled - show enable form
  if (!authStatus?.authEnabled) {
    return (
      <div className="space-y-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Authentication</h3>
          <p className="text-sm text-gray-400 mb-6">
            Authentication is currently <span className="text-yellow-400 font-medium">disabled</span>.
            Anyone can access Gamearr without logging in.
          </p>

          {authStatus?.hasUsers ? (
            // Users exist - show enable button and users list
            <div className="space-y-6">
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
                <h4 className="font-medium text-blue-200 mb-2">Enable Authentication</h4>
                <p className="text-sm text-blue-300 mb-4">
                  User accounts already exist. Make sure you know your password before enabling authentication.
                  You will be redirected to the login page.
                </p>
                <button
                  onClick={handleEnableAuthOnly}
                  disabled={isEnabling}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition"
                >
                  {isEnabling ? 'Enabling...' : 'Enable Authentication'}
                </button>
              </div>

              {/* Existing Users List */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">User Accounts</h4>
                  <button
                    onClick={() => {
                      setShowAddUser(!showAddUser);
                      setResetUserId(null);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add User
                  </button>
                </div>

                {/* Add User Form */}
                {showAddUser && (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newUsername || !newUserPassword) {
                      showToast('Please fill in all fields', 'error');
                      return;
                    }
                    if (newUsername.length < 3) {
                      showToast('Username must be at least 3 characters', 'error');
                      return;
                    }
                    if (newUserPassword.length < 8) {
                      showToast('Password must be at least 8 characters', 'error');
                      return;
                    }
                    setIsAddingUser(true);
                    try {
                      const result = await api.createUser(newUsername, newUserPassword, newUserRole);
                      if (result.success) {
                        showToast('User created successfully', 'success');
                        setNewUsername('');
                        setNewUserPassword('');
                        setNewUserRole('user');
                        setShowAddUser(false);
                        loadUsers();
                      } else {
                        showToast(result.error || 'Failed to create user', 'error');
                      }
                    } catch {
                      showToast('Failed to create user', 'error');
                    } finally {
                      setIsAddingUser(false);
                    }
                  }} className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
                    <h5 className="font-medium mb-3">Create New User</h5>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Username</label>
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            placeholder="Min. 3 characters"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Password</label>
                          <input
                            type="password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            placeholder="Min. 8 characters"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Role</label>
                          <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user' | 'viewer')}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer (Read-only)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isAddingUser}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg transition text-sm"
                        >
                          {isAddingUser ? 'Creating...' : 'Create User'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddUser(false);
                            setNewUsername('');
                            setNewUserPassword('');
                            setNewUserRole('user');
                          }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {isLoadingUsers ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{u.username}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            u.role === 'admin' ? 'bg-purple-600' : u.role === 'viewer' ? 'bg-yellow-600' : 'bg-blue-600'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setResetUserId(u.id);
                            setResetPassword('');
                            setResetConfirmPassword('');
                            setShowAddUser(false);
                          }}
                          className="text-sm text-blue-400 hover:text-blue-300 transition"
                        >
                          Reset Password
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Password Reset Form */}
                {resetUserId && !showAddUser && (
                  <form onSubmit={handleResetPassword} className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
                    <h5 className="font-medium mb-3">
                      Reset Password for {users.find(u => u.id === resetUserId)?.username}
                    </h5>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">New Password</label>
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                        <input
                          type="password"
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isResettingPassword}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition text-sm"
                        >
                          {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetUserId(null);
                            setResetPassword('');
                            setResetConfirmPassword('');
                          }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            // No users - show user creation form
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
              <h4 className="font-medium text-blue-200 mb-2">Enable Authentication</h4>
              <p className="text-sm text-blue-300 mb-4">
                Create an admin account to enable authentication. You'll need to log in to access Gamearr after enabling this.
              </p>

              <form onSubmit={handleEnableAuthWithUser} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Admin Username</label>
                  <input
                    type="text"
                    value={enableUsername}
                    onChange={(e) => setEnableUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Min. 3 characters"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Password</label>
                  <input
                    type="password"
                    value={enablePassword}
                    onChange={(e) => setEnablePassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={enableConfirmPassword}
                    onChange={(e) => setEnableConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isEnabling}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition"
                >
                  {isEnabling ? 'Enabling...' : 'Enable Authentication'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Auth is enabled - show full security settings
  return (
    <div className="space-y-8">
      {/* Authentication Status Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Authentication</h3>
        <p className="text-sm text-gray-400 mb-4">
          Authentication is currently <span className="text-green-400 font-medium">enabled</span>.
          Users must log in to access Gamearr.
        </p>

        {isAdmin && (
          <button
            onClick={handleDisableAuth}
            disabled={isDisabling}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed rounded-lg transition"
          >
            {isDisabling ? 'Disabling...' : 'Disable Authentication'}
          </button>
        )}
      </div>

      {/* Change Password Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={isChangingPassword}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition"
          >
            {isChangingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* API Key Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">API Key</h3>
        <p className="text-sm text-gray-400 mb-4">
          Use an API key to authenticate external applications, scripts, or integrations with Gamearr.
        </p>

        {apiKey && (
          <div className="mb-4 p-4 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg">
            <p className="text-sm text-yellow-200 mb-2 font-medium">
              Copy your API key now - it will not be shown again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-900 rounded text-sm font-mono text-green-400 break-all">
                {apiKey}
              </code>
              <button
                onClick={copyApiKey}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
                title="Copy to clipboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          {hasApiKey ? (
            <>
              <span className="text-sm text-gray-400">You have an active API key</span>
              <button
                onClick={handleGenerateApiKey}
                disabled={isGeneratingKey}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition"
              >
                {isGeneratingKey ? 'Generating...' : 'Regenerate Key'}
              </button>
              <button
                onClick={handleRevokeApiKey}
                disabled={isRevokingKey}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed rounded-lg transition"
              >
                {isRevokingKey ? 'Revoking...' : 'Revoke Key'}
              </button>
            </>
          ) : (
            <button
              onClick={handleGenerateApiKey}
              disabled={isGeneratingKey}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition"
            >
              {isGeneratingKey ? 'Generating...' : 'Generate API Key'}
            </button>
          )}
        </div>
      </div>

      {/* Role Descriptions */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Role Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-1 rounded bg-purple-600">admin</span>
                <span className="font-medium">Administrator</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Full access to all features</li>
                <li>• Manage users and roles</li>
                <li>• Change all settings</li>
                <li>• Enable/disable authentication</li>
              </ul>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-1 rounded bg-blue-600">user</span>
                <span className="font-medium">User</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Full access to library</li>
                <li>• Add and remove games</li>
                <li>• Search and download</li>
                <li>• Cannot manage users</li>
              </ul>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-1 rounded bg-yellow-600">viewer</span>
                <span className="font-medium">Viewer</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Read-only access</li>
                <li>• View library and games</li>
                <li>• View activity and status</li>
                <li>• Cannot make any changes</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* User Management Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">User Management</h3>
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </button>
          </div>

          {/* Add User Form */}
          {showAddUser && (
            <form onSubmit={handleAddUser} className="mb-6 p-4 bg-gray-700 rounded-lg space-y-4">
              <h4 className="font-medium">Create New User</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Min. 3 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Password</label>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user' | 'viewer')}
                    className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer (Read-only)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg transition"
                >
                  {isAddingUser ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          {isLoadingUsers ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                    <th className="pb-3 font-medium">Username</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium">Last Login</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-700">
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          {u.username}
                          {u.id === user?.id && (
                            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">You</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          u.role === 'admin' ? 'bg-purple-600' : u.role === 'viewer' ? 'bg-yellow-600' : 'bg-blue-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400 text-sm">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-gray-400 text-sm">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="py-3 text-right">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="text-red-400 hover:text-red-300 transition"
                            title="Delete user"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SecurityTab;
