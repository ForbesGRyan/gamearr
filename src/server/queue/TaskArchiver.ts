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
