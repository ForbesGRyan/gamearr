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
