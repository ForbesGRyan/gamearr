import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  igdbId: integer('igdb_id').notNull().unique(),
  title: text('title').notNull(),
  year: integer('year'),
  platform: text('platform').notNull(),
  monitored: integer('monitored', { mode: 'boolean' }).notNull().default(true),
  status: text('status', {
    enum: ['wanted', 'downloading', 'downloaded']
  }).notNull().default('wanted'),
  coverUrl: text('cover_url'),
  folderPath: text('folder_path'),
  addedAt: integer('added_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const releases = sqliteTable('releases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  size: integer('size'),
  seeders: integer('seeders'),
  downloadUrl: text('download_url').notNull(),
  indexer: text('indexer').notNull(),
  quality: text('quality'),
  grabbedAt: integer('grabbed_at', { mode: 'timestamp' }),
  status: text('status', {
    enum: ['pending', 'downloading', 'completed', 'failed']
  }).notNull().default('pending'),
});

export const downloadHistory = sqliteTable('download_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  releaseId: integer('release_id')
    .notNull()
    .references(() => releases.id, { onDelete: 'cascade' }),
  downloadId: text('download_id').notNull(),
  status: text('status').notNull(),
  progress: integer('progress').notNull().default(0),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON string
});

// Type exports
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type Release = typeof releases.$inferSelect;
export type NewRelease = typeof releases.$inferInsert;

export type DownloadHistory = typeof downloadHistory.$inferSelect;
export type NewDownloadHistory = typeof downloadHistory.$inferInsert;

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
