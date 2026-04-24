import { Hono } from 'hono';
import { settingsService } from '../services/SettingsService';
import { discordClient, DiscordWebhookClient } from '../integrations/discord/DiscordWebhookClient';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode } from '../utils/errors';

const notifications = new Hono();

// POST /api/v1/notifications/test/discord - Test Discord webhook connection
// Optional body: { webhookUrl } to test an unsaved URL via a transient client.
// Empty body falls back to the configured singleton (saved webhook).
notifications.post('/test/discord', async (c) => {
  logger.info('POST /api/v1/notifications/test/discord');

  try {
    let body: { webhookUrl?: string } | null = null;
    try {
      const raw = await c.req.text();
      if (raw) body = JSON.parse(raw);
    } catch {
      body = null;
    }

    if (body && body.webhookUrl) {
      const transient = new DiscordWebhookClient({ webhookUrl: body.webhookUrl });
      const connected = await transient.testConnection();
      return c.json({ success: true, data: connected });
    }

    // Reload saved settings and reconfigure singleton before testing
    const webhookUrl = await settingsService.getSetting('discord_webhook_url');

    if (webhookUrl) {
      discordClient.configure({ webhookUrl });
    }

    const connected = await discordClient.testConnection();
    return c.json({ success: true, data: connected });
  } catch (error) {
    logger.error('Discord connection test failed:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error) as any);
  }
});

export default notifications;
