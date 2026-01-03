import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const sqlite = new Database('./data/gamearr.db');
const db = drizzle(sqlite);

console.log('Running migrations...');

migrate(db, { migrationsFolder: './src/server/db/migrations' });

console.log('Migrations complete!');

sqlite.close();
