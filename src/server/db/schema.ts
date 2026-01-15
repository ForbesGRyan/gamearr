import { sqliteTable, integer, text, index, unique } from 'drizzle-orm/sqlite-core';
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

// Stores table - must be defined before games for gameStores foreign key reference
export const stores = sqliteTable('stores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // 'Steam', 'GOG', 'Epic Games'
  slug: text('slug').notNull().unique(), // 'steam', 'gog', 'epic'
  iconUrl: text('icon_url'), // Optional store icon
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  igdbId: integer('igdb_id').notNull().unique(),
  title: text('title').notNull(),
  slug: text('slug'), // URL-safe slug for lookups (generated from title)
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
  // HowLongToBeat integration
  hltbId: text('hltb_id'), // HLTB game ID for future lookups
  hltbMain: integer('hltb_main'), // Main story hours (stored as minutes)
  hltbMainExtra: integer('hltb_main_extra'), // Main + extras hours (minutes)
  hltbCompletionist: integer('hltb_completionist'), // Completionist hours (minutes)
  hltbLastSync: integer('hltb_last_sync', { mode: 'timestamp' }),
  // ProtonDB integration
  protonDbTier: text('protondb_tier'), // native, platinum, gold, silver, bronze, borked
  protonDbScore: integer('protondb_score'), // Numeric score 0-100
  protonDbLastSync: integer('protondb_last_sync', { mode: 'timestamp' }),
  addedAt: integer('added_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  statusIdx: index('games_status_idx').on(table.status),
  monitoredIdx: index('games_monitored_idx').on(table.monitored),
  libraryIdIdx: index('games_library_id_idx').on(table.libraryId),
  slugIdx: index('games_slug_idx').on(table.slug),
  // Compound indexes for common query patterns
  statusMonitoredIdx: index('games_status_monitored_idx').on(table.status, table.monitored),
  libraryStatusIdx: index('games_library_status_idx').on(table.libraryId, table.status),
}));

// Junction table for games and stores (many-to-many)
export const gameStores = sqliteTable('game_stores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  storeId: integer('store_id')
    .notNull()
    .references(() => stores.id, { onDelete: 'cascade' }),
  storeGameId: text('store_game_id'), // Steam appId, GOG gameId, etc.
  storeName: text('store_name'), // Original name from store (for mismatch tracking)
  addedAt: integer('added_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  gameStoreUnique: unique().on(table.gameId, table.storeId),
  gameIdIdx: index('game_stores_game_id_idx').on(table.gameId),
  storeIdIdx: index('game_stores_store_id_idx').on(table.storeId),
}));

// Game folders table - supports multiple folders per game (base game, updates, DLC)
export const gameFolders = sqliteTable('game_folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  folderPath: text('folder_path').notNull(),
  version: text('version'), // e.g., "v1.2.3", "Update 5"
  quality: text('quality'), // e.g., "GOG", "Scene", "Steam"
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  addedAt: integer('added_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  gameIdIdx: index('game_folders_game_id_idx').on(table.gameId),
  folderPathUnique: unique().on(table.folderPath),
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

// Game events table - tracks game lifecycle events (imports, rematch, etc.)
export const gameEvents = sqliteTable('game_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  eventType: text('event_type', {
    enum: ['imported_steam', 'imported_gog', 'imported_manual', 'imported_download', 'igdb_rematch', 'folder_matched', 'status_changed']
  }).notNull(),
  data: text('data'), // JSON object with event-specific data
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  gameIdIdx: index('game_events_game_id_idx').on(table.gameId),
  eventTypeIdx: index('game_events_event_type_idx').on(table.eventType),
}));

// Embeddings cache for semantic search
export const gameEmbeddings = sqliteTable('game_embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id')
    .notNull()
    .unique()  // One embedding per game
    .references(() => games.id, { onDelete: 'cascade' }),
  titleHash: text('title_hash').notNull(), // SHA256 of title for cache invalidation
  embedding: text('embedding').notNull(),  // JSON array of floats
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  titleHashIdx: index('game_embeddings_title_hash_idx').on(table.titleHash),
}));

// API cache table for trending games and top torrents
export const apiCache = sqliteTable('api_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cacheKey: text('cache_key').notNull().unique(),
  cacheType: text('cache_type', { enum: ['trending_games', 'top_torrents', 'popularity_types'] }).notNull(),
  data: text('data').notNull(), // JSON blob
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  cacheKeyIdx: index('api_cache_key_idx').on(table.cacheKey),
  expiresAtIdx: index('api_cache_expires_at_idx').on(table.expiresAt),
}));

// Type exports
export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type GameStore = typeof gameStores.$inferSelect;
export type NewGameStore = typeof gameStores.$inferInsert;

export type GameFolder = typeof gameFolders.$inferSelect;
export type NewGameFolder = typeof gameFolders.$inferInsert;

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

export type GameEmbedding = typeof gameEmbeddings.$inferSelect;
export type NewGameEmbedding = typeof gameEmbeddings.$inferInsert;

export type GameEvent = typeof gameEvents.$inferSelect;
export type NewGameEvent = typeof gameEvents.$inferInsert;

export type ApiCache = typeof apiCache.$inferSelect;
export type NewApiCache = typeof apiCache.$inferInsert;
