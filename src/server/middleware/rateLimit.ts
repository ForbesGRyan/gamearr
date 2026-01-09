/**
 * Simple in-memory rate limiter middleware
 * Limits requests per IP address to prevent abuse
 */

import { Context, Next } from 'hono';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  skipPaths?: string[];  // Paths to skip rate limiting
}

// In-memory store for rate limiting
// In production with multiple instances, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: Timer | null = null;

function startCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Get client IP from request
 * Handles proxied requests (X-Forwarded-For header)
 */
function getClientIp(c: Context): string {
  // Check for forwarded IP (when behind proxy/load balancer)
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  // Check for real IP header (Nginx)
  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fall back to connection info (may not always be available)
  // For Bun/Hono, we use a generic fallback
  return 'unknown';
}

/**
 * Create a rate limit middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipPaths = [],
  } = config;

  // Start cleanup timer
  startCleanup();

  return async (c: Context, next: Next) => {
    // Check if path should be skipped
    const path = c.req.path;
    if (skipPaths.some((skip) => path.startsWith(skip))) {
      return next();
    }

    const ip = getClientIp(c);
    const key = `${ip}:${path}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Initialize or reset if window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Calculate remaining
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetSeconds.toString());

    // Check if over limit
    if (entry.count > maxRequests) {
      logger.warn(`Rate limit exceeded for ${ip} on ${path}`);
      c.header('Retry-After', resetSeconds.toString());
      return c.json(
        {
          success: false,
          error: message,
          retryAfter: resetSeconds,
        },
        429
      );
    }

    return next();
  };
}

/**
 * Default rate limiters for different endpoint types
 */

// General API rate limiter: 100 requests per minute
export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests, please try again later',
});

// Sensitive endpoints rate limiter: 60 requests per minute
// For auth, settings, and other sensitive operations
export const sensitiveRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  message: 'Too many requests to sensitive endpoint, please try again later',
});

// Search rate limiter: 30 requests per minute
// For search endpoints that may be resource-intensive
export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  message: 'Too many search requests, please try again later',
});
