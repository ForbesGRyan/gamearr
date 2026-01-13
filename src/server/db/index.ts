import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as schema from './schema';
import { logger } from '../utils/logger';

// Get data path from environment or use default
const dataPath = process.env.DATA_PATH || './data';
const dbPath = join(dataPath, 'gamearr.db');

// Ensure data directory exists
if (!existsSync(dataPath)) {
  mkdirSync(dataPath, { recursive: true });
}

// Initialize SQLite database
const sqlite = new Database(dbPath);

// Enable foreign keys
sqlite.run('PRAGMA foreign_keys = ON');

// Initialize schema if tables don't exist
function initializeSchema() {
  // Check if tables exist
  const tablesExist = sqlite.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
  ).get();

  if (!tablesExist) {
    logger.info('Initializing database schema...');

    // Create libraries table first (referenced by games)
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS libraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        platform TEXT,
        monitored INTEGER NOT NULL DEFAULT 1,
        download_enabled INTEGER NOT NULL DEFAULT 1,
        download_category TEXT DEFAULT 'gamearr',
        priority INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create stores table (Steam, GOG, Epic, etc.)
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        icon_url TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create games table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igdb_id INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        slug TEXT,
        year INTEGER,
        platform TEXT NOT NULL,
        store TEXT,
        steam_name TEXT,
        monitored INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'wanted',
        cover_url TEXT,
        folder_path TEXT,
        library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
        summary TEXT,
        genres TEXT,
        total_rating INTEGER,
        developer TEXT,
        publisher TEXT,
        game_modes TEXT,
        similar_games TEXT,
        installed_version TEXT,
        installed_quality TEXT,
        latest_version TEXT,
        update_policy TEXT DEFAULT 'notify',
        last_update_check INTEGER,
        update_available INTEGER DEFAULT 0,
        added_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create game_stores junction table (many-to-many: games <-> stores)
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS game_stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        store_game_id TEXT,
        store_name TEXT,
        added_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(game_id, store_id)
      )
    `);

    // Create game_folders table (multiple folders per game: base game, updates, DLC)
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS game_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        folder_path TEXT NOT NULL,
        version TEXT,
        quality TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        added_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create releases table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        size INTEGER,
        seeders INTEGER,
        download_url TEXT NOT NULL,
        indexer TEXT NOT NULL,
        quality TEXT,
        torrent_hash TEXT,
        grabbed_at INTEGER,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `);

    // Create download_history table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS download_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
        download_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER
      )
    `);

    // Create settings table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      )
    `);

    // Create library_files table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS library_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_path TEXT NOT NULL UNIQUE,
        parsed_title TEXT,
        parsed_year INTEGER,
        matched_game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
        library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
        ignored INTEGER NOT NULL DEFAULT 0,
        scanned_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create game_updates table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS game_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        update_type TEXT NOT NULL,
        title TEXT NOT NULL,
        version TEXT,
        size INTEGER,
        quality TEXT,
        seeders INTEGER,
        download_url TEXT,
        indexer TEXT,
        detected_at INTEGER NOT NULL DEFAULT (unixepoch()),
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `);

    // Create game_events table for tracking game lifecycle events
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS game_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create game_embeddings table for semantic search
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS game_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
        title_hash TEXT NOT NULL,
        embedding TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create api_cache table for server-side caching
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS api_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT NOT NULL UNIQUE,
        cache_type TEXT NOT NULL,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create indexes
    sqlite.run('CREATE INDEX IF NOT EXISTS games_status_idx ON games(status)');
    sqlite.run('CREATE INDEX IF NOT EXISTS games_monitored_idx ON games(monitored)');
    sqlite.run('CREATE INDEX IF NOT EXISTS games_library_id_idx ON games(library_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS games_slug_idx ON games(slug)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_stores_game_id_idx ON game_stores(game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_stores_store_id_idx ON game_stores(store_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_folders_game_id_idx ON game_folders(game_id)');
    sqlite.run('CREATE UNIQUE INDEX IF NOT EXISTS game_folders_folder_path_unique ON game_folders(folder_path)');
    sqlite.run('CREATE INDEX IF NOT EXISTS releases_game_id_idx ON releases(game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS releases_status_idx ON releases(status)');
    sqlite.run('CREATE INDEX IF NOT EXISTS releases_torrent_hash_idx ON releases(torrent_hash)');
    sqlite.run('CREATE INDEX IF NOT EXISTS download_history_game_id_idx ON download_history(game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS download_history_release_id_idx ON download_history(release_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS download_history_status_idx ON download_history(status)');
    sqlite.run('CREATE INDEX IF NOT EXISTS library_files_matched_game_id_idx ON library_files(matched_game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS library_files_library_id_idx ON library_files(library_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS library_files_ignored_idx ON library_files(ignored)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_updates_game_id_idx ON game_updates(game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_updates_status_idx ON game_updates(status)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_events_game_id_idx ON game_events(game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_events_event_type_idx ON game_events(event_type)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_embeddings_title_hash_idx ON game_embeddings(title_hash)');
    sqlite.run('CREATE INDEX IF NOT EXISTS api_cache_key_idx ON api_cache(cache_key)');
    sqlite.run('CREATE INDEX IF NOT EXISTS api_cache_expires_at_idx ON api_cache(expires_at)');

    logger.info('Schema initialized successfully');
  }
}

// Run schema initialization
initializeSchema();

// Run migrations for existing databases
function runMigrations() {
  // Helper to check if table exists
  const tableExists = (table: string): boolean => {
    const result = sqlite.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table);
    return !!result;
  };

  // Helper to check if column exists
  const columnExists = (table: string, column: string): boolean => {
    const result = sqlite.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return result.some((col) => col.name === column);
  };

  // Helper to add column if missing
  const addColumnIfMissing = (table: string, column: string, definition: string) => {
    if (!columnExists(table, column)) {
      logger.info(`Migration: Adding ${column} column to ${table}`);
      sqlite.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  // Create stores table if missing
  if (!tableExists('stores')) {
    logger.info('Migration: Creating stores table');
    sqlite.run(`
      CREATE TABLE stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        icon_url TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
  }

  // Create game_stores table if missing
  if (!tableExists('game_stores')) {
    logger.info('Migration: Creating game_stores table');
    sqlite.run(`
      CREATE TABLE game_stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        store_game_id TEXT,
        store_name TEXT,
        added_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(game_id, store_id)
      )
    `);
    sqlite.run('CREATE INDEX IF NOT EXISTS game_stores_game_id_idx ON game_stores(game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_stores_store_id_idx ON game_stores(store_id)');
  }

  // Create game_events table if missing
  if (!tableExists('game_events')) {
    logger.info('Migration: Creating game_events table');
    sqlite.run(`
      CREATE TABLE game_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    sqlite.run('CREATE INDEX IF NOT EXISTS game_events_game_id_idx ON game_events(game_id)');
    sqlite.run('CREATE INDEX IF NOT EXISTS game_events_event_type_idx ON game_events(event_type)');
  }

  // Games table migrations
  addColumnIfMissing('games', 'slug', 'TEXT');

  // Add index for slug if column exists
  if (columnExists('games', 'slug')) {
    sqlite.run('CREATE INDEX IF NOT EXISTS games_slug_idx ON games(slug)');
  }

  // Create api_cache table if missing (server-side caching for discover data)
  if (!tableExists('api_cache')) {
    logger.info('Migration: Creating api_cache table');
    sqlite.run(`
      CREATE TABLE api_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT NOT NULL UNIQUE,
        cache_type TEXT NOT NULL,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    sqlite.run('CREATE INDEX IF NOT EXISTS api_cache_key_idx ON api_cache(cache_key)');
    sqlite.run('CREATE INDEX IF NOT EXISTS api_cache_expires_at_idx ON api_cache(expires_at)');
  }

  // Create game_folders table if missing (multiple folders per game support)
  if (!tableExists('game_folders')) {
    logger.info('Migration: Creating game_folders table');
    sqlite.run(`
      CREATE TABLE game_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        folder_path TEXT NOT NULL,
        version TEXT,
        quality TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        added_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    sqlite.run('CREATE INDEX IF NOT EXISTS game_folders_game_id_idx ON game_folders(game_id)');
    sqlite.run('CREATE UNIQUE INDEX IF NOT EXISTS game_folders_folder_path_unique ON game_folders(folder_path)');

    // Migrate existing games with folder_path to game_folders table
    logger.info('Migration: Migrating existing game folders to game_folders table');
    const gamesWithFolders = sqlite.query(`
      SELECT id, folder_path, installed_version, installed_quality
      FROM games
      WHERE folder_path IS NOT NULL AND folder_path != ''
    `).all() as Array<{ id: number; folder_path: string; installed_version: string | null; installed_quality: string | null }>;

    for (const game of gamesWithFolders) {
      // Check if folder entry already exists (shouldn't, but be safe)
      const exists = sqlite.query(
        'SELECT id FROM game_folders WHERE folder_path = ?'
      ).get(game.folder_path);

      if (!exists) {
        sqlite.run(
          'INSERT INTO game_folders (game_id, folder_path, version, quality, is_primary) VALUES (?, ?, ?, ?, 1)',
          [game.id, game.folder_path, game.installed_version, game.installed_quality]
        );
      }
    }
    logger.info(`Migration: Migrated ${gamesWithFolders.length} game folder(s)`);
  }
}

runMigrations();

// Seed default stores
function seedDefaultStores() {
  const defaultStores = [
    { name: 'Steam', slug: 'steam' },
    { name: 'GOG', slug: 'gog' },
    { name: 'Epic Games', slug: 'epic' },
    { name: 'Origin', slug: 'origin' },
    { name: 'Ubisoft Connect', slug: 'ubisoft' },
    { name: 'Xbox', slug: 'xbox' },
    { name: 'PlayStation', slug: 'playstation' },
    { name: 'Nintendo', slug: 'nintendo' },
    { name: 'itch.io', slug: 'itch' },
    { name: 'Humble Bundle', slug: 'humble' },
    { name: 'Amazon Games', slug: 'amazon' },
    { name: 'Battle.net', slug: 'battlenet' },
  ];

  for (const store of defaultStores) {
    const exists = sqlite.query(
      'SELECT id FROM stores WHERE slug = ?'
    ).get(store.slug);

    if (!exists) {
      logger.info(`Seeding store: ${store.name} (${store.slug})`);
      sqlite.run(
        'INSERT INTO stores (name, slug) VALUES (?, ?)',
        [store.name, store.slug]
      );
    }
  }
}

seedDefaultStores();

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export database instance for raw queries if needed
export { sqlite };
