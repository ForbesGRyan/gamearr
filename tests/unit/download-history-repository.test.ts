import { describe, expect, test, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../../src/server/db/schema';
import { DownloadHistoryRepository } from '../../src/server/repositories/DownloadHistoryRepository';

// Build an isolated in-memory DB with just the download_history table.
// FK enforcement is left off so we don't need to seed games/releases parents.
function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.run(`
    CREATE TABLE download_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      release_id INTEGER NOT NULL,
      download_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER
    )
  `);
  return drizzle(sqlite, { schema });
}

describe('DownloadHistoryRepository.upsertForRelease', () => {
  let repo: DownloadHistoryRepository;

  beforeEach(() => {
    repo = new DownloadHistoryRepository(createTestDb());
  });

  test('creates a history row keyed by release on first call', async () => {
    const entry = await repo.upsertForRelease({
      gameId: 7,
      releaseId: 42,
      status: 'downloading',
    });

    expect(entry.gameId).toBe(7);
    expect(entry.releaseId).toBe(42);
    expect(entry.downloadId).toBe('release-42');
    expect(entry.status).toBe('downloading');
    expect(entry.progress).toBe(0);
    expect(entry.completedAt).toBeNull();
  });

  test('updates the same row on subsequent calls instead of inserting a duplicate', async () => {
    await repo.upsertForRelease({ gameId: 7, releaseId: 42, status: 'downloading' });

    const completedAt = new Date(1_700_000_000_000);
    const updated = await repo.upsertForRelease({
      gameId: 7,
      releaseId: 42,
      status: 'completed',
      progress: 100,
      completedAt,
    });

    expect(updated.status).toBe('completed');
    expect(updated.progress).toBe(100);
    expect(updated.completedAt?.getTime()).toBe(completedAt.getTime());

    // Only one row should exist for this release
    const all = await repo.findByReleaseId(42);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(updated.id);
  });

  test('keeps existing progress when an update omits it', async () => {
    await repo.upsertForRelease({ gameId: 1, releaseId: 5, status: 'downloading', progress: 35 });

    const updated = await repo.upsertForRelease({ gameId: 1, releaseId: 5, status: 'failed' });

    expect(updated.status).toBe('failed');
    expect(updated.progress).toBe(35);
  });
});
