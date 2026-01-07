import { Hono } from 'hono';
import { settingsService } from '../services/SettingsService';
import { downloadService } from '../services/DownloadService';
import { ALL_CATEGORIES, DEFAULT_CATEGORIES, CATEGORY_GROUPS } from '../../shared/categories';
import { logger } from '../utils/logger';

const settings = new Hono();

// GET /api/v1/settings - Get all settings
settings.get('/', async (c) => {
  logger.info('GET /api/v1/settings');

  try {
    const allSettings = await settingsService.getAllSettings();
    return c.json({ success: true, data: allSettings });
  } catch (error) {
    logger.error('Failed to get settings:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// PUT /api/v1/settings/dry-run - Toggle dry-run mode
settings.put('/dry-run', async (c) => {
  logger.info('PUT /api/v1/settings/dry-run');

  try {
    const body = await c.req.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return c.json({ success: false, error: 'enabled must be a boolean' }, 400);
    }

    await settingsService.setDryRun(enabled);

    return c.json({
      success: true,
      message: `Dry-run mode ${enabled ? 'enabled' : 'disabled'}`,
      data: enabled,
    });
  } catch (error) {
    logger.error('Failed to update dry-run status:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// PUT /api/v1/settings/categories - Update selected categories
settings.put('/categories', async (c) => {
  logger.info('PUT /api/v1/settings/categories');

  try {
    const body = await c.req.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return c.json({ success: false, error: 'Categories must be an array' }, 400);
    }

    // Validate that all categories are valid
    const validCategoryIds = ALL_CATEGORIES.map((cat) => cat.id);
    const invalidCategories = categories.filter((id) => !validCategoryIds.includes(id));

    if (invalidCategories.length > 0) {
      return c.json(
        {
          success: false,
          error: `Invalid category IDs: ${invalidCategories.join(', ')}`,
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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// GET /api/v1/settings/qbittorrent/categories - Get available qBittorrent categories
settings.get('/qbittorrent/categories', async (c) => {
  logger.info('GET /api/v1/settings/qbittorrent/categories');

  try {
    const categories = await downloadService.getCategories();
    return c.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Failed to get qBittorrent categories:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// PUT /api/v1/settings/qbittorrent/category - Update selected qBittorrent category
settings.put('/qbittorrent/category', async (c) => {
  logger.info('PUT /api/v1/settings/qbittorrent/category');

  try {
    const body = await c.req.json();
    const { category } = body;

    if (!category || typeof category !== 'string') {
      return c.json({ success: false, error: 'Category must be a string' }, 400);
    }

    await settingsService.setQBittorrentCategory(category);

    return c.json({
      success: true,
      message: 'qBittorrent category updated successfully',
      data: category,
    });
  } catch (error) {
    logger.error('Failed to update qBittorrent category:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// PUT /api/v1/settings - Update settings (bulk)
settings.put('/', async (c) => {
  logger.info('PUT /api/v1/settings');

  try {
    const body = await c.req.json();

    // Update each setting
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        await settingsService.setSetting(key, value);
      }
    }

    return c.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Failed to update settings:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
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
        // Not JSON, return as-is
        return c.json({ success: true, data: value });
      }
    }

    return c.json({ success: true, data: value });
  } catch (error) {
    logger.error(`Failed to get setting ${key}:`, error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// PUT /api/v1/settings/:key - Update individual setting (must be last to avoid conflicts)
settings.put('/:key', async (c) => {
  const key = c.req.param('key');
  logger.info(`PUT /api/v1/settings/${key}`);

  try {
    const body = await c.req.json();
    const { value } = body;

    if (value === undefined || value === null) {
      return c.json({ success: false, error: 'Value is required' }, 400);
    }

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
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

export default settings;
