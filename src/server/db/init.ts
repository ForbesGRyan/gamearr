import { Database } from 'bun:sqlite';
import { logger } from '../utils/logger';

const dbPath = './data/gamearr.db';

logger.info(`Initializing database at ${dbPath}...`);

const db = new Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create games table
db.run(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    igdb_id INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    year INTEGER,
    platform TEXT NOT NULL,
    store TEXT,
    monitored INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'wanted',
    cover_url TEXT,
    folder_path TEXT,
    added_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

// Create releases table
db.run(`
  CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    size INTEGER,
    seeders INTEGER,
    download_url TEXT NOT NULL,
    indexer TEXT NOT NULL,
    quality TEXT,
    grabbed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'pending'
  )
`);

// Create download_history table
db.run(`
  CREATE TABLE IF NOT EXISTS download_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    download_id TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER
  )
`);

// Create settings table
db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  )
`);

// Create library_files table
db.run(`
  CREATE TABLE IF NOT EXISTS library_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_path TEXT NOT NULL UNIQUE,
    parsed_title TEXT,
    parsed_year INTEGER,
    matched_game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
    ignored INTEGER NOT NULL DEFAULT 0,
    scanned_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

logger.info('✅ Database tables created successfully!');

// List all tables
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
logger.info('Tables in database:', tables);

db.close();
