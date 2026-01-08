import { Database } from 'bun:sqlite';
import { logger } from '../../utils/logger';

const dbPath = './data/gamearr.db';

logger.info('Running libraries migration...');

const db = new Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create libraries table
db.run(`
  CREATE TABLE IF NOT EXISTS libraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    platform TEXT,
    monitored INTEGER NOT NULL DEFAULT 1,
    download_enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

// Add library_id column to games table if it doesn't exist
const gamesColumns = db.query("PRAGMA table_info(games)").all() as { name: string }[];
const hasLibraryId = gamesColumns.some(col => col.name === 'library_id');
if (!hasLibraryId) {
  db.run('ALTER TABLE games ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL');
  logger.info('Added library_id column to games table');
}

// Add library_id column to library_files table if it doesn't exist
const libraryFilesColumns = db.query("PRAGMA table_info(library_files)").all() as { name: string }[];
const libraryFilesHasLibraryId = libraryFilesColumns.some(col => col.name === 'library_id');
if (!libraryFilesHasLibraryId) {
  db.run('ALTER TABLE library_files ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE');
  logger.info('Added library_id column to library_files table');
}

// Create indexes if they don't exist
const indexes = db.query("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];

if (!indexes.some(idx => idx.name === 'games_library_id_idx')) {
  db.run('CREATE INDEX games_library_id_idx ON games(library_id)');
  logger.info('Created games_library_id_idx index');
}

if (!indexes.some(idx => idx.name === 'library_files_library_id_idx')) {
  db.run('CREATE INDEX library_files_library_id_idx ON library_files(library_id)');
  logger.info('Created library_files_library_id_idx index');
}

logger.info('✅ Libraries migration complete!');

// List all tables
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
logger.info('Tables in database:', tables);

db.close();
