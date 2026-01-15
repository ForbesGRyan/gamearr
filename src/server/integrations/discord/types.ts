// Discord Webhook API types

export interface DiscordWebhookConfig {
  webhookUrl: string;
}

/**
 * Discord embed field
 */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Discord embed thumbnail/image
 */
export interface DiscordEmbedMedia {
  url: string;
  height?: number;
  width?: number;
}

/**
 * Discord embed footer
 */
export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

/**
 * Discord embed author
 */
export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

/**
 * Discord embed structure
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string; // ISO8601 timestamp
  color?: number; // Decimal color code
  footer?: DiscordEmbedFooter;
  thumbnail?: DiscordEmbedMedia;
  image?: DiscordEmbedMedia;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}

/**
 * Discord webhook payload
 */
export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Gamearr-specific notification data for download complete events
 */
export interface DownloadCompleteNotification {
  gameTitle: string;
  coverUrl?: string;
  store?: string;
  releaseTitle?: string;
  size?: number;
}
