/**
 * Migration script to add HLTB and ProtonDB columns to games table
 * Run with: bun run scripts/migrate-hltb-protondb.ts
 */

import { Database } from 'bun:sqlite';
import path from 'path';

const dataPath = process.env.DATA_PATH || './data';
const dbPath = path.join(dataPath, 'gamearr.db');

console.log(`Opening database at: ${dbPath}`);
const db = new Database(dbPath);

// Check if columns exist by querying table info
const tableInfo = db.query("PRAGMA table_info(games)").all() as { name: string }[];
const existingColumns = new Set(tableInfo.map(col => col.name));

const columnsToAdd = [
  { name: 'hltb_id', type: 'TEXT' },
  { name: 'hltb_main', type: 'INTEGER' },
  { name: 'hltb_main_extra', type: 'INTEGER' },
  { name: 'hltb_completionist', type: 'INTEGER' },
  { name: 'hltb_last_sync', type: 'INTEGER' },
  { name: 'protondb_tier', type: 'TEXT' },
  { name: 'protondb_score', type: 'INTEGER' },
  { name: 'protondb_last_sync', type: 'INTEGER' },
];

let addedCount = 0;
for (const col of columnsToAdd) {
  if (!existingColumns.has(col.name)) {
    console.log(`Adding column: ${col.name} (${col.type})`);
    db.run(`ALTER TABLE games ADD COLUMN ${col.name} ${col.type}`);
    addedCount++;
  } else {
    console.log(`Column already exists: ${col.name}`);
  }
}

console.log(`\nMigration complete. Added ${addedCount} new columns.`);
db.close();
