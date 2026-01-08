/**
 * Authentication management routes
 * Handles enabling/disabling auth and API key management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode } from '../utils/errors';
import {
  isAuthEnabled,
  enableAuth,
  disableAuth,
  resetApiKey,
} from '../middleware/auth';

const auth = new Hono();

// Validation schemas
const enableAuthSchema = z.object({
  enable: z.boolean(),
});

/**
 * GET /api/v1/auth/status
 * Check if authentication is enabled
 * This endpoint is always accessible (no auth required)
 */
auth.get('/status', async (c) => {
  logger.info('GET /api/v1/auth/status');

  try {
    const enabled = await isAuthEnabled();

    return c.json({
      success: true,
      data: {
        authEnabled: enabled,
      },
    });
  } catch (error) {
    logger.error('Failed to get auth status:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/enable
 * Enable authentication and optionally generate a new API key
 * WARNING: This endpoint should only be called from a trusted context
 * Once auth is enabled, this endpoint will require authentication
 */
auth.post('/enable', async (c) => {
  logger.info('POST /api/v1/auth/enable');

  try {
    const newApiKey = await enableAuth();

    // If a new key was generated, return it (only shown once!)
    if (newApiKey) {
      return c.json({
        success: true,
        data: {
          authEnabled: true,
          apiKey: newApiKey,
          message: 'Authentication enabled. SAVE THIS API KEY - it will not be shown again!',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        authEnabled: true,
        message: 'Authentication enabled with existing API key.',
      },
    });
  } catch (error) {
    logger.error('Failed to enable auth:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * POST /api/v1/auth/disable
 * Disable authentication
 * WARNING: This makes the API accessible without authentication
 */
auth.post('/disable', async (c) => {
  logger.info('POST /api/v1/auth/disable');

  try {
    await disableAuth();

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

/**
 * POST /api/v1/auth/reset-key
 * Generate a new API key (invalidates the old one)
 */
auth.post('/reset-key', async (c) => {
  logger.info('POST /api/v1/auth/reset-key');

  try {
    const newApiKey = await resetApiKey();

    return c.json({
      success: true,
      data: {
        apiKey: newApiKey,
        message: 'API key reset. SAVE THIS NEW API KEY - it will not be shown again!',
      },
    });
  } catch (error) {
    logger.error('Failed to reset API key:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default auth;
