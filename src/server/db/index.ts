import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as schema from './schema';

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

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export database instance for raw queries if needed
export { sqlite };
