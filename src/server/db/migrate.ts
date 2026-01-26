import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Simple logger for migrations (avoids complex dependencies)
const log = {
  info: (msg: string) => console.log(`[${new Date().toISOString()}] INFO  ${msg}`),
  error: (msg: string) => console.error(`[${new Date().toISOString()}] ERROR ${msg}`),
};

// Get data path from environment or use default
const dataPath = process.env.DATA_PATH || './data';
const dbPath = join(dataPath, 'gamearr.db');

// Ensure data directory exists
if (!existsSync(dataPath)) {
  mkdirSync(dataPath, { recursive: true });
}

// Determine migrations folder path
// In Docker, migrations are at /app/migrations
// In development, they're at ./src/server/db/migrations
const migrationsFolder = existsSync('/app/migrations')
  ? '/app/migrations'
  : './src/server/db/migrations';

log.info(`Database path: ${dbPath}`);

try {
  const sqlite = new Database(dbPath);

  // Check if database already has tables (created by code-based migrations)
  // If so, skip Drizzle file migrations - the app's db/index.ts handles schema updates
  const existingTables = sqlite.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'"
  ).all() as Array<{ name: string }>;

  if (existingTables.length > 0) {
    log.info(`Database already initialized with ${existingTables.length} tables - skipping Drizzle migrations`);
    log.info('Schema updates will be handled by application startup');
    sqlite.close();
    process.exit(0);
  }

  // Fresh database - run Drizzle migrations
  log.info(`Running Drizzle migrations from ${migrationsFolder}...`);
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });

  log.info('Migrations complete!');

  sqlite.close();
} catch (error) {
  log.error(`Migration failed: ${error}`);
  process.exit(1);
}
