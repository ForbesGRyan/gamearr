import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Libraries table - must be defined before games for foreign key reference
export const libraries = sqliteTable('libraries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  platform: text('platform'), // "PC", "PlayStation", "Nintendo", etc. for filtering
  monitored: integer('monitored', { mode: 'boolean' }).notNull().default(true),
  downloadEnabled: integer('download_enabled', { mode: 'boolean' }).notNull().default(true),
  downloadCategory: text('download_category').default('gamearr'), // qBittorrent category for downloads
  priority: integer('priority').notNull().default(0), // For ordering in UI
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  igdbId: integer('igdb_id').notNull().unique(),
  title: text('title').notNull(),
  year: integer('year'),
  platform: text('platform').notNull(),
  store: text('store'), // Steam, Epic Games, GOG, etc.
  steamName: text('steam_name'), // Original name from Steam (for diagnosing mismatches)
  monitored: integer('monitored', { mode: 'boolean' }).notNull().default(true),
  status: text('status', {
    enum: ['wanted', 'downloading', 'downloaded']
  }).notNull().default('wanted'),
  coverUrl: text('cover_url'),
  folderPath: text('folder_path'),
  libraryId: integer('library_id').references(() => libraries.id, { onDelete: 'set null' }),
  // Metadata fields from IGDB
  summary: text('summary'),
  genres: text('genres'), // JSON array of genre names
  totalRating: integer('total_rating'), // 0-100 rating score
  developer: text('developer'),
  publisher: text('publisher'),
  gameModes: text('game_modes'), // JSON array of game mode names
  similarGames: text('similar_games'), // JSON array of {igdbId, name, coverUrl}
  // Update tracking fields
  installedVersion: text('installed_version'), // Current downloaded version (e.g., "v1.2.3")
  installedQuality: text('installed_quality'), // Quality of installed release (GOG, Scene, etc.)
  latestVersion: text('latest_version'), // Latest available version detected
  updatePolicy: text('update_policy', {
    enum: ['notify', 'auto', 'ignore']
  }).default('notify'),
  lastUpdateCheck: integer('last_update_check', { mode: 'timestamp' }),
  updateAvailable: integer('update_available', { mode: 'boolean' }).default(false),
  addedAt: integer('added_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  statusIdx: index('games_status_idx').on(table.status),
  monitoredIdx: index('games_monitored_idx').on(table.monitored),
  libraryIdIdx: index('games_library_id_idx').on(table.libraryId),
}));

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
  torrentHash: text('torrent_hash'), // qBittorrent torrent hash for reliable matching
  grabbedAt: integer('grabbed_at', { mode: 'timestamp' }),
  status: text('status', {
    enum: ['pending', 'downloading', 'completed', 'failed']
  }).notNull().default('pending'),
}, (table) => ({
  gameIdIdx: index('releases_game_id_idx').on(table.gameId),
  statusIdx: index('releases_status_idx').on(table.status),
  torrentHashIdx: index('releases_torrent_hash_idx').on(table.torrentHash),
}));

export const downloadHistory = sqliteTable('download_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  releaseId: integer('release_id')
    .notNull()
    .references(() => releases.id, { onDelete: 'cascade' }),
  downloadId: text('download_id').notNull().unique(),
  status: text('status').notNull(),
  progress: integer('progress').notNull().default(0),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  gameIdIdx: index('download_history_game_id_idx').on(table.gameId),
  releaseIdIdx: index('download_history_release_id_idx').on(table.releaseId),
  statusIdx: index('download_history_status_idx').on(table.status),
}));

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON string
});

export const libraryFiles = sqliteTable('library_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  folderPath: text('folder_path').notNull().unique(),
  parsedTitle: text('parsed_title'),
  parsedYear: integer('parsed_year'),
  matchedGameId: integer('matched_game_id').references(() => games.id, { onDelete: 'set null' }),
  libraryId: integer('library_id').references(() => libraries.id, { onDelete: 'cascade' }),
  ignored: integer('ignored', { mode: 'boolean' }).notNull().default(false),
  scannedAt: integer('scanned_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  matchedGameIdIdx: index('library_files_matched_game_id_idx').on(table.matchedGameId),
  libraryIdIdx: index('library_files_library_id_idx').on(table.libraryId),
  ignoredIdx: index('library_files_ignored_idx').on(table.ignored),
}));

export const gameUpdates = sqliteTable('game_updates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  updateType: text('update_type', {
    enum: ['version', 'dlc', 'better_release']
  }).notNull(),
  title: text('title').notNull(), // Release title
  version: text('version'), // Version if detected
  size: integer('size'), // Size in bytes
  quality: text('quality'), // GOG, DRM-Free, Repack, Scene
  seeders: integer('seeders'),
  downloadUrl: text('download_url'),
  indexer: text('indexer'),
  detectedAt: integer('detected_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  status: text('status', {
    enum: ['pending', 'grabbed', 'dismissed']
  }).notNull().default('pending'),
}, (table) => ({
  gameIdIdx: index('game_updates_game_id_idx').on(table.gameId),
  statusIdx: index('game_updates_status_idx').on(table.status),
}));

// Type exports
export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type Release = typeof releases.$inferSelect;
export type NewRelease = typeof releases.$inferInsert;

export type DownloadHistory = typeof downloadHistory.$inferSelect;
export type NewDownloadHistory = typeof downloadHistory.$inferInsert;

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export type LibraryFile = typeof libraryFiles.$inferSelect;
export type NewLibraryFile = typeof libraryFiles.$inferInsert;

export type GameUpdate = typeof gameUpdates.$inferSelect;
export type NewGameUpdate = typeof gameUpdates.$inferInsert;
