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
