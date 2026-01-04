import { Database } from 'bun:sqlite';
import { logger } from '../../utils/logger';

const dbPath = './data/gamearr.db';

logger.info('Running migration: add-store-column');

const db = new Database(dbPath);

try {
  // Check if store column already exists
  const columns = db.query("PRAGMA table_info(games)").all() as Array<{ name: string }>;
  const hasStoreColumn = columns.some((col) => col.name === 'store');

  if (hasStoreColumn) {
    logger.info('Store column already exists, skipping migration');
  } else {
    logger.info('Adding store column to games table...');
    db.run('ALTER TABLE games ADD COLUMN store TEXT');
    logger.info('✅ Store column added successfully!');
  }
} catch (error) {
  logger.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
