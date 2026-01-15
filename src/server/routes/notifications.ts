import { Hono } from 'hono';
import { settingsService } from '../services/SettingsService';
import { discordClient } from '../integrations/discord/DiscordWebhookClient';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode } from '../utils/errors';

const notifications = new Hono();

// GET /api/v1/notifications/test/discord - Test Discord webhook connection
notifications.get('/test/discord', async (c) => {
  logger.info('GET /api/v1/notifications/test/discord');

  try {
    // Reload settings and reconfigure client before testing
    const webhookUrl = await settingsService.getSetting('discord_webhook_url');

    if (webhookUrl) {
      discordClient.configure({ webhookUrl });
    }

    const connected = await discordClient.testConnection();
    return c.json({ success: true, data: connected });
  } catch (error) {
    logger.error('Discord connection test failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default notifications;
