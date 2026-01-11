import { db } from '../src/server/db';
import { games, stores, gameStores } from '../src/server/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

// Known stores to seed
const KNOWN_STORES = [
  { name: 'Steam', slug: 'steam' },
  { name: 'GOG', slug: 'gog' },
];

async function seedStores(): Promise<Map<string, number>> {
  console.log('Seeding stores table...');
  const storeIdMap = new Map<string, number>();

  for (const store of KNOWN_STORES) {
    // Check if store already exists
    const existing = await db
      .select()
      .from(stores)
      .where(eq(stores.slug, store.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Store "${store.name}" already exists (id: ${existing[0].id})`);
      storeIdMap.set(store.name.toLowerCase(), existing[0].id);
    } else {
      const result = await db.insert(stores).values({
        name: store.name,
        slug: store.slug,
      }).returning({ id: stores.id });

      console.log(`  Created store "${store.name}" (id: ${result[0].id})`);
      storeIdMap.set(store.name.toLowerCase(), result[0].id);
    }
  }

  console.log(`Seeded ${storeIdMap.size} stores\n`);
  return storeIdMap;
}

async function migrateGameStores(storeIdMap: Map<string, number>): Promise<void> {
  console.log('Migrating game store data...');

  // Get all games with non-null store field
  const gamesWithStores = await db
    .select()
    .from(games)
    .where(isNotNull(games.store));

  console.log(`Found ${gamesWithStores.length} games with store data to migrate\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const game of gamesWithStores) {
    if (!game.store) continue;

    // Parse comma-separated store field
    const storeNames = game.store.split(',').map(s => s.trim());

    for (const storeName of storeNames) {
      const storeNameLower = storeName.toLowerCase();
      const storeId = storeIdMap.get(storeNameLower);

      if (!storeId) {
        console.log(`  Warning: Unknown store "${storeName}" for game "${game.title}" (id: ${game.id})`);
        continue;
      }

      // Check if gameStores record already exists (idempotency)
      const existing = await db
        .select()
        .from(gameStores)
        .where(
          and(
            eq(gameStores.gameId, game.id),
            eq(gameStores.storeId, storeId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`  Skipping: "${game.title}" already linked to ${storeName}`);
        skippedCount++;
        continue;
      }

      // Determine storeName value for the gameStores record
      // If this is Steam and the game has steamName, use it
      let gameStoreName: string | null = null;
      if (storeNameLower === 'steam' && game.steamName) {
        gameStoreName = game.steamName;
      }

      // Create the gameStores record
      await db.insert(gameStores).values({
        gameId: game.id,
        storeId: storeId,
        storeName: gameStoreName,
      });

      if (gameStoreName) {
        console.log(`  Migrated: "${game.title}" -> ${storeName} (storeName: "${gameStoreName}")`);
      } else {
        console.log(`  Migrated: "${game.title}" -> ${storeName}`);
      }
      migratedCount++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`  Migrated: ${migratedCount} game-store relationships`);
  console.log(`  Skipped: ${skippedCount} (already existed)`);
}

async function main() {
  console.log('=== Store Data Migration ===\n');

  try {
    // Step 1: Seed stores table
    const storeIdMap = await seedStores();

    // Step 2: Migrate existing game data
    await migrateGameStores(storeIdMap);

    console.log('\n=== Migration Complete ===');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
