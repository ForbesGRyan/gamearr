/**
 * Authentication routes
 * Handles login, logout, registration, and user management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode } from '../utils/errors';
import { authService } from '../services/AuthService';
import { adminMiddleware } from '../middleware/auth';

const auth = new Hono();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'user']).optional().default('user'),
});

/**
 * GET /api/v1/auth/status
 * Check authentication status (always accessible, no auth required)
 */
auth.get('/status', async (c) => {
  logger.info('GET /api/v1/auth/status');

  try {
    const authEnabled = await authService.isAuthEnabled();
    const hasUsers = await authService.hasAnyUsers();

    return c.json({
      success: true,
      data: {
        authEnabled,
        hasUsers,
      },
    });
  } catch (error) {
    logger.error('Failed to get auth status:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/login
 * Login with username and password
 */
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  logger.info('POST /api/v1/auth/login');

  try {
    const { username, password, rememberMe } = c.req.valid('json');

    const result = await authService.login(username, password, rememberMe);

    if (!result) {
      return c.json({
        success: false,
        error: 'Invalid username or password',
      }, 401);
    }

    return c.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Login failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout current session (requires auth)
 */
auth.post('/logout', async (c) => {
  logger.info('POST /api/v1/auth/logout');

  try {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await authService.logout(token);
    }

    return c.json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    logger.error('Logout failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/register
 * Register first admin user (only when no users exist)
 */
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  logger.info('POST /api/v1/auth/register');

  try {
    // Check if any users exist
    const hasUsers = await authService.hasAnyUsers();
    if (hasUsers) {
      return c.json({
        success: false,
        error: 'Registration disabled. An admin user already exists.',
      }, 403);
    }

    const { username, password } = c.req.valid('json');

    // Create first user as admin
    const user = await authService.createUser(username, password, 'admin');

    // Enable authentication
    await authService.enableAuth();

    // Auto-login the new user
    const loginResult = await authService.login(username, password);

    if (!loginResult) {
      return c.json({
        success: true,
        data: {
          user,
          message: 'Account created. Please login.',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        user: loginResult.user,
        token: loginResult.token,
        expiresAt: loginResult.expiresAt.toISOString(),
        message: 'Admin account created and logged in',
      },
    });
  } catch (error) {
    logger.error('Registration failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info (requires auth)
 */
auth.get('/me', async (c) => {
  logger.info('GET /api/v1/auth/me');

  try {
    const user = c.get('user');

    if (!user) {
      return c.json({
        success: false,
        error: 'Not authenticated',
      }, 401);
    }

    // Check if user has an API key
    const hasApiKey = await authService.userHasApiKey(user.id);

    return c.json({
      success: true,
      data: {
        ...user,
        hasApiKey,
      },
    });
  } catch (error) {
    logger.error('Failed to get current user:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/change-password
 * Change current user's password (requires auth)
 */
auth.post('/change-password', zValidator('json', changePasswordSchema), async (c) => {
  logger.info('POST /api/v1/auth/change-password');

  try {
    const user = c.get('user');

    if (!user) {
      return c.json({
        success: false,
        error: 'Not authenticated',
      }, 401);
    }

    const { currentPassword, newPassword } = c.req.valid('json');

    const success = await authService.changePassword(user.id, currentPassword, newPassword);

    if (!success) {
      return c.json({
        success: false,
        error: 'Invalid current password',
      }, 400);
    }

    return c.json({
      success: true,
      data: {
        message: 'Password changed successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to change password:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/api-key
 * Generate a new personal API key (requires auth)
 */
auth.post('/api-key', async (c) => {
  logger.info('POST /api/v1/auth/api-key');

  try {
    const user = c.get('user');

    if (!user) {
      return c.json({
        success: false,
        error: 'Not authenticated',
      }, 401);
    }

    const apiKey = await authService.generateUserApiKey(user.id);

    return c.json({
      success: true,
      data: {
        apiKey,
        message: 'API key generated. Save this key - it will not be shown again!',
      },
    });
  } catch (error) {
    logger.error('Failed to generate API key:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * DELETE /api/v1/auth/api-key
 * Revoke personal API key (requires auth)
 */
auth.delete('/api-key', async (c) => {
  logger.info('DELETE /api/v1/auth/api-key');

  try {
    const user = c.get('user');

    if (!user) {
      return c.json({
        success: false,
        error: 'Not authenticated',
      }, 401);
    }

    await authService.revokeUserApiKey(user.id);

    return c.json({
      success: true,
      data: {
        message: 'API key revoked',
      },
    });
  } catch (error) {
    logger.error('Failed to revoke API key:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * GET /api/v1/auth/users
 * List all users (admin only)
 */
auth.get('/users', adminMiddleware, async (c) => {
  logger.info('GET /api/v1/auth/users');

  try {
    const users = await authService.getAllUsers();

    return c.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error('Failed to get users:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/users
 * Create a new user (admin only)
 */
auth.post('/users', adminMiddleware, zValidator('json', createUserSchema), async (c) => {
  logger.info('POST /api/v1/auth/users');

  try {
    const { username, password, role } = c.req.valid('json');

    const user = await authService.createUser(username, password, role);

    return c.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Failed to create user:', error);

    if (error instanceof Error && error.message === 'Username already exists') {
      return c.json({
        success: false,
        error: 'Username already exists',
      }, 409);
    }

    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * DELETE /api/v1/auth/users/:id
 * Delete a user (admin only)
 */
auth.delete('/users/:id', adminMiddleware, async (c) => {
  const userId = parseInt(c.req.param('id'));
  logger.info(`DELETE /api/v1/auth/users/${userId}`);

  try {
    if (isNaN(userId)) {
      return c.json({
        success: false,
        error: 'Invalid user ID',
      }, 400);
    }

    // Prevent deleting yourself
    const currentUser = c.get('user');
    if (currentUser.id === userId) {
      return c.json({
        success: false,
        error: 'Cannot delete your own account',
      }, 400);
    }

    // Check if user exists
    const targetUser = await authService.getUserById(userId);
    if (!targetUser) {
      return c.json({
        success: false,
        error: 'User not found',
      }, 404);
    }

    await authService.deleteUser(userId);

    return c.json({
      success: true,
      data: {
        message: 'User deleted',
      },
    });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/enable
 * Enable authentication (legacy endpoint, now just enables auth)
 */
auth.post('/enable', async (c) => {
  logger.info('POST /api/v1/auth/enable');

  try {
    await authService.enableAuth();

    return c.json({
      success: true,
      data: {
        authEnabled: true,
        message: 'Authentication enabled',
      },
    });
  } catch (error) {
    logger.error('Failed to enable auth:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/disable
 * Disable authentication (admin only)
 */
auth.post('/disable', adminMiddleware, async (c) => {
  logger.info('POST /api/v1/auth/disable');

  try {
    await authService.disableAuth();

    return c.json({
      success: true,
      data: {
        authEnabled: false,
        message: 'Authentication disabled. API is now accessible without authentication.',
      },
    });
  } catch (error) {
    logger.error('Failed to disable auth:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default auth;
