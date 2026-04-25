import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../../db/schema';

/**
 * Build a fresh in-memory SQLite DB with the tasks schema applied.
 * Each test should call this to get an isolated DB.
 */
export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.run('PRAGMA foreign_keys = ON');

  sqlite.run(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 0,
      run_at INTEGER NOT NULL DEFAULT (unixepoch()),
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      last_error TEXT,
      locked_by TEXT,
      locked_until INTEGER,
      dedup_key TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  sqlite.run('CREATE INDEX tasks_ready_idx ON tasks(status, run_at, priority)');
  sqlite.run('CREATE INDEX tasks_kind_status_idx ON tasks(kind, status)');
  sqlite.run(`CREATE UNIQUE INDEX tasks_dedup_active_uidx
              ON tasks(kind, dedup_key)
              WHERE dedup_key IS NOT NULL AND status IN ('pending','running')`);

  sqlite.run(`
    CREATE TABLE tasks_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      last_error TEXT,
      dedup_key TEXT,
      created_at INTEGER NOT NULL,
      finished_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  sqlite.run('CREATE INDEX tasks_archive_finished_at_idx ON tasks_archive(finished_at)');

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}
