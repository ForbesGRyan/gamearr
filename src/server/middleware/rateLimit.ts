/**
 * Simple in-memory rate limiter middleware
 * Limits requests per IP address to prevent abuse
 */

import { Context, Next } from 'hono';
import { logger } from '../utils/logger';
import { settingsService } from '../services/SettingsService';

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

// Cache for trusted proxies setting (refreshed periodically)
let trustedProxiesCache: string[] = [];
let trustedProxiesCacheTime = 0;
const TRUSTED_PROXIES_CACHE_TTL = 60 * 1000; // 1 minute

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
 * Check if an IP matches a trusted proxy
 * Supports exact IPs and CIDR notation (e.g., "10.0.0.0/8", "192.168.1.0/24")
 */
function ipMatchesTrustedProxy(ip: string, trustedProxies: string[]): boolean {
  if (trustedProxies.length === 0) return false;

  for (const trusted of trustedProxies) {
    // Exact match
    if (ip === trusted) return true;

    // CIDR notation check
    if (trusted.includes('/')) {
      if (ipMatchesCIDR(ip, trusted)) return true;
    }
  }
  return false;
}

/**
 * Check if an IP falls within a CIDR range
 * Simple implementation for IPv4
 */
function ipMatchesCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);
    if (isNaN(mask) || mask < 0 || mask > 32) return false;

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);
    if (ipNum === null || rangeNum === null) return false;

    const maskNum = ~(Math.pow(2, 32 - mask) - 1) >>> 0;
    return (ipNum & maskNum) === (rangeNum & maskNum);
  } catch {
    return false;
  }
}

/**
 * Convert IPv4 string to number
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let num = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) + octet;
  }
  return num >>> 0; // Convert to unsigned
}

/**
 * Get trusted proxies from settings (cached)
 */
async function getTrustedProxies(): Promise<string[]> {
  const now = Date.now();
  if (now - trustedProxiesCacheTime < TRUSTED_PROXIES_CACHE_TTL) {
    return trustedProxiesCache;
  }

  try {
    const setting = await settingsService.getSetting('trusted_proxies');
    if (setting) {
      // Parse comma-separated list of IPs/CIDRs
      trustedProxiesCache = setting
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } else {
      trustedProxiesCache = [];
    }
  } catch {
    // On error, keep existing cache
  }
  trustedProxiesCacheTime = now;
  return trustedProxiesCache;
}

/**
 * Get the actual client IP from the request connection
 * This bypasses any headers and gets the real connecting IP
 */
function getConnectionIp(c: Context): string {
  // Bun provides the remote address through the request info
  // Access via the raw request's connection info
  const req = c.req.raw as Request & {
    ip?: string;
    socket?: { remoteAddress?: string };
  };

  // Try various methods to get the actual connection IP
  if (req.ip) return req.ip;
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;

  // Hono/Bun specific - check for connInfo in context
  const connInfo = c.env?.connInfo as { remote?: { address?: string } } | undefined;
  if (connInfo?.remote?.address) return connInfo.remote.address;

  return 'unknown';
}

/**
 * Get client IP from request
 * Security: Only trusts proxy headers when behind a configured trusted proxy
 */
async function getClientIp(c: Context): Promise<string> {
  const connectionIp = getConnectionIp(c);
  const trustedProxies = await getTrustedProxies();

  // Only trust forwarded headers if the connection comes from a trusted proxy
  if (trustedProxies.length > 0 && ipMatchesTrustedProxy(connectionIp, trustedProxies)) {
    // Check for forwarded IP (when behind proxy/load balancer)
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
      // X-Forwarded-For can contain multiple IPs, take the first (original client)
      const clientIp = forwarded.split(',')[0].trim();
      if (clientIp) return clientIp;
    }

    // Check for real IP header (Nginx)
    const realIp = c.req.header('x-real-ip');
    if (realIp) {
      return realIp;
    }
  } else if (trustedProxies.length === 0) {
    // No trusted proxies configured - log once and use connection IP
    // This is the secure default: don't trust any forwarded headers
  }

  // Use the actual connection IP (secure default)
  return connectionIp;
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

    const ip = await getClientIp(c);
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
