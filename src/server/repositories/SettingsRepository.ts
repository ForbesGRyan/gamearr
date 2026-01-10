import { eq } from 'drizzle-orm';
import { db } from '../db';
import { settings, type Settings, type NewSettings } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const settingsFields = {
  id: settings.id,
  key: settings.key,
  value: settings.value,
};

export class SettingsRepository {
  /**
   * Get setting by key
   */
  async get(key: string): Promise<string | null> {
    const results = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key));

    return results[0]?.value || null;
  }

  /**
   * Get setting as JSON
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch (error) {
      logger.error(`Failed to parse JSON for setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Set setting (upsert - insert or update if exists)
   */
  async set(key: string, value: string): Promise<void> {
    logger.info(`Setting ${key}`);

    // Use upsert pattern to avoid race conditions
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value },
      });
  }

  /**
   * Set setting as JSON
   */
  async setJSON<T extends Record<string, unknown> | unknown[]>(key: string, value: T): Promise<void> {
    const jsonString = JSON.stringify(value);
    await this.set(key, jsonString);
  }

  /**
   * Delete setting
   */
  async delete(key: string): Promise<void> {
    logger.info(`Deleting setting ${key}`);
    await db.delete(settings).where(eq(settings.key, key));
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<Settings[]> {
    return db.select(settingsFields).from(settings);
  }
}

// Singleton instance
export const settingsRepository = new SettingsRepository();
