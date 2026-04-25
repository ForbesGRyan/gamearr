import { describe, it, expect } from 'bun:test';
import { archiveTerminalTasks } from '../TaskArchiver';
import { createTestDb, nowSec } from './testHelpers';

describe('archiveTerminalTasks', () => {
  it('moves done/dead rows older than threshold into tasks_archive', () => {
    const { sqlite } = createTestDb();
    const old = nowSec() - 60 * 60 * 24 * 10; // 10 days ago
    const recent = nowSec() - 60;

    sqlite.run(
      `INSERT INTO tasks (kind, status, attempts, updated_at, created_at, max_attempts)
       VALUES ('a', 'done', 1, ?, ?, 5)`,
      [old, old]
    );
    sqlite.run(
      `INSERT INTO tasks (kind, status, attempts, updated_at, created_at, max_attempts)
       VALUES ('b', 'dead', 5, ?, ?, 5)`,
      [old, old]
    );
    sqlite.run(
      `INSERT INTO tasks (kind, status, attempts, updated_at, created_at, max_attempts)
       VALUES ('c', 'done', 1, ?, ?, 5)`,
      [recent, recent]
    );
    sqlite.run(
      `INSERT INTO tasks (kind, status, attempts, updated_at, created_at, max_attempts)
       VALUES ('d', 'pending', 0, ?, ?, 5)`,
      [old, old]
    );

    const moved = archiveTerminalTasks(sqlite, { olderThanSec: 60 * 60 * 24 * 7 });
    expect(moved).toBe(2);

    const remaining = sqlite.query('SELECT kind FROM tasks ORDER BY kind').all() as { kind: string }[];
    expect(remaining.map((r) => r.kind)).toEqual(['c', 'd']);

    const archived = sqlite.query('SELECT kind FROM tasks_archive ORDER BY kind').all() as { kind: string }[];
    expect(archived.map((r) => r.kind)).toEqual(['a', 'b']);
  });
});
