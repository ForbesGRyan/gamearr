import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { settingsService } from '../services/SettingsService';
import { downloadService } from '../services/DownloadService';
import { qbittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { ALL_CATEGORIES, DEFAULT_CATEGORIES, CATEGORY_GROUPS } from '../../shared/categories';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';

// Allowlist of settings that can be modified via API
// Security-sensitive settings are explicitly excluded
const ALLOWED_SETTINGS = new Set([
  // Integration credentials (user-configurable)
  'prowlarr_url',
  'prowlarr_api_key',
  'qbittorrent_host',
  'qbittorrent_username',
  'qbittorrent_password',
  'qbittorrent_category',
  'igdb_client_id',
  'igdb_client_secret',
  'steam_api_key',
  'steam_id',
  // Library settings
  'library_path',
  // Automation settings
  'rss_sync_interval',
  'search_scheduler_interval',
  'auto_grab_min_score',
  'auto_grab_min_seeders',
  'update_check_enabled',
  'update_check_schedule',
  'default_update_policy',
  // Feature flags
  'dry_run',
  // Network settings
  'trusted_proxies',
]);

// Settings that should NEVER be modified via bulk update
// These require specific endpoints with proper validation
const PROTECTED_SETTINGS = new Set([
  'auth_enabled',
  'api_key_hash',
  'setup_skipped',
  'prowlarr_categories', // Has dedicated endpoint with validation
]);

// Validation schemas
const dryRunSchema = z.object({
  enabled: z.boolean(),
});

const categoriesSchema = z.object({
  categories: z.array(z.number()),
});

const qbCategorySchema = z.object({
  category: z.string().min(1),
});

const settingValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), z.record(z.unknown())]),
});

const settings = new Hono();

