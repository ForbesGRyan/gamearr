import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { logger } from '../utils/logger';

const sqlite = new Database('./data/gamearr.db');
const db = drizzle(sqlite);

logger.info('Running migrations...');

migrate(db, { migrationsFolder: './src/server/db/migrations' });

logger.info('Migrations complete!');

sqlite.close();
