/**
 * Authentication middleware for API routes
 * Supports both session tokens (web UI) and API keys (external clients)
 */

import type { Context, Next } from 'hono';
import { authService } from '../services/AuthService';
import type { PublicUser } from '../repositories/UserRepository';
import { logger } from '../utils/logger';

// Extend Hono context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: PublicUser;
  }
}

/**
 * Extract token from request headers
 * Supports:
 * - Authorization: Bearer <token>
 * - X-Api-Key: <key>
 */
function extractToken(c: Context): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-Api-Key header
  const xApiKey = c.req.header('X-Api-Key');
  if (xApiKey) {
    return xApiKey;
  }

  return null;
}

/**
 * Main authentication middleware
 * Validates session tokens and API keys
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  // Check if auth is enabled
  const authEnabled = await authService.isAuthEnabled();

  if (!authEnabled) {
    // Auth not enabled, allow request without user context
    return next();
  }

  // Extract token from request
  const token = extractToken(c);

  if (!token) {
    logger.warn(`Unauthorized request to ${c.req.path}: Missing authentication`);
    return c.json(
      {
        success: false,
        error: 'Authentication required. Provide session token or API key via Authorization header.',
      },
      401
    );
  }

  // Try session token first (web UI)
  let user = await authService.validateSession(token);

  // Fall back to API key (external clients)
  if (!user) {
    user = await authService.validateApiKey(token);
  }

  if (!user) {
    logger.warn(`Unauthorized request to ${c.req.path}: Invalid or expired token`);
    return c.json(
      {
        success: false,
        error: 'Invalid or expired authentication token',
      },
      401
    );
  }

  // Set user in context for downstream handlers
  c.set('user', user);

  return next();
}

/**
 * Create auth middleware with configurable skip paths
 * Paths in skipPaths will bypass authentication
 */
export function createAuthMiddleware(skipPaths: string[] = []): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const path = c.req.path;

    // Check if this path should skip auth
    for (const skipPath of skipPaths) {
      if (path === skipPath || path.startsWith(skipPath + '/')) {
        return next();
      }
    }

    return authMiddleware(c, next);
  };
}

/**
 * Admin-only middleware
 * Must be used after authMiddleware
 */
export async function adminMiddleware(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user');

  if (!user) {
    return c.json(
      {
        success: false,
        error: 'Authentication required',
      },
      401
    );
  }

  if (user.role !== 'admin') {
    logger.warn(`Forbidden: User ${user.username} attempted admin action on ${c.req.path}`);
    return c.json(
      {
        success: false,
        error: 'Admin access required',
      },
      403
    );
  }

  return next();
}

// Re-export auth functions from AuthService for backward compatibility
export { authService };
export const isAuthEnabled = () => authService.isAuthEnabled();
export const enableAuth = async () => {
  await authService.enableAuth();
  return null; // No longer returns API key here
};
export const disableAuth = () => authService.disableAuth();
