import { db } from '../src/server/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Creating stores table...');
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  console.log('Creating game_stores table...');
  await db.run(sql`
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

  console.log('Creating indexes...');
  await db.run(sql`CREATE INDEX IF NOT EXISTS game_stores_game_id_idx ON game_stores(game_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS game_stores_store_id_idx ON game_stores(store_id)`);

  console.log('Migration complete!');
  
  // Verify tables
  const tables = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  console.log('Tables:', tables.map((t: any) => t.name).join(', '));
}

migrate().catch(console.error);
