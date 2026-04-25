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

describe('TaskRepository.releaseClaim', () => {
  it('returns a running row to pending without bumping attempts or setting lastError', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    repo.claimDue('w', 60, 10);
    const claimed = repo.findById(t.id)!;
    expect(claimed.status).toBe('running');
    expect(claimed.attempts).toBe(1);

    repo.releaseClaim(t.id);

    const released = repo.findById(t.id)!;
    expect(released.status).toBe('pending');
    expect(released.attempts).toBe(0);
    expect(released.lastError).toBeNull();
    expect(released.lockedBy).toBeNull();
    expect(released.lockedUntil).toBeNull();
  });

  it('does nothing for a row not in running status', () => {
    const { repo } = makeRepo();
    const t = repo.enqueue('a', {});
    // Status is 'pending', not 'running'
    repo.releaseClaim(t.id);
    const row = repo.findById(t.id)!;
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(0);
  });
});
