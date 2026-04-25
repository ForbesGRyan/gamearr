# SQLite Task Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent, in-process task queue backed by SQLite (Drizzle) with same-process EventEmitter wake-up for sub-second latency on user-triggered work. Migrate `MetadataRefreshJob` end-to-end as the reference implementation.

**Architecture:** New `tasks` table holds queued work. A singleton `TaskQueue` exposes `enqueue()` and emits a wake event. A `TaskWorker` claims rows atomically (`UPDATE ... RETURNING`), invokes a registered handler, and writes terminal state with exponential backoff on failure. Cron-style polling jobs continue to exist but their handlers shrink to enqueue calls. Per-kind concurrency caps protect external APIs (IGDB, Prowlarr).

**Tech Stack:** Bun 1.x, Drizzle ORM (bun-sqlite), Hono, TypeScript. Tests via `bun test`. SQLite is in WAL mode (handled separately).

**Beads issue:** `gamearr-5tn`

---

## Conventions

- **Working dir:** `C:\Users\Ryan\code\gamearr` (paths below are relative to this).
- **DB access:** `import { db, sqlite } from '../db'` — `db` is Drizzle, `sqlite` is the raw `bun:sqlite` `Database`.
- **Logging:** `import { logger } from '../utils/logger'`. Levels: `info`, `warn`, `error`, `debug`.
- **Singletons:** export instance at bottom of file (`export const taskQueue = new TaskQueue()`).
- **Time:** All timestamps are unix-epoch seconds (`Math.floor(Date.now() / 1000)` or SQL `unixepoch()`). Match existing `mode: 'timestamp'` columns.
- **Schema duplication:** This codebase defines schema in **both** `src/server/db/schema.ts` (Drizzle) **and** raw SQL in `src/server/db/index.ts` (`initializeSchema` + `runMigrations`). New tables go in **all three places** — Drizzle table, `initializeSchema` block (for fresh DBs), and `runMigrations` block (for existing DBs).
- **Tests:** Bun test (`bun test`). Test files live next to source: `src/server/queue/__tests__/<name>.test.ts`. Use an in-memory SQLite (`new Database(':memory:')`) in tests to avoid touching `./data/gamearr.db`.
- **Commits:** After each task's tests pass, run `bd update gamearr-5tn --notes` (append progress) and `git add` + `git commit`. Issue tracking via `bd`, NOT TodoWrite.

---

## File Structure

**New files:**
- `src/server/queue/types.ts` — types and constants for tasks (status, kind, options, handler signature)
- `src/server/queue/TaskRepository.ts` — DB access layer for the `tasks` table
- `src/server/queue/TaskQueue.ts` — singleton: `enqueue()`, EventEmitter wake bus
- `src/server/queue/registry.ts` — handler registration and per-kind concurrency tracking
- `src/server/queue/TaskWorker.ts` — start/stop loop, claim → execute → finalize
- `src/server/queue/TaskArchiver.ts` — daily sweep moving terminal rows to archive
- `src/server/queue/handlers/index.ts` — registers all handlers at boot
- `src/server/queue/handlers/metadataRefresh.ts` — first reference handler
- `src/server/routes/tasks.ts` — `GET /api/v1/tasks`, retry, delete
- `src/server/queue/__tests__/TaskRepository.test.ts`
- `src/server/queue/__tests__/TaskQueue.test.ts`
- `src/server/queue/__tests__/TaskWorker.test.ts`
- `src/server/queue/__tests__/registry.test.ts`
- `src/server/queue/__tests__/testHelpers.ts` — shared in-memory DB setup

**Modified files:**
- `src/server/db/schema.ts` — add `tasks`, `tasksArchive` tables
- `src/server/db/index.ts` — add CREATE TABLE in `initializeSchema`, migration in `runMigrations`
- `src/server/jobs/MetadataRefreshJob.ts` — refactor to enqueue tasks instead of doing the work inline
- `src/server/index.ts` — register handlers, start worker, register `/api/v1/tasks` route, wire graceful shutdown

---

## Task 1: Schema — `tasks` and `tasks_archive` tables

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Create: `src/server/queue/__tests__/testHelpers.ts`
- Create: `src/server/queue/__tests__/TaskRepository.test.ts`

- [ ] **Step 1: Add Drizzle table definitions to `src/server/db/schema.ts`**

Append to the bottom of the file (after the last table, before any export aggregation if present):

```typescript
// Tasks table — persistent in-process job queue
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(),
  payload: text('payload').notNull().default('{}'), // JSON
  status: text('status').notNull().default('pending'), // pending | running | done | failed | dead
  priority: integer('priority').notNull().default(0), // higher runs first
  runAt: integer('run_at').notNull().default(sql`(unixepoch())`),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  lastError: text('last_error'),
  lockedBy: text('locked_by'),
  lockedUntil: integer('locked_until'),
  dedupKey: text('dedup_key'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  readyIdx: index('tasks_ready_idx').on(table.status, table.runAt, table.priority),
  kindStatusIdx: index('tasks_kind_status_idx').on(table.kind, table.status),
}));

// Archive of terminal tasks
export const tasksArchive = sqliteTable('tasks_archive', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  originalId: integer('original_id').notNull(),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),
  status: text('status').notNull(),
  attempts: integer('attempts').notNull(),
  lastError: text('last_error'),
  dedupKey: text('dedup_key'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  finishedAtIdx: index('tasks_archive_finished_at_idx').on(table.finishedAt),
}));

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

- [ ] **Step 2: Add raw-SQL schema to `src/server/db/index.ts` `initializeSchema`**

Inside the `initializeSchema()` function, after the `sessions` table block and **before** the `// Create indexes` block, append:

```typescript
    // Create tasks table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS tasks (
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

    // Create tasks_archive table
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS tasks_archive (
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
```

Then, in the `// Create indexes` block at the bottom of `initializeSchema()`, append:

```typescript
    sqlite.run('CREATE INDEX IF NOT EXISTS tasks_ready_idx ON tasks(status, run_at, priority)');
    sqlite.run('CREATE INDEX IF NOT EXISTS tasks_kind_status_idx ON tasks(kind, status)');
    sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS tasks_dedup_active_uidx
                ON tasks(kind, dedup_key)
                WHERE dedup_key IS NOT NULL AND status IN ('pending','running')`);
    sqlite.run('CREATE INDEX IF NOT EXISTS tasks_archive_finished_at_idx ON tasks_archive(finished_at)');
