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

    // Create games table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igdb_id INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
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

    // Create indexes
    sqlite.run('CREATE INDEX IF NOT EXISTS games_status_idx ON games(status)');
    sqlite.run('CREATE INDEX IF NOT EXISTS games_monitored_idx ON games(monitored)');
    sqlite.run('CREATE INDEX IF NOT EXISTS games_library_id_idx ON games(library_id)');
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

    logger.info('Schema initialized successfully');
  }
}

// Run schema initialization
initializeSchema();

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export database instance for raw queries if needed
export { sqlite };
