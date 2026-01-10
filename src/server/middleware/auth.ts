/**
 * Authentication middleware for API routes
 * Provides API key authentication for protecting sensitive endpoints
 */

import type { Context, Next } from 'hono';
import { settingsRepository } from '../repositories/SettingsRepository';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

// Settings keys for authentication
export const AUTH_SETTINGS = {
  AUTH_ENABLED: 'auth_enabled',
  API_KEY: 'api_key',
  API_KEY_HASH: 'api_key_hash',
};

/**
 * Hash an API key using SHA-256
 * We store the hash, not the plaintext key
 */
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Verify an API key against the stored hash
 */
async function verifyApiKey(providedKey: string): Promise<boolean> {
  const storedHash = await settingsRepository.get(AUTH_SETTINGS.API_KEY_HASH);
  if (!storedHash) {
    return false;
  }

  const providedHash = hashApiKey(providedKey);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch (error) {
    // Buffer comparison failed (e.g., invalid hex encoding or length mismatch)
    logger.debug('API key verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Check if authentication is enabled
 */
export async function isAuthEnabled(): Promise<boolean> {
  const enabled = await settingsRepository.get(AUTH_SETTINGS.AUTH_ENABLED);
  return enabled === 'true';
}

/**
 * Generate a new API key and store its hash
 * Returns the plaintext key (only shown once during generation)
 */
export async function generateApiKey(): Promise<string> {
  // Generate a 32-byte random key, encoded as base64url
  const keyBytes = crypto.randomBytes(32);
  const apiKey = keyBytes.toString('base64url');

  // Store the hash of the key
  const keyHash = hashApiKey(apiKey);
  await settingsRepository.set(AUTH_SETTINGS.API_KEY_HASH, keyHash);

  logger.info('New API key generated');

  return apiKey;
}

/**
 * Enable authentication
 * If no API key exists, generates one
 */
export async function enableAuth(): Promise<string | null> {
  const existingHash = await settingsRepository.get(AUTH_SETTINGS.API_KEY_HASH);

  let apiKey: string | null = null;
  if (!existingHash) {
    apiKey = await generateApiKey();
  }

  await settingsRepository.set(AUTH_SETTINGS.AUTH_ENABLED, 'true');
  logger.info('Authentication enabled');

  return apiKey;
}

/**
 * Disable authentication
 */
export async function disableAuth(): Promise<void> {
  await settingsRepository.set(AUTH_SETTINGS.AUTH_ENABLED, 'false');
  logger.info('Authentication disabled');
}

/**
 * Reset the API key (generates a new one)
 */
export async function resetApiKey(): Promise<string> {
  const newKey = await generateApiKey();
  logger.info('API key reset');
  return newKey;
}

/**
 * Extract API key from request headers
 * Supports:
 * - X-Api-Key header
 * - Authorization: Bearer <key>
 * - Authorization: ApiKey <key>
 */
function extractApiKey(c: Context): string | null {
  // Check X-Api-Key header
  const xApiKey = c.req.header('X-Api-Key');
  if (xApiKey) {
    return xApiKey;
  }

  // Check Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    // Bearer token format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    // ApiKey format
    if (authHeader.startsWith('ApiKey ')) {
      return authHeader.slice(7);
    }
  }

  return null;
}

/**
 * Authentication middleware
 * Checks for valid API key if authentication is enabled
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  // Check if auth is enabled
  const authEnabled = await isAuthEnabled();

  if (!authEnabled) {
    // Auth not enabled, allow request
    return next();
  }

  // Extract API key from request
  const apiKey = extractApiKey(c);

  if (!apiKey) {
    logger.warn(`Unauthorized request to ${c.req.path}: Missing API key`);
    return c.json(
      {
        success: false,
        error: 'Authentication required. Provide API key via X-Api-Key header or Authorization header.',
      },
      401
    );
  }

  // Verify the API key
  const isValid = await verifyApiKey(apiKey);

  if (!isValid) {
    logger.warn(`Unauthorized request to ${c.req.path}: Invalid API key`);
    return c.json(
      {
        success: false,
        error: 'Invalid API key',
      },
      401
    );
  }

  // API key is valid, proceed
  return next();
}

/**
 * Optional auth middleware - skips auth check for certain paths
 * Useful for endpoints that need to be accessible without auth (like /api/v1/auth/status)
 */
export function createAuthMiddleware(skipPaths: string[] = []): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next): Promise<Response | void> => {
    // Check if this path should skip auth
    const path = c.req.path;
    for (const skipPath of skipPaths) {
      if (path === skipPath || path.startsWith(skipPath + '/')) {
        return next();
      }
    }

    return authMiddleware(c, next);
  };
}
