import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// Initialize SQLite database
const sqlite = new Database('./data/gamearr.db');

// Enable foreign keys
sqlite.run('PRAGMA foreign_keys = ON');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export database instance for raw queries if needed
export { sqlite };
