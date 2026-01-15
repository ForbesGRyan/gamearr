import type {
  DiscordWebhookConfig,
  DiscordWebhookPayload,
  DiscordEmbed,
  DownloadCompleteNotification,
} from './types';
import { logger } from '../../utils/logger';
import { DiscordError, ErrorCode } from '../../utils/errors';
import { fetchWithRetry, RateLimiter } from '../../utils/http';

// Gamearr brand color (green)
const GAMEARR_COLOR = 0x22c55e;

export class DiscordWebhookClient {
  private webhookUrl: string;
  private configured: boolean = false;

  // Discord rate limit: 30 requests per minute per webhook
  // Using conservative 10 req/sec to stay safe
  private readonly rateLimiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

  constructor(config?: DiscordWebhookConfig) {
    this.webhookUrl = config?.webhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
    this.configured = this.isValidWebhookUrl(this.webhookUrl);
  }

  /**
   * Configure the client with a webhook URL
   */
  configure(config: DiscordWebhookConfig): void {
    this.webhookUrl = config.webhookUrl || '';
    this.configured = this.isValidWebhookUrl(this.webhookUrl);

    if (this.configured) {
      logger.info('Discord webhook client configured');
    }
  }

  /**
   * Check if webhook URL is configured
   */
  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Validate webhook URL format
   */
  private isValidWebhookUrl(url: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === 'discord.com' &&
        parsed.pathname.startsWith('/api/webhooks/')
      );
    } catch {
      return false;
    }
  }

  /**
   * Send a payload to the Discord webhook
   */
  private async send(payload: DiscordWebhookPayload): Promise<void> {
    if (!this.isConfigured()) {
      throw new DiscordError(
        'Not configured. Please add your Discord webhook URL.',
        ErrorCode.DISCORD_NOT_CONFIGURED
      );
    }

    try {
      await this.rateLimiter.acquire();

      const response = await fetchWithRetry(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Discord returns 204 No Content on success
      if (!response.ok && response.status !== 204) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new DiscordError(
          `Webhook request failed (${response.status}): ${errorText}`,
          ErrorCode.DISCORD_ERROR
        );
      }

      logger.debug('Discord webhook message sent successfully');
    } catch (error) {
      if (error instanceof DiscordError) {
        throw error;
      }
      logger.error('Discord webhook request failed:', error);
      throw new DiscordError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.DISCORD_CONNECTION_FAILED
      );
    }
  }

  /**
   * Send a rich embed to Discord
   */
  async sendEmbed(embed: DiscordEmbed): Promise<void> {
    await this.send({
      embeds: [embed],
    });
  }

  /**
   * Send a simple text message to Discord
   */
  async sendMessage(content: string): Promise<void> {
    await this.send({ content });
  }

  /**
   * Test connection by sending a test message
   */
  async testConnection(): Promise<boolean> {
    logger.info(`Discord testConnection called - configured: ${this.configured}`);
    try {
      await this.send({
        embeds: [
          {
            title: 'Gamearr Connected',
            description: 'Discord notifications are now configured and working.',
            color: GAMEARR_COLOR,
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Gamearr',
            },
          },
        ],
      });
      logger.info('Discord connection test successful');
      return true;
    } catch (error) {
      logger.error('Discord connection test failed:', error);
      return false;
    }
  }

  /**
   * Send a download complete notification
   */
  async notifyDownloadComplete(notification: DownloadCompleteNotification): Promise<void> {
    const { gameTitle, coverUrl, store, releaseTitle, size } = notification;

    const fields = [];

    if (store) {
      fields.push({
        name: 'Store',
        value: store,
        inline: true,
      });
    }

    if (size) {
      fields.push({
        name: 'Size',
        value: formatBytes(size),
        inline: true,
      });
    }

    const embed: DiscordEmbed = {
      title: 'Download Complete',
      description: `**${gameTitle}** has finished downloading`,
      color: GAMEARR_COLOR,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Gamearr',
      },
      fields: fields.length > 0 ? fields : undefined,
    };

    if (coverUrl) {
      embed.thumbnail = { url: coverUrl };
    }

    if (releaseTitle) {
      embed.description += `\n\n*${releaseTitle}*`;
    }

    await this.sendEmbed(embed);
    logger.info(`Discord notification sent for: ${gameTitle}`);
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Singleton instance
export const discordClient = new DiscordWebhookClient();
