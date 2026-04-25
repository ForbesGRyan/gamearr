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

import { sqlite } from '../db';
export const taskRepository = new TaskRepository(sqlite);