```

- [ ] **Step 3: Add migration block to `runMigrations()` in `src/server/db/index.ts`**

Inside `runMigrations()`, append a new block after the last existing migration (after the `sessions` table migration) but before the closing `}`:

```typescript
  // Create tasks table if missing (in-process job queue)
  if (!tableExists('tasks')) {
    logger.info('Migration: Creating tasks table');
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
    sqlite.run('CREATE INDEX IF NOT EXISTS tasks_ready_idx ON tasks(status, run_at, priority)');
    sqlite.run('CREATE INDEX IF NOT EXISTS tasks_kind_status_idx ON tasks(kind, status)');
    sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS tasks_dedup_active_uidx
                ON tasks(kind, dedup_key)
                WHERE dedup_key IS NOT NULL AND status IN ('pending','running')`);
  }

  if (!tableExists('tasks_archive')) {
    logger.info('Migration: Creating tasks_archive table');
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
    sqlite.run('CREATE INDEX IF NOT EXISTS tasks_archive_finished_at_idx ON tasks_archive(finished_at)');
  }
```

- [ ] **Step 4: Create test helper for in-memory DB**

Create `src/server/queue/__tests__/testHelpers.ts`:

```typescript
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
```

- [ ] **Step 5: Write the schema smoke test**

Create `src/server/queue/__tests__/TaskRepository.test.ts` with just the schema check for now:

```typescript
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
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `bun test src/server/queue/__tests__/TaskRepository.test.ts`
Expected: 2 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add src/server/db/schema.ts src/server/db/index.ts src/server/queue/__tests__/
git commit -m "feat(queue): add tasks + tasks_archive schema (gamearr-5tn)"
```

---

## Task 2: TaskRepository — DB access layer

**Files:**
- Create: `src/server/queue/types.ts`
- Create: `src/server/queue/TaskRepository.ts`
- Modify: `src/server/queue/__tests__/TaskRepository.test.ts`

- [ ] **Step 1: Create `src/server/queue/types.ts`**

```typescript
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'dead';

export interface TaskRow {
  id: number;
  kind: string;
  payload: string; // JSON
  status: TaskStatus;
  priority: number;
  runAt: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedBy: string | null;
  lockedUntil: number | null;
  dedupKey: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EnqueueOptions {
  priority?: number;
  runAt?: number; // unix seconds; default: now
  maxAttempts?: number;
  dedupKey?: string;
}

export interface TaskHandlerContext {
  task: TaskRow;
  payload: unknown;
  signal: AbortSignal;
}

export type TaskHandler = (ctx: TaskHandlerContext) => Promise<void>;

export interface HandlerRegistration {
  kind: string;
  handler: TaskHandler;
  /** Per-kind max in-flight executions. Default 1. */
  concurrency?: number;
  /** Visibility timeout in seconds. Default 300 (5 min). */
  timeoutSec?: number;
}

export const DEFAULT_TIMEOUT_SEC = 300;
export const DEFAULT_CONCURRENCY = 1;
export const DEFAULT_MAX_ATTEMPTS = 5;
```

- [ ] **Step 2: Create `src/server/queue/TaskRepository.ts`**

```typescript
import type { Database } from 'bun:sqlite';
import type { TaskRow, EnqueueOptions, TaskStatus } from './types';
import { DEFAULT_MAX_ATTEMPTS } from './types';

function rowToTask(row: Record<string, unknown>): TaskRow {
  return {
    id: row.id as number,
    kind: row.kind as string,
    payload: row.payload as string,
    status: row.status as TaskStatus,
    priority: row.priority as number,
    runAt: row.run_at as number,
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    lastError: (row.last_error as string | null) ?? null,
    lockedBy: (row.locked_by as string | null) ?? null,
    lockedUntil: (row.locked_until as number | null) ?? null,
    dedupKey: (row.dedup_key as string | null) ?? null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export class TaskRepository {
  constructor(private sqlite: Database) {}

  /**
   * Insert a pending task. Returns the inserted row.
   * If a dedup_key collision occurs on an active row, returns the existing row.
   */
  enqueue(kind: string, payload: unknown, opts: EnqueueOptions = {}): TaskRow {
    const now = Math.floor(Date.now() / 1000);
    const payloadJson = JSON.stringify(payload ?? {});
    const runAt = opts.runAt ?? now;
    const priority = opts.priority ?? 0;
    const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const dedupKey = opts.dedupKey ?? null;

    if (dedupKey) {
      const existing = this.sqlite
        .query(
          `SELECT * FROM tasks
           WHERE kind = ? AND dedup_key = ? AND status IN ('pending','running')
           LIMIT 1`
        )
        .get(kind, dedupKey) as Record<string, unknown> | undefined;
      if (existing) return rowToTask(existing);
    }

    const inserted = this.sqlite
      .query(
        `INSERT INTO tasks
           (kind, payload, status, priority, run_at, attempts, max_attempts, dedup_key, created_at, updated_at)
         VALUES (?, ?, 'pending', ?, ?, 0, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(kind, payloadJson, priority, runAt, maxAttempts, dedupKey, now, now) as Record<string, unknown>;
    return rowToTask(inserted);
  }

  /**
   * Atomically claim up to `limit` due pending tasks.
   * Sets status='running', locked_by, locked_until.
   * Returns the claimed rows.
   */
  claimDue(workerId: string, timeoutSec: number, limit: number, kinds?: string[]): TaskRow[] {
    const now = Math.floor(Date.now() / 1000);
    const lockedUntil = now + timeoutSec;

    const kindFilter = kinds && kinds.length > 0
      ? `AND kind IN (${kinds.map(() => '?').join(',')})`
      : '';
    const params: unknown[] = [now];
    if (kinds && kinds.length > 0) params.push(...kinds);
    params.push(limit);

    const due = this.sqlite
      .query(
        `SELECT id FROM tasks
         WHERE status = 'pending' AND run_at <= ? ${kindFilter}
         ORDER BY priority DESC, run_at ASC, id ASC
         LIMIT ?`
      )
      .all(...params) as Array<{ id: number }>;

    const claimed: TaskRow[] = [];
    for (const { id } of due) {
      const row = this.sqlite
        .query(
          `UPDATE tasks
           SET status = 'running',
               locked_by = ?,
               locked_until = ?,
               attempts = attempts + 1,
               updated_at = ?
           WHERE id = ? AND status = 'pending'
           RETURNING *`
        )
        .get(workerId, lockedUntil, now, id) as Record<string, unknown> | undefined;
      if (row) claimed.push(rowToTask(row));
    }
    return claimed;
  }

  markDone(id: number): void {
    const now = Math.floor(Date.now() / 1000);
    this.sqlite.run(
      `UPDATE tasks SET status = 'done', last_error = NULL, locked_by = NULL,
       locked_until = NULL, updated_at = ? WHERE id = ?`,
      [now, id]
    );
  }

  /**
   * Mark task failed. If attempts < maxAttempts, status returns to 'pending' with a
   * future run_at (caller computes backoff). Otherwise status becomes 'dead'.
   */
  markFailed(id: number, errorMessage: string, nextRunAt: number | null): void {
    const now = Math.floor(Date.now() / 1000);
    if (nextRunAt === null) {
      this.sqlite.run(
        `UPDATE tasks SET status = 'dead', last_error = ?, locked_by = NULL,
         locked_until = NULL, updated_at = ? WHERE id = ?`,
        [errorMessage, now, id]
      );
    } else {
      this.sqlite.run(
        `UPDATE tasks SET status = 'pending', last_error = ?, run_at = ?,
         locked_by = NULL, locked_until = NULL, updated_at = ? WHERE id = ?`,
        [errorMessage, nextRunAt, now, id]
      );
    }
  }

  /**
   * Reset any rows where status='running' but locked_until has expired.
   * Used on startup and periodically by the worker.
   * Returns the number of rows reset.
   */
  recoverExpired(): number {
    const now = Math.floor(Date.now() / 1000);
    const result = this.sqlite.run(
      `UPDATE tasks SET status = 'pending', locked_by = NULL,
       locked_until = NULL, updated_at = ?
       WHERE status = 'running' AND locked_until IS NOT NULL AND locked_until < ?`,
      [now, now]
    );
    return result.changes;
  }

  findById(id: number): TaskRow | null {
    const row = this.sqlite.query('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToTask(row) : null;
  }

  list(opts: { status?: TaskStatus; kind?: string; limit?: number; offset?: number }): TaskRow[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts.status) {
      clauses.push('status = ?');
      params.push(opts.status);
    }
    if (opts.kind) {
      clauses.push('kind = ?');
      params.push(opts.kind);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(opts.limit ?? 100);
    params.push(opts.offset ?? 0);
    const rows = this.sqlite
      .query(`SELECT * FROM tasks ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params) as Record<string, unknown>[];
    return rows.map(rowToTask);
  }

  /** Force a dead/failed task back to pending for retry. */
  requeue(id: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const result = this.sqlite.run(
      `UPDATE tasks SET status = 'pending', attempts = 0, last_error = NULL,
       locked_by = NULL, locked_until = NULL, run_at = ?, updated_at = ?
       WHERE id = ? AND status IN ('failed','dead')`,
      [now, now, id]
    );
    return result.changes > 0;
  }

  delete(id: number): boolean {
    const result = this.sqlite.run('DELETE FROM tasks WHERE id = ?', [id]);
    return result.changes > 0;
  }
}
```

- [ ] **Step 2.5: Note about repository singleton**

Routes consuming this should use a singleton bound to the production `sqlite`. Add **at the bottom of `TaskRepository.ts`**:

```typescript
import { sqlite } from '../db';
export const taskRepository = new TaskRepository(sqlite);
```

- [ ] **Step 3: Replace test file with full repository tests**

Replace the contents of `src/server/queue/__tests__/TaskRepository.test.ts` with:

```typescript
import { describe, it, expect } from 'bun:test';
import { TaskRepository } from '../TaskRepository';
import { createTestDb, nowSec } from './testHelpers';

function makeRepo() {
  const { sqlite } = createTestDb();
  return { repo: new TaskRepository(sqlite), sqlite };
}

describe('TaskRepository.enqueue', () => {
  it('inserts a pending row with defaults', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('test.kind', { foo: 1 });
    expect(t.id).toBeGreaterThan(0);
    expect(t.kind).toBe('test.kind');
    expect(t.status).toBe('pending');
    expect(JSON.parse(t.payload)).toEqual({ foo: 1 });
    expect(t.attempts).toBe(0);
  });

  it('respects priority, runAt, maxAttempts, dedupKey options', () => {
    const { repo } = makeRepo();
    const future = nowSec() + 600;
    const t = repo.enqueue('k', {}, {
      priority: 5,
      runAt: future,
      maxAttempts: 2,
      dedupKey: 'abc',
    });
    expect(t.priority).toBe(5);
    expect(t.runAt).toBe(future);
    expect(t.maxAttempts).toBe(2);
    expect(t.dedupKey).toBe('abc');
  });

  it('returns the existing active row when dedup_key collides', () => {
    const { repo } = makeRepo();
    const a = repo.enqueue('k', { v: 1 }, { dedupKey: 'd1' });
    const b = repo.enqueue('k', { v: 2 }, { dedupKey: 'd1' });
    expect(b.id).toBe(a.id);
    expect(JSON.parse(b.payload)).toEqual({ v: 1 }); // payload from original is kept
  });

  it('allows new enqueue once previous dedup row is terminal', () => {
    const { repo } = makeRepo();
    const a = repo.enqueue('k', {}, { dedupKey: 'd1' });
    repo.markDone(a.id);
    const b = repo.enqueue('k', {}, { dedupKey: 'd1' });
    expect(b.id).not.toBe(a.id);
  });
});

describe('TaskRepository.claimDue', () => {
  it('claims pending tasks whose run_at <= now', () => {
    const { repo } = makeRepo();
    const past = repo.enqueue('a', {}, { runAt: nowSec() - 10 });
    repo.enqueue('b', {}, { runAt: nowSec() + 600 }); // future, should not be claimed
    const claimed = repo.claimDue('worker-1', 60, 10);
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(past.id);
    expect(claimed[0].status).toBe('running');
    expect(claimed[0].attempts).toBe(1);
    expect(claimed[0].lockedBy).toBe('worker-1');
  });

  it('orders by priority DESC, run_at ASC', () => {
    const { repo } = makeRepo();
    const low = repo.enqueue('a', {}, { priority: 0, runAt: nowSec() - 30 });
    const high = repo.enqueue('b', {}, { priority: 10, runAt: nowSec() - 10 });
    const claimed = repo.claimDue('w', 60, 10);
    expect(claimed.map((t) => t.id)).toEqual([high.id, low.id]);
  });

  it('respects limit', () => {
    const { repo } = makeRepo();
    repo.enqueue('a', {});
    repo.enqueue('a', {});
    repo.enqueue('a', {});
    const claimed = repo.claimDue('w', 60, 2);
    expect(claimed.length).toBe(2);
  });

  it('filters by kinds when provided', () => {
    const { repo } = makeRepo();
    const a = repo.enqueue('kind.a', {});
    repo.enqueue('kind.b', {});
    const claimed = repo.claimDue('w', 60, 10, ['kind.a']);
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(a.id);
  });

  it('does not claim already-running rows', () => {
    const { repo } = makeRepo();
    repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    const second = repo.claimDue('w', 60, 10);
    expect(second.length).toBe(0);
  });
});

describe('TaskRepository.markDone / markFailed', () => {
  it('markDone sets status=done and clears lock', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    repo.markDone(t.id);
    const reloaded = repo.findById(t.id)!;
    expect(reloaded.status).toBe('done');
    expect(reloaded.lockedBy).toBeNull();
    expect(reloaded.lockedUntil).toBeNull();
  });

  it('markFailed with nextRunAt re-queues to pending', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    const future = nowSec() + 30;
    repo.markFailed(t.id, 'boom', future);
    const reloaded = repo.findById(t.id)!;
    expect(reloaded.status).toBe('pending');
    expect(reloaded.lastError).toBe('boom');
    expect(reloaded.runAt).toBe(future);
  });

  it('markFailed with null nextRunAt sets status=dead', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    repo.markFailed(t.id, 'boom', null);
    const reloaded = repo.findById(t.id)!;
    expect(reloaded.status).toBe('dead');
    expect(reloaded.lastError).toBe('boom');
  });
});

describe('TaskRepository.recoverExpired', () => {
  it('resets running rows whose locked_until has passed', () => {
    const { repo, sqlite } = makeRepo();
    const t = repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    // Force locked_until into the past
    sqlite.run('UPDATE tasks SET locked_until = ? WHERE id = ?', [nowSec() - 5, t.id]);
    const recovered = repo.recoverExpired();
    expect(recovered).toBe(1);
    const reloaded = repo.findById(t.id)!;
    expect(reloaded.status).toBe('pending');
    expect(reloaded.lockedBy).toBeNull();
  });

  it('does not touch running rows still within visibility timeout', () => {
    const { repo } = makeRepo();
    repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    const recovered = repo.recoverExpired();
    expect(recovered).toBe(0);
  });
});

describe('TaskRepository.requeue / delete / list', () => {
  it('requeue resets a dead task to pending with attempts=0', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    repo.markFailed(t.id, 'boom', null);
    const ok = repo.requeue(t.id);
    expect(ok).toBe(true);
    const reloaded = repo.findById(t.id)!;
    expect(reloaded.status).toBe('pending');
    expect(reloaded.attempts).toBe(0);
    expect(reloaded.lastError).toBeNull();
  });

  it('requeue is a no-op for pending/running tasks', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    expect(repo.requeue(t.id)).toBe(false);
  });

  it('delete removes the row', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    expect(repo.delete(t.id)).toBe(true);
    expect(repo.findById(t.id)).toBeNull();
  });

  it('list filters by status and kind', () => {
    const { repo } = makeRepo();
    repo.enqueue('a', {});
    const t2 = repo.enqueue('b', {});
    repo.markDone(t2.id);
    expect(repo.list({ status: 'pending' }).length).toBe(1);
    expect(repo.list({ status: 'done', kind: 'b' }).length).toBe(1);
    expect(repo.list({ status: 'done', kind: 'a' }).length).toBe(0);
  });
});
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `bun test src/server/queue/__tests__/TaskRepository.test.ts`
Expected: All assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/queue/types.ts src/server/queue/TaskRepository.ts src/server/queue/__tests__/TaskRepository.test.ts
git commit -m "feat(queue): add TaskRepository with claim/finish/recover (gamearr-5tn)"
```

---

## Task 3: TaskQueue singleton with EventEmitter wake

**Files:**
- Create: `src/server/queue/TaskQueue.ts`
- Create: `src/server/queue/__tests__/TaskQueue.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/queue/__tests__/TaskQueue.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { TaskQueue } from '../TaskQueue';
import { TaskRepository } from '../TaskRepository';
import { createTestDb } from './testHelpers';

function makeQueue() {
  const { sqlite } = createTestDb();
  const repo = new TaskRepository(sqlite);
  const queue = new TaskQueue(repo);
  return { queue, repo, sqlite };
}

describe('TaskQueue.enqueue', () => {
  it('inserts a row via the repository', () => {
    const { queue, repo } = makeQueue();
    const t = queue.enqueue('test.kind', { x: 1 });
    expect(repo.findById(t.id)?.kind).toBe('test.kind');
  });

  it('emits a "wake" event after enqueue', () => {
    const { queue } = makeQueue();
    let woke = false;
    queue.on('wake', () => {
      woke = true;
    });
    queue.enqueue('test.kind', {});
    expect(woke).toBe(true);
  });

  it('emits "wake" once per enqueue', () => {
    const { queue } = makeQueue();
    let count = 0;
    queue.on('wake', () => count++);
    queue.enqueue('a', {});
    queue.enqueue('b', {});
    queue.enqueue('c', {});
    expect(count).toBe(3);
  });

  it('off() removes the listener', () => {
    const { queue } = makeQueue();
    let count = 0;
    const listener = () => count++;
    queue.on('wake', listener);
    queue.enqueue('a', {});
    queue.off('wake', listener);
    queue.enqueue('b', {});
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/server/queue/__tests__/TaskQueue.test.ts`
Expected: FAIL — `TaskQueue` not found.

- [ ] **Step 3: Implement `src/server/queue/TaskQueue.ts`**

```typescript
import { EventEmitter } from 'events';
import type { TaskRepository } from './TaskRepository';
import type { TaskRow, EnqueueOptions } from './types';

/**
 * Singleton facade for enqueueing work and waking the worker.
 * Same-process EventEmitter — when enqueue() is called, any listening
 * worker is woken immediately instead of waiting for the next poll.
 */
export class TaskQueue extends EventEmitter {
  constructor(private repo: TaskRepository) {
    super();
    // Many handlers can listen (worker, tests, future health UI). Bump cap.
    this.setMaxListeners(50);
  }

  enqueue(kind: string, payload: unknown, opts?: EnqueueOptions): TaskRow {
    const row = this.repo.enqueue(kind, payload, opts);
    this.emit('wake');
    return row;
  }
}

import { taskRepository } from './TaskRepository';
export const taskQueue = new TaskQueue(taskRepository);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/server/queue/__tests__/TaskQueue.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/queue/TaskQueue.ts src/server/queue/__tests__/TaskQueue.test.ts
git commit -m "feat(queue): add TaskQueue singleton with wake events (gamearr-5tn)"
```

---

## Task 4: Handler registry with concurrency tracking

**Files:**
- Create: `src/server/queue/registry.ts`
- Create: `src/server/queue/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/queue/__tests__/registry.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { HandlerRegistry } from '../registry';
import type { TaskHandler } from '../types';

const noopHandler: TaskHandler = async () => {};

describe('HandlerRegistry', () => {
  it('registers and retrieves handlers by kind', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler });
    expect(r.get('a')?.kind).toBe('a');
    expect(r.get('missing')).toBeUndefined();
  });

  it('throws on duplicate kind', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler });
    expect(() => r.register({ kind: 'a', handler: noopHandler })).toThrow();
  });

  it('applies default concurrency=1 and timeoutSec=300', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler });
    const reg = r.get('a')!;
    expect(reg.concurrency).toBe(1);
    expect(reg.timeoutSec).toBe(300);
  });

  it('tracks in-flight count per kind', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler, concurrency: 2 });
    expect(r.canRun('a')).toBe(true);
    r.acquire('a');
    expect(r.canRun('a')).toBe(true); // 1 of 2
    r.acquire('a');
    expect(r.canRun('a')).toBe(false); // 2 of 2
    r.release('a');
    expect(r.canRun('a')).toBe(true);
  });

  it('canRun returns false for unregistered kind', () => {
    const r = new HandlerRegistry();
    expect(r.canRun('missing')).toBe(false);
  });

  it('returns kinds with available capacity', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler, concurrency: 1 });
    r.register({ kind: 'b', handler: noopHandler, concurrency: 1 });
    r.acquire('a');
    expect(r.kindsWithCapacity().sort()).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/server/queue/__tests__/registry.test.ts`
Expected: FAIL — `HandlerRegistry` not found.

- [ ] **Step 3: Implement `src/server/queue/registry.ts`**

```typescript
import type { HandlerRegistration } from './types';
import { DEFAULT_CONCURRENCY, DEFAULT_TIMEOUT_SEC } from './types';

interface InternalRegistration extends Required<Omit<HandlerRegistration, 'concurrency' | 'timeoutSec'>> {
  concurrency: number;
  timeoutSec: number;
}

export class HandlerRegistry {
  private handlers = new Map<string, InternalRegistration>();
  private inFlight = new Map<string, number>();

  register(reg: HandlerRegistration): void {
    if (this.handlers.has(reg.kind)) {
      throw new Error(`Handler for kind "${reg.kind}" already registered`);
    }
    this.handlers.set(reg.kind, {
      kind: reg.kind,
      handler: reg.handler,
      concurrency: reg.concurrency ?? DEFAULT_CONCURRENCY,
      timeoutSec: reg.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });
    this.inFlight.set(reg.kind, 0);
  }

  get(kind: string): InternalRegistration | undefined {
    return this.handlers.get(kind);
  }

  /** True if the kind is registered and has available concurrency capacity. */
  canRun(kind: string): boolean {
    const reg = this.handlers.get(kind);
    if (!reg) return false;
    const current = this.inFlight.get(kind) ?? 0;
    return current < reg.concurrency;
  }

  acquire(kind: string): void {
    const current = this.inFlight.get(kind) ?? 0;
    this.inFlight.set(kind, current + 1);
  }

  release(kind: string): void {
    const current = this.inFlight.get(kind) ?? 0;
    this.inFlight.set(kind, Math.max(0, current - 1));
  }

  kindsWithCapacity(): string[] {
    return [...this.handlers.keys()].filter((k) => this.canRun(k));
  }

  allKinds(): string[] {
    return [...this.handlers.keys()];
  }

  inFlightCount(kind: string): number {
    return this.inFlight.get(kind) ?? 0;
  }
}

export const handlerRegistry = new HandlerRegistry();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/server/queue/__tests__/registry.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/queue/registry.ts src/server/queue/__tests__/registry.test.ts
git commit -m "feat(queue): add HandlerRegistry with concurrency caps (gamearr-5tn)"
```

---

## Task 5: TaskWorker — claim, execute, finalize with backoff

**Files:**
- Create: `src/server/queue/TaskWorker.ts`
- Create: `src/server/queue/__tests__/TaskWorker.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/queue/__tests__/TaskWorker.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { TaskRepository } from '../TaskRepository';
import { TaskQueue } from '../TaskQueue';
import { HandlerRegistry } from '../registry';
import { TaskWorker } from '../TaskWorker';
import { createTestDb, nowSec } from './testHelpers';
import type { TaskHandler } from '../types';

function makeWorker(opts?: { pollIntervalMs?: number }) {
  const { sqlite } = createTestDb();
  const repo = new TaskRepository(sqlite);
  const queue = new TaskQueue(repo);
  const registry = new HandlerRegistry();
  const worker = new TaskWorker({
    repo,
    queue,
    registry,
    workerId: 'test-worker',
    pollIntervalMs: opts?.pollIntervalMs ?? 50,
  });
  return { worker, repo, queue, registry, sqlite };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('TaskWorker', () => {
  it('runs a registered handler and marks the task done', async () => {
    const { worker, repo, queue, registry } = makeWorker();
    let ran = false;
    const h: TaskHandler = async ({ payload }) => {
      ran = true;
      expect(payload).toEqual({ x: 1 });
    };
    registry.register({ kind: 'test.run', handler: h });
    const t = queue.enqueue('test.run', { x: 1 });
    worker.start();
    await wait(150);
    await worker.stop();
    expect(ran).toBe(true);
    expect(repo.findById(t.id)?.status).toBe('done');
  });

  it('marks task failed and reschedules with backoff on handler error', async () => {
    const { worker, repo, queue, registry } = makeWorker();
    const h: TaskHandler = async () => {
      throw new Error('boom');
    };
    registry.register({ kind: 'test.fail', handler: h });
    const t = queue.enqueue('test.fail', {}, { maxAttempts: 3 });
    worker.start();
    await wait(150);
    await worker.stop();
    const row = repo.findById(t.id)!;
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain('boom');
    expect(row.runAt).toBeGreaterThan(nowSec()); // future-scheduled
  });

  it('marks task dead after maxAttempts exceeded', async () => {
    const { worker, repo, queue, registry, sqlite } = makeWorker();
    const h: TaskHandler = async () => {
      throw new Error('boom');
    };
    registry.register({ kind: 'test.dead', handler: h });
    const t = queue.enqueue('test.dead', {}, { maxAttempts: 1 });
    worker.start();
    await wait(150);
    await worker.stop();
    const row = repo.findById(t.id)!;
    expect(row.status).toBe('dead');
    expect(row.lastError).toContain('boom');
  });

  it('skips claiming when no handler is registered for the kind', async () => {
    const { worker, repo, queue } = makeWorker();
    const t = queue.enqueue('orphan.kind', {});
    worker.start();
    await wait(150);
    await worker.stop();
    // No handler => task stays pending (worker filtered by registered kinds)
    expect(repo.findById(t.id)?.status).toBe('pending');
  });

  it('wakes immediately on enqueue (sub-poll latency)', async () => {
    const { worker, repo, queue, registry } = makeWorker({ pollIntervalMs: 10_000 });
    let ran = false;
    registry.register({
      kind: 'test.wake',
      handler: async () => {
        ran = true;
      },
    });
    worker.start();
    await wait(20); // less than poll interval
    queue.enqueue('test.wake', {});
    await wait(80);
    await worker.stop();
    expect(ran).toBe(true);
  });

  it('respects per-kind concurrency cap', async () => {
    const { worker, queue, registry } = makeWorker();
    let active = 0;
    let peak = 0;
    registry.register({
      kind: 'test.cap',
      concurrency: 2,
      handler: async () => {
        active++;
        peak = Math.max(peak, active);
        await wait(40);
        active--;
      },
    });
    for (let i = 0; i < 6; i++) queue.enqueue('test.cap', {});
    worker.start();
    await wait(400);
    await worker.stop();
    expect(peak).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/server/queue/__tests__/TaskWorker.test.ts`
Expected: FAIL — `TaskWorker` not found.

- [ ] **Step 3: Implement `src/server/queue/TaskWorker.ts`**

```typescript
import { logger } from '../utils/logger';
import type { TaskRepository } from './TaskRepository';
import type { TaskQueue } from './TaskQueue';
import type { HandlerRegistry } from './registry';
import type { TaskRow } from './types';

interface WorkerConfig {
  repo: TaskRepository;
  queue: TaskQueue;
  registry: HandlerRegistry;
  workerId: string;
  /** How often to poll for due tasks. Default 2000ms. */
  pollIntervalMs?: number;
  /** Max tasks to claim per poll tick. Default 10. */
  claimBatchSize?: number;
}

const DEFAULT_POLL_MS = 2000;
const DEFAULT_BATCH = 10;

/**
 * Compute next run-at after a failed attempt.
 * Returns null if attempts >= maxAttempts (caller should mark dead).
 *
 * Backoff: min(2^attempts * 30s, 1h) + jitter(0..30s)
 */
export function computeBackoff(attempts: number, maxAttempts: number, nowSec: number): number | null {
  if (attempts >= maxAttempts) return null;
  const base = Math.min(Math.pow(2, attempts) * 30, 3600);
  const jitter = Math.floor(Math.random() * 30);
  return nowSec + base + jitter;
}

export class TaskWorker {
  private repo: TaskRepository;
  private queue: TaskQueue;
  private registry: HandlerRegistry;
  private workerId: string;
  private pollIntervalMs: number;
  private claimBatchSize: number;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wakeListener: (() => void) | null = null;
  private inFlightPromises = new Set<Promise<void>>();
  private abortControllers = new Map<number, AbortController>();

  constructor(cfg: WorkerConfig) {
    this.repo = cfg.repo;
    this.queue = cfg.queue;
    this.registry = cfg.registry;
    this.workerId = cfg.workerId;
    this.pollIntervalMs = cfg.pollIntervalMs ?? DEFAULT_POLL_MS;
    this.claimBatchSize = cfg.claimBatchSize ?? DEFAULT_BATCH;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.wakeListener = () => {
      // Schedule a tick immediately; pollLoop guards against re-entry.
      void this.tick();
    };
    this.queue.on('wake', this.wakeListener);

    // Recover any tasks left running from a prior crash.
    const recovered = this.repo.recoverExpired();
    if (recovered > 0) {
      logger.info(`TaskWorker recovered ${recovered} stuck task(s) on startup`);
    }

    void this.pollLoop();
  }

  /**
   * Stop accepting new tasks and wait for in-flight ones to complete.
   * Aborts handler signals immediately; handlers should observe.
   */
  async stop(graceMs: number = 5000): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.wakeListener) {
      this.queue.off('wake', this.wakeListener);
      this.wakeListener = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Signal abort to handlers
    for (const ac of this.abortControllers.values()) ac.abort();

    // Wait for in-flight
    const deadline = Date.now() + graceMs;
    while (this.inFlightPromises.size > 0 && Date.now() < deadline) {
      await Promise.race([
        Promise.allSettled([...this.inFlightPromises]),
        new Promise((r) => setTimeout(r, 50)),
      ]);
    }
    if (this.inFlightPromises.size > 0) {
      logger.warn(`TaskWorker stopped with ${this.inFlightPromises.size} in-flight task(s) past grace`);
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      await this.tick();
      if (!this.running) break;
      await new Promise<void>((resolve) => {
        this.timer = setTimeout(resolve, this.pollIntervalMs);
      });
    }
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    // Recover expired locks each tick (cheap, idempotent).
    this.repo.recoverExpired();

    const kinds = this.registry.kindsWithCapacity();
    if (kinds.length === 0) return;

    // Claim with the smallest visibility timeout among capacity-having kinds, to be safe.
    const minTimeout = Math.min(
      ...kinds.map((k) => this.registry.get(k)!.timeoutSec)
    );

    const claimed = this.repo.claimDue(this.workerId, minTimeout, this.claimBatchSize, kinds);
    for (const task of claimed) {
      // Re-check capacity now that we hold the row (other tick could be racing).
      if (!this.registry.canRun(task.kind)) {
        // Release row back to pending immediately
        this.repo.markFailed(task.id, 'No capacity at execution time', Math.floor(Date.now() / 1000));
        continue;
      }
      this.registry.acquire(task.kind);
      const promise = this.execute(task).finally(() => {
        this.registry.release(task.kind);
        this.inFlightPromises.delete(promise);
        this.abortControllers.delete(task.id);
      });
      this.inFlightPromises.add(promise);
    }
  }

  private async execute(task: TaskRow): Promise<void> {
    const reg = this.registry.get(task.kind);
    if (!reg) {
      // Defensive: should be filtered out before claim. Reset to pending.
      this.repo.markFailed(task.id, `No handler for kind ${task.kind}`, null);
      return;
    }

    const ac = new AbortController();
    this.abortControllers.set(task.id, ac);

    let payload: unknown = {};
    try {
      payload = JSON.parse(task.payload);
    } catch (err) {
      this.repo.markFailed(task.id, `Invalid JSON payload: ${(err as Error).message}`, null);
      return;
    }

    try {
      await reg.handler({ task, payload, signal: ac.signal });
      this.repo.markDone(task.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextRunAt = computeBackoff(task.attempts, task.maxAttempts, Math.floor(Date.now() / 1000));
      this.repo.markFailed(task.id, message, nextRunAt);
      logger.warn(`TaskWorker task #${task.id} (${task.kind}) failed (attempt ${task.attempts}/${task.maxAttempts}): ${message}`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/server/queue/__tests__/TaskWorker.test.ts`
Expected: All 6 tests pass. (Some may take up to 1s due to wait timers.)

- [ ] **Step 5: Commit**

```bash
git add src/server/queue/TaskWorker.ts src/server/queue/__tests__/TaskWorker.test.ts
git commit -m "feat(queue): add TaskWorker with backoff, wake, concurrency, abort (gamearr-5tn)"
```

---

## Task 6: Tasks archive sweep

**Files:**
- Create: `src/server/queue/TaskArchiver.ts`
- Modify: `src/server/queue/__tests__/testHelpers.ts` (no change expected, archive table already created)
- Create: `src/server/queue/__tests__/TaskArchiver.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/queue/__tests__/TaskArchiver.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/server/queue/__tests__/TaskArchiver.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/queue/TaskArchiver.ts`**

```typescript
import type { Database } from 'bun:sqlite';
import { logger } from '../utils/logger';
import { sqlite } from '../db';

export interface ArchiveOptions {
  /** Move rows in terminal status whose updated_at is older than this many seconds. Default 7 days. */
  olderThanSec?: number;
}

/**
 * Move done/dead rows older than threshold into tasks_archive in a single transaction.
 * Returns number of rows moved.
 */
export function archiveTerminalTasks(db: Database, opts: ArchiveOptions = {}): number {
  const olderThan = opts.olderThanSec ?? 60 * 60 * 24 * 7;
  const cutoff = Math.floor(Date.now() / 1000) - olderThan;

  let moved = 0;
  db.transaction(() => {
    const insertResult = db.run(
      `INSERT INTO tasks_archive
         (original_id, kind, payload, status, attempts, last_error, dedup_key, created_at)
       SELECT id, kind, payload, status, attempts, last_error, dedup_key, created_at
       FROM tasks
       WHERE status IN ('done','dead') AND updated_at < ?`,
      [cutoff]
    );
    moved = insertResult.changes;
    db.run(
      `DELETE FROM tasks WHERE status IN ('done','dead') AND updated_at < ?`,
      [cutoff]
    );
  })();

  if (moved > 0) {
    logger.info(`TaskArchiver moved ${moved} terminal task(s) to tasks_archive (cutoff=${cutoff})`);
  }
  return moved;
}

/** Production binding using the app sqlite handle. */
export function runArchiveSweep(opts?: ArchiveOptions): number {
  return archiveTerminalTasks(sqlite, opts);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/server/queue/__tests__/TaskArchiver.test.ts`
Expected: 1 pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/queue/TaskArchiver.ts src/server/queue/__tests__/TaskArchiver.test.ts
git commit -m "feat(queue): add daily archive sweep for terminal tasks (gamearr-5tn)"
```

---

## Task 7: First handler — `metadata.refresh`

**Files:**
- Create: `src/server/queue/handlers/metadataRefresh.ts`
- Create: `src/server/queue/handlers/index.ts`

- [ ] **Step 1: Implement `src/server/queue/handlers/metadataRefresh.ts`**

```typescript
import { gameRepository } from '../../repositories/GameRepository';
import { igdbClient } from '../../integrations/igdb/IGDBClient';
import { logger } from '../../utils/logger';
import type { HandlerRegistration, TaskHandler } from '../types';

interface MetadataRefreshPayload {
  gameId: number;
}

const handler: TaskHandler = async ({ payload }) => {
  const { gameId } = payload as MetadataRefreshPayload;
  if (typeof gameId !== 'number') {
    throw new Error(`Invalid payload: expected { gameId: number }, got ${JSON.stringify(payload)}`);
  }

  if (!igdbClient.isConfigured()) {
    // Throw so the task is retried later. Backoff will rate-limit polling.
    throw new Error('IGDB not configured');
  }

  const game = await gameRepository.findById(gameId);
  if (!game) {
    // Game was deleted; nothing to do, treat as success to avoid retry loop.
    logger.debug(`metadata.refresh: game ${gameId} no longer exists, skipping`);
    return;
  }

  const igdbGame = await igdbClient.getGame(game.igdbId);
  if (!igdbGame) {
    logger.warn(`metadata.refresh: IGDB returned no data for ${game.title} (${game.igdbId})`);
    return;
  }

  await gameRepository.update(game.id, {
    summary: igdbGame.summary || null,
    genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
    totalRating: igdbGame.totalRating || null,
    developer: igdbGame.developer || null,
    publisher: igdbGame.publisher || null,
    gameModes: igdbGame.gameModes ? JSON.stringify(igdbGame.gameModes) : null,
    similarGames: igdbGame.similarGames ? JSON.stringify(igdbGame.similarGames) : null,
  });
  logger.info(`metadata.refresh: updated ${game.title}`);
};

export const metadataRefreshHandler: HandlerRegistration = {
  kind: 'metadata.refresh',
  handler,
  // IGDB rate limit ≈ 4 req/s. Sequential is safe.
  concurrency: 1,
  timeoutSec: 60,
};
```

- [ ] **Step 2: Implement `src/server/queue/handlers/index.ts`**

```typescript
import { handlerRegistry } from '../registry';
import { metadataRefreshHandler } from './metadataRefresh';

/**
 * Register all task handlers. Called once at server startup.
 */
export function registerAllHandlers(): void {
  handlerRegistry.register(metadataRefreshHandler);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bun build src/server/queue/handlers/index.ts --target=bun --outdir=/tmp/gamearr-build-check`
Expected: builds without errors. (Delete `/tmp/gamearr-build-check` after.)

If `gameRepository.findById` doesn't exist, check the actual method name with: `grep -n "findById\|getById\|find(" src/server/repositories/GameRepository.ts` and use the correct one. Same for any update signature mismatches — adapt to the existing repo's API.

- [ ] **Step 4: Commit**

```bash
git add src/server/queue/handlers/
git commit -m "feat(queue): add metadata.refresh handler (gamearr-5tn)"
```

---

## Task 8: Refactor MetadataRefreshJob to enqueue

**Files:**
- Modify: `src/server/jobs/MetadataRefreshJob.ts`

- [ ] **Step 1: Replace inline IGDB work with enqueue calls**

Replace the entire contents of `src/server/jobs/MetadataRefreshJob.ts` with:

```typescript
import { gameRepository } from '../repositories/GameRepository';
import { igdbClient } from '../integrations/igdb/IGDBClient';
import { taskQueue } from '../queue/TaskQueue';
import { logger } from '../utils/logger';

/**
 * Background job: scans for games missing metadata and enqueues a metadata.refresh
 * task for each. Actual IGDB work runs in the queue worker.
 */
export class MetadataRefreshJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  start(intervalMs: number = 5 * 60 * 1000) {
    logger.info('Starting MetadataRefreshJob (enqueue mode)...');
    void this.scan();
    this.intervalId = setInterval(() => {
      void this.scan();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('MetadataRefreshJob stopped');
    }
  }

  private async scan() {
    if (this.isRunning) {
      logger.debug('MetadataRefreshJob scan already in progress, skipping');
      return;
    }
    if (!igdbClient.isConfigured()) {
      logger.debug('IGDB not configured, skipping metadata scan');
      return;
    }

    this.isRunning = true;
    try {
      const allGames = await gameRepository.findAll();
      const needs = allGames.filter((g) => g.summary === null && g.igdbId);
      if (needs.length === 0) {
        logger.debug('No games need metadata refresh');
        return;
      }

      let enqueued = 0;
      for (const g of needs) {
        const t = taskQueue.enqueue(
          'metadata.refresh',
          { gameId: g.id },
          { dedupKey: `game:${g.id}`, priority: 0 }
        );
        // enqueue returns existing row on dedup hit; only count when we actually inserted
        if (t.attempts === 0 && t.status === 'pending') enqueued++;
      }
      if (enqueued > 0) {
        logger.info(`MetadataRefreshJob enqueued ${enqueued} metadata.refresh task(s)`);
      }
    } catch (err) {
      logger.error('MetadataRefreshJob scan error:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const metadataRefreshJob = new MetadataRefreshJob();
```

- [ ] **Step 2: Verify the file compiles**

Run: `bun build src/server/jobs/MetadataRefreshJob.ts --target=bun --outdir=/tmp/check`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/server/jobs/MetadataRefreshJob.ts
git commit -m "refactor(jobs): MetadataRefreshJob enqueues tasks instead of running inline (gamearr-5tn)"
```

---

## Task 9: REST endpoints — `/api/v1/tasks`

**Files:**
- Create: `src/server/routes/tasks.ts`
- Modify: `src/server/index.ts` (route registration only — wiring at Task 10)

- [ ] **Step 1: Create `src/server/routes/tasks.ts`**

```typescript
import { Hono } from 'hono';
import { taskRepository } from '../queue/TaskRepository';
import { logger } from '../utils/logger';
import type { TaskStatus } from '../queue/types';

const router = new Hono();

const VALID_STATUS: ReadonlyArray<TaskStatus> = ['pending', 'running', 'done', 'failed', 'dead'];

router.get('/', (c) => {
  const statusParam = c.req.query('status');
  const kind = c.req.query('kind');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100', 10) || 100, 500);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

  const status =
    statusParam && (VALID_STATUS as readonly string[]).includes(statusParam)
      ? (statusParam as TaskStatus)
      : undefined;

  try {
    const tasks = taskRepository.list({ status, kind, limit, offset });
    return c.json({ success: true, data: tasks });
  } catch (err) {
    logger.error('GET /tasks error:', err);
    return c.json({ success: false, error: 'Failed to list tasks' }, 500);
  }
});

router.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400);
  const task = taskRepository.findById(id);
  if (!task) return c.json({ success: false, error: 'Task not found' }, 404);
  return c.json({ success: true, data: task });
});

router.post('/:id/retry', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400);
  const ok = taskRepository.requeue(id);
  if (!ok) {
    return c.json(
      { success: false, error: 'Task not found, or not in failed/dead status' },
      409
    );
  }
  return c.json({ success: true, data: taskRepository.findById(id) });
});

router.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400);
  const ok = taskRepository.delete(id);
  if (!ok) return c.json({ success: false, error: 'Task not found' }, 404);
  return c.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Register router in `src/server/index.ts`**

Add the import alongside other route imports (near `import notificationsRouter from './routes/notifications';`):

```typescript
import tasksRouter from './routes/tasks';
```

Add the route registration alongside the other `app.route(...)` calls (after `notificationsRouter`):

```typescript
app.route('/api/v1/tasks', tasksRouter);
```

- [ ] **Step 3: Smoke test the route by starting the server briefly**

Start the dev server: `bun dev` (in a second terminal, or background it).

In another terminal:
```bash
curl -s http://localhost:8484/api/v1/tasks | head
```
Expected: `{"success":true,"data":[]}` (or similar — empty if no tasks yet). Note: if auth is configured, this will require an API key. In that case, hit `http://localhost:8484/api/v1/tasks` from an authenticated session in the browser dev tools instead.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/server/routes/tasks.ts src/server/index.ts
git commit -m "feat(api): add GET /api/v1/tasks list/retry/delete endpoints (gamearr-5tn)"
```

---

## Task 10: Wire worker, handlers, and archive sweep into server startup

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: Add imports near other queue/job imports**

After the existing job imports (near line 53), add:

```typescript
import { CronJob } from 'cron';
import { taskRepository } from './queue/TaskRepository';
import { taskQueue } from './queue/TaskQueue';
import { handlerRegistry } from './queue/registry';
import { TaskWorker } from './queue/TaskWorker';
import { registerAllHandlers } from './queue/handlers';
import { runArchiveSweep } from './queue/TaskArchiver';
```

(If a `CronJob` import already exists in `index.ts`, skip the `import { CronJob } from 'cron';` line.)

- [ ] **Step 2: Construct the worker singleton (module scope, after imports, before `const app = new Hono();`)**

```typescript
// Single in-process queue worker. Started after handlers register.
const taskWorker = new TaskWorker({
  repo: taskRepository,
  queue: taskQueue,
  registry: handlerRegistry,
  workerId: `gamearr-${process.pid}`,
});
```

- [ ] **Step 3: Start handlers + worker in the boot block**

In the existing `initializeClients().then(async () => { ... })` block, after `// Start background jobs` and the existing `.start()` calls, append:

```typescript
  // Register task handlers and start the queue worker.
  registerAllHandlers();
  taskWorker.start();
  logger.info('✅ Task queue worker started');
```

- [ ] **Step 4: Add a daily archive sweep**

In the same boot block, after `taskWorker.start();`, append:

```typescript
  // Daily archive sweep at 03:15 local time.
  new CronJob('0 15 3 * * *', () => {
    try {
      runArchiveSweep();
    } catch (err) {
      logger.error('Task archive sweep failed:', err);
    }
  }).start();
```

- [ ] **Step 5: Add graceful shutdown**

Append to the end of `src/server/index.ts` (after the `Bun.serve(...)` call):

```typescript
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down...`);
  try {
    await taskWorker.stop(10_000);
    logger.info('Task worker stopped');
  } catch (err) {
    logger.error('Error stopping task worker:', err);
  }
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

- [ ] **Step 6: Boot the server end-to-end**

Run: `bun dev`
Expected log lines:
- `✅ Background jobs started`
- `✅ Task queue worker started`
- (later, when MetadataRefreshJob's first scan runs) `MetadataRefreshJob enqueued N metadata.refresh task(s)` — only if there are games missing metadata.

In another shell (with a configured/auth-skipped instance), confirm tasks list returns:
```bash
curl -s http://localhost:8484/api/v1/tasks
```

Stop the server with Ctrl-C and confirm logs show `SIGINT received, shutting down...` and `Task worker stopped`.

- [ ] **Step 7: Commit**

```bash
git add src/server/index.ts
git commit -m "feat(queue): wire TaskWorker, handlers, archive sweep, graceful shutdown (gamearr-5tn)"
```

---

## Task 11: End-to-end integration test

**Files:**
- Create: `src/server/queue/__tests__/integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `src/server/queue/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { TaskRepository } from '../TaskRepository';
import { TaskQueue } from '../TaskQueue';
import { HandlerRegistry } from '../registry';
import { TaskWorker } from '../TaskWorker';
import { createTestDb } from './testHelpers';
import type { TaskHandler } from '../types';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('queue integration', () => {
  it('enqueue → wake → execute → done within poll cycle', async () => {
    const { sqlite } = createTestDb();
    const repo = new TaskRepository(sqlite);
    const queue = new TaskQueue(repo);
    const registry = new HandlerRegistry();
    const worker = new TaskWorker({
      repo,
      queue,
      registry,
      workerId: 'integration',
      pollIntervalMs: 5000, // long, to prove wake works
    });

    const ranIds: number[] = [];
    const h: TaskHandler = async ({ task }) => {
      ranIds.push(task.id);
    };
    registry.register({ kind: 'integration.run', handler: h, concurrency: 3 });

    worker.start();
    const t1 = queue.enqueue('integration.run', { i: 1 });
    const t2 = queue.enqueue('integration.run', { i: 2 });
    const t3 = queue.enqueue('integration.run', { i: 3 });

    await wait(200);
    await worker.stop();

    expect(ranIds.sort()).toEqual([t1.id, t2.id, t3.id].sort());
    expect(repo.findById(t1.id)?.status).toBe('done');
    expect(repo.findById(t2.id)?.status).toBe('done');
    expect(repo.findById(t3.id)?.status).toBe('done');
  });

  it('crashed task (running + expired lock) is recovered and retried', async () => {
    const { sqlite } = createTestDb();
    const repo = new TaskRepository(sqlite);
    const queue = new TaskQueue(repo);
    const registry = new HandlerRegistry();

    // Simulate a crashed task: insert as 'running' with expired lock
    sqlite.run(
      `INSERT INTO tasks (kind, status, locked_until, locked_by, attempts, max_attempts)
       VALUES ('integration.recover', 'running', ?, 'old-worker', 1, 3)`,
      [Math.floor(Date.now() / 1000) - 60]
    );
    const id = (sqlite.query('SELECT id FROM tasks').get() as { id: number }).id;

    let ran = 0;
    registry.register({
      kind: 'integration.recover',
      handler: async () => {
        ran++;
      },
    });

    const worker = new TaskWorker({ repo, queue, registry, workerId: 'recovery', pollIntervalMs: 50 });
    worker.start();
    await wait(200);
    await worker.stop();

    expect(ran).toBe(1);
    expect(repo.findById(id)?.status).toBe('done');
  });

  it('dedup_key prevents duplicate active enqueues across rapid scan ticks', () => {
    const { sqlite } = createTestDb();
    const repo = new TaskRepository(sqlite);
    const queue = new TaskQueue(repo);

    const a = queue.enqueue('integration.dedup', { gameId: 1 }, { dedupKey: 'game:1' });
    const b = queue.enqueue('integration.dedup', { gameId: 1 }, { dedupKey: 'game:1' });
    const c = queue.enqueue('integration.dedup', { gameId: 1 }, { dedupKey: 'game:1' });

    expect(b.id).toBe(a.id);
    expect(c.id).toBe(a.id);
    const count = (sqlite.query("SELECT COUNT(*) AS c FROM tasks WHERE status='pending'").get() as { c: number }).c;
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `bun test src/server/queue/__tests__/integration.test.ts`
Expected: All 3 tests pass.

- [ ] **Step 3: Run the full queue test suite**

Run: `bun test src/server/queue/`
Expected: all `TaskRepository`, `TaskQueue`, `TaskWorker`, `registry`, `TaskArchiver`, `integration` tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/queue/__tests__/integration.test.ts
git commit -m "test(queue): end-to-end integration tests (gamearr-5tn)"
```

---

## Task 12: Update beads + final hand-off

- [ ] **Step 1: Update bd issue with completion notes**

```bash
bd update gamearr-5tn --notes="Implementation complete. tasks + tasks_archive tables, TaskRepository, TaskQueue (with EventEmitter wake), HandlerRegistry (with concurrency caps), TaskWorker (poll + wake + abort + backoff), TaskArchiver (daily sweep), GET/POST/DELETE /api/v1/tasks routes, MetadataRefreshJob refactored to enqueue. Tests cover schema, repo, queue, registry, worker, archiver, integration. WAL mode assumed (handled in db/index.ts)."
bd close gamearr-5tn
```

- [ ] **Step 2: Run full test suite to confirm nothing else regressed**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 3: Manual smoke test of the binary build**

Run: `bun run build` — should produce `./gamearr` without errors.
Run: `./gamearr` briefly, confirm:
- `✅ Task queue worker started` appears
- `GET /api/v1/tasks` returns `{success:true,data:[...]}`
- Ctrl-C produces clean shutdown logs.

- [ ] **Step 4: Push (per CLAUDE.md session-completion protocol)**

```bash
git pull --rebase
bd dolt push
git push
git status   # MUST show "up to date with origin"
```

---

## Acceptance Criteria (from beads issue gamearr-5tn)

- [x] `tasks` table + indexes added via Drizzle migration → Tasks 1
- [x] `TaskQueue.enqueue()` inserts row and emits wake event → Task 3
- [x] `TaskWorker` polls + reacts to emitter, claims atomically, runs handler, marks done/failed with backoff → Task 5
- [x] Crash recovery: stuck `running` rows past `locked_until` are re-enqueued on next tick → Task 5 (`recoverExpired`), Task 11 integration test
- [x] Per-kind concurrency cap enforced → Task 4, Task 5
- [x] Dedupe via partial unique index — duplicate enqueue with same `(kind, dedup_key)` while active is a no-op → Task 1, Task 2, Task 11
- [x] Graceful shutdown drains in-flight handlers within grace period → Task 5, Task 10
- [x] `GET /api/v1/tasks` returns paginated queue state → Task 9
- [x] At least one existing job migrated end-to-end as a reference implementation → `MetadataRefreshJob` (Task 8)
- [x] Unit tests: enqueue, claim race, retry/backoff, dedup, visibility timeout recovery → Tasks 2, 3, 4, 5, 11
- [x] Archive sweep moves terminal rows after N days → Task 6, Task 10

---

## Out of scope (separate issues to file later)

- Frontend UI panel for the queue (consume `/api/v1/tasks`)
- `croner` swap (replacement for `cron` package)
- Migrate other jobs (`SearchScheduler`, `RssSync`, `UpdateCheckJob`, etc.) to enqueue pattern — do one per PR
- Multi-process / horizontal scale (`locked_by` is reserved but unused)
- Schedule-tab UI surfaced in Settings
