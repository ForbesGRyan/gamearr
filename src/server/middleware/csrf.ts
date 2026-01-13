/**
 * CSRF Protection Middleware
 *
 * Validates Origin header for state-changing requests (POST, PUT, DELETE, PATCH)
 * to prevent Cross-Site Request Forgery attacks.
 *
 * This works alongside CORS but provides defense-in-depth:
 * - CORS prevents reading responses from unauthorized origins
 * - This middleware prevents state changes from unauthorized origins
 */

import { Context, Next } from 'hono';
import { logger } from '../utils/logger';

// Methods that change state and need CSRF protection
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// Paths that should be exempt from CSRF checks (e.g., initial setup before config exists)
const EXEMPT_PATHS = new Set([
  '/api/v1/auth/status',
  '/api/v1/system/setup-status',
  '/api/v1/system/skip-setup',
]);

/**
 * Get allowed development origins
 */
function getDevOrigins(): Set<string> {
  const origins = new Set<string>();

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
}

/**
 * Extract origin from the Host header for same-origin requests
 */
function getSameOrigin(c: Context): string | null {
  const host = c.req.header('host');
  if (!host) return null;

  // Determine protocol (assume https in production, http otherwise)
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${protocol}://${host}`;
}

/**
 * CSRF protection middleware
 *
 * For state-changing requests, validates that the request comes from:
 * 1. Same origin (matches Host header)
 * 2. Development origins (localhost in dev mode)
 * 3. API clients with auth headers (X-API-Key, Authorization)
 */
export function csrfProtection() {
  const devOrigins = getDevOrigins();

  return async (c: Context, next: Next) => {
    const method = c.req.method;
    const path = c.req.path;

    // Skip non-state-changing methods (GET, HEAD, OPTIONS)
    if (!STATE_CHANGING_METHODS.has(method)) {
      return next();
    }

    // Skip exempt paths
    if (EXEMPT_PATHS.has(path)) {
      return next();
    }

    // Allow requests with API authentication headers
    // These can't be sent by simple cross-origin requests without CORS preflight
    const apiKey = c.req.header('x-api-key');
    const authHeader = c.req.header('authorization');
    if (apiKey || authHeader) {
      return next();
    }

    // Get the Origin header
    const origin = c.req.header('origin');
    const sameOrigin = getSameOrigin(c);

    // No Origin header - check Referer as fallback
    if (!origin) {
      const referer = c.req.header('referer');
      if (referer) {
        try {
          const refererOrigin = new URL(referer).origin;
          if (refererOrigin === sameOrigin || devOrigins.has(refererOrigin)) {
            return next();
          }
        } catch {
          // Invalid referer URL
        }
      }

      // No origin/referer - block the request
      logger.warn(`CSRF: Blocked request without origin to ${method} ${path}`);
      return c.json(
        {
          success: false,
          error: 'Request blocked: missing origin header',
          code: 'CSRF_ERROR',
        },
        403
      );
    }

    // Check if origin is same-origin or dev origin
    if (origin === sameOrigin || devOrigins.has(origin)) {
      return next();
    }

    logger.warn(`CSRF: Blocked request from origin: ${origin} to ${method} ${path}`);
    return c.json(
      {
        success: false,
        error: 'Request blocked: unauthorized origin',
        code: 'CSRF_ERROR',
      },
      403
    );
  };
}
