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
]);

/**
 * Get allowed origins from environment or defaults
 */
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Add configured CORS origins
  if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',')
      .map(o => o.trim())
      .filter(o => o.length > 0)
      .forEach(o => origins.add(o));
  }

  // Add development origins
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
 * For state-changing requests:
 * 1. Requires Origin header to be present
 * 2. Validates Origin against allowed origins or same-origin
 */
export function csrfProtection() {
  const allowedOrigins = getAllowedOrigins();

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

    // Get the Origin header
    const origin = c.req.header('origin');

    // Same-origin requests may not include Origin header
    // But for security, we prefer requests to include it
    if (!origin) {
      // Check for Referer as fallback (less reliable but commonly sent)
      const referer = c.req.header('referer');
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          const refererOrigin = refererUrl.origin;
          const sameOrigin = getSameOrigin(c);

          // Allow if referer matches same origin or allowed origins
          if (refererOrigin === sameOrigin || allowedOrigins.has(refererOrigin)) {
            return next();
          }
        } catch {
          // Invalid referer URL, continue to check
        }
      }

      // For API requests without Origin/Referer, check for custom header
      // This is common for programmatic API access (curl, scripts, etc.)
      const apiKey = c.req.header('x-api-key');
      const authHeader = c.req.header('authorization');

      // If using API authentication headers, allow the request
      // These can't be sent by simple cross-origin requests without CORS preflight
      if (apiKey || authHeader) {
        return next();
      }

      // No origin, no referer, no API auth - suspicious request
      logger.warn(`CSRF: Blocked request without origin/referer to ${method} ${path}`);
      return c.json(
        {
          success: false,
          error: 'Request blocked: missing origin header',
          code: 'CSRF_ERROR',
        },
        403
      );
    }

    // Check if origin is allowed
    const sameOrigin = getSameOrigin(c);
    const isAllowed = origin === sameOrigin || allowedOrigins.has(origin);

    if (!isAllowed) {
      logger.warn(`CSRF: Blocked request from unauthorized origin: ${origin} to ${method} ${path}`);
      return c.json(
        {
          success: false,
          error: 'Request blocked: unauthorized origin',
          code: 'CSRF_ERROR',
        },
        403
      );
    }

    return next();
  };
}
