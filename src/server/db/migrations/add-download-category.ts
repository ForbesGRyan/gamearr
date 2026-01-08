import { Database } from 'bun:sqlite';
import { logger } from '../../utils/logger';

const dbPath = './data/gamearr.db';

logger.info('Running migration: add-download-category');

const db = new Database(dbPath);

try {
  // Check if column already exists
  const tableInfo = db.query("PRAGMA table_info(libraries)").all() as { name: string }[];
  const hasColumn = tableInfo.some(col => col.name === 'download_category');

  if (hasColumn) {
    logger.info('download_category column already exists, skipping migration');
  } else {
    // Add download_category column with default value
    db.run("ALTER TABLE libraries ADD COLUMN download_category TEXT DEFAULT 'gamearr'");
    logger.info('✅ Added download_category column to libraries table');
  }
} catch (error) {
  logger.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}

logger.info('✅ Migration complete!');