// GET /api/v1/settings - Get all settings
settings.get('/', async (c) => {
  logger.info('GET /api/v1/settings');

  try {
    const allSettings = await settingsService.getAllSettings();
    return c.json({ success: true, data: allSettings });
  } catch (error) {
    logger.error('Failed to get settings:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/settings/dry-run - Get dry-run mode status
settings.get('/dry-run', async (c) => {
  logger.info('GET /api/v1/settings/dry-run');

  try {
    const dryRun = await settingsService.getDryRun();
    return c.json({ success: true, data: dryRun });
  } catch (error) {
    logger.error('Failed to get dry-run status:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/settings/dry-run - Toggle dry-run mode
settings.put('/dry-run', zValidator('json', dryRunSchema), async (c) => {
  logger.info('PUT /api/v1/settings/dry-run');

  try {
    const { enabled } = c.req.valid('json');

    await settingsService.setDryRun(enabled);

    return c.json({
      success: true,
      message: `Dry-run mode ${enabled ? 'enabled' : 'disabled'}`,
      data: enabled,
    });
  } catch (error) {
    logger.error('Failed to update dry-run status:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/settings/categories - Get available categories
settings.get('/categories', async (c) => {
  logger.info('GET /api/v1/settings/categories');

  try {
    return c.json({
      success: true,
      data: {
        available: ALL_CATEGORIES,
        groups: CATEGORY_GROUPS,
        default: DEFAULT_CATEGORIES,
      },
    });
  } catch (error) {
    logger.error('Failed to get categories:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/settings/categories/selected - Get selected categories
settings.get('/categories/selected', async (c) => {
  logger.info('GET /api/v1/settings/categories/selected');

  try {
    const categories = await settingsService.getProwlarrCategories();
    return c.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Failed to get selected categories:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/settings/categories - Update selected categories
settings.put('/categories', zValidator('json', categoriesSchema), async (c) => {
  logger.info('PUT /api/v1/settings/categories');

  try {
    const { categories } = c.req.valid('json');

    // Validate that all categories are valid
    const validCategoryIds = ALL_CATEGORIES.map((cat) => cat.id);
    const invalidCategories = categories.filter((id) => !validCategoryIds.includes(id));

    if (invalidCategories.length > 0) {
      return c.json(
        {
          success: false,
          error: `Invalid category IDs: ${invalidCategories.join(', ')}`,
          code: ErrorCode.VALIDATION_ERROR,
        },
        400
      );
    }

    await settingsService.setProwlarrCategories(categories);

    return c.json({
      success: true,
      message: 'Categories updated successfully',
      data: categories,
    });
  } catch (error) {
    logger.error('Failed to update categories:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/settings/qbittorrent/categories - Get available qBittorrent categories
settings.get('/qbittorrent/categories', async (c) => {
  logger.info('GET /api/v1/settings/qbittorrent/categories');

  try {
    // Reload settings and reconfigure client before fetching
    // This ensures we use the latest saved settings
    const qbHost = await settingsService.getSetting('qbittorrent_host');
    const qbUsername = await settingsService.getSetting('qbittorrent_username');
    const qbPassword = await settingsService.getSetting('qbittorrent_password');

    if (qbHost && qbUsername !== null) {
      qbittorrentClient.configure({
        host: qbHost,
        username: qbUsername || '',
        password: qbPassword || '',
      });
    }

    const categories = await downloadService.getCategories();
    return c.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Failed to get qBittorrent categories:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/settings/qbittorrent/category - Get selected qBittorrent category
settings.get('/qbittorrent/category', async (c) => {
  logger.info('GET /api/v1/settings/qbittorrent/category');

  try {
    const category = await settingsService.getQBittorrentCategory();
    return c.json({ success: true, data: category });
  } catch (error) {
    logger.error('Failed to get qBittorrent category:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/settings/qbittorrent/category - Update selected qBittorrent category
settings.put('/qbittorrent/category', zValidator('json', qbCategorySchema), async (c) => {
  logger.info('PUT /api/v1/settings/qbittorrent/category');

  try {
    const { category } = c.req.valid('json');

    await settingsService.setQBittorrentCategory(category);

    return c.json({
      success: true,
      message: 'qBittorrent category updated successfully',
      data: category,
    });
  } catch (error) {
    logger.error('Failed to update qBittorrent category:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/settings - Update settings (bulk)
settings.put('/', async (c) => {
  logger.info('PUT /api/v1/settings');

  try {
    const body = await c.req.json();
    const entries = Object.entries(body);

    // Security: Check for protected settings
    const protectedAttempts = entries
      .map(([key]) => key)
      .filter((key) => PROTECTED_SETTINGS.has(key));

    if (protectedAttempts.length > 0) {
      logger.warn(`Attempted to modify protected settings: ${protectedAttempts.join(', ')}`);
      return c.json(
        {
          success: false,
          error: `Cannot modify protected settings: ${protectedAttempts.join(', ')}`,
          code: ErrorCode.FORBIDDEN,
        },
        403
      );
    }

    // Security: Only allow known settings
    const unknownSettings = entries
      .map(([key]) => key)
      .filter((key) => !ALLOWED_SETTINGS.has(key));

    if (unknownSettings.length > 0) {
      logger.warn(`Attempted to set unknown settings: ${unknownSettings.join(', ')}`);
      return c.json(
        {
          success: false,
          error: `Unknown settings: ${unknownSettings.join(', ')}. Use specific endpoints for special settings.`,
          code: ErrorCode.VALIDATION_ERROR,
        },
        400
      );
    }

    // Update each validated setting
    for (const [key, value] of entries) {
      if (typeof value === 'string') {
        await settingsService.setSetting(key, value);
      }
    }

    return c.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Failed to update settings:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/settings/:key - Get individual setting (must be last to avoid conflicts)
settings.get('/:key', async (c) => {
  const key = c.req.param('key');
  logger.info(`GET /api/v1/settings/${key}`);

  try {
    const value = await settingsService.getSetting(key);

    // Try to parse JSON values (for booleans, numbers, arrays stored as JSON)
    if (value !== null) {
      try {
        const parsed = JSON.parse(value);
        return c.json({ success: true, data: parsed });
      } catch {
        // Value is not valid JSON, return as plain string (expected for string settings)
        return c.json({ success: true, data: value });
      }
    }

    return c.json({ success: true, data: value });
  } catch (error) {
    logger.error(`Failed to get setting ${key}:`, error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/settings/:key - Update individual setting (must be last to avoid conflicts)
settings.put('/:key', zValidator('json', settingValueSchema), async (c) => {
  const key = c.req.param('key');
  logger.info(`PUT /api/v1/settings/${key}`);

  try {
    // Security: Check for protected settings
    if (PROTECTED_SETTINGS.has(key)) {
      logger.warn(`Attempted to modify protected setting: ${key}`);
      return c.json(
        {
          success: false,
          error: `Cannot modify protected setting: ${key}`,
          code: ErrorCode.FORBIDDEN,
        },
        403
      );
    }

    // Security: Only allow known settings
    if (!ALLOWED_SETTINGS.has(key)) {
      logger.warn(`Attempted to set unknown setting: ${key}`);
      return c.json(
        {
          success: false,
          error: `Unknown setting: ${key}. Use specific endpoints for special settings.`,
          code: ErrorCode.VALIDATION_ERROR,
        },
        400
      );
    }

    const { value } = c.req.valid('json');

    // Store non-strings as JSON, strings as-is
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    await settingsService.setSetting(key, valueToStore);

    return c.json({
      success: true,
      message: `Setting ${key} updated successfully`,
      data: value,
    });
  } catch (error) {
    logger.error(`Failed to update setting ${key}:`, error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default settings;
