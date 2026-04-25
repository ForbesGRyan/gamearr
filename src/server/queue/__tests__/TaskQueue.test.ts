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
