import { describe, it, expect } from 'bun:test';
import { createTestDb } from './testHelpers';

describe('tasks schema', () => {
  it('creates a row with defaults', () => {
    const { sqlite } = createTestDb();
    sqlite.run("INSERT INTO tasks (kind) VALUES ('test.kind')");
    const row = sqlite.query('SELECT * FROM tasks WHERE id = 1').get() as Record<string, unknown>;
    expect(row.kind).toBe('test.kind');
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(0);
    expect(row.max_attempts).toBe(5);
    expect(row.payload).toBe('{}');
    expect(typeof row.run_at).toBe('number');
  });

  it('enforces dedup unique index for active rows only', () => {
    const { sqlite } = createTestDb();
    sqlite.run("INSERT INTO tasks (kind, dedup_key) VALUES ('search.game', 'game-123')");
    expect(() =>
      sqlite.run("INSERT INTO tasks (kind, dedup_key) VALUES ('search.game', 'game-123')")
    ).toThrow();
    // After first row reaches terminal state, a second active row is allowed
    sqlite.run("UPDATE tasks SET status = 'done' WHERE id = 1");
    sqlite.run("INSERT INTO tasks (kind, dedup_key) VALUES ('search.game', 'game-123')");
    const count = (sqlite.query('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }).c;
    expect(count).toBe(2);
  });
});
