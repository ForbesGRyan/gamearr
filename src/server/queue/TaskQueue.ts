import { EventEmitter } from 'events';
import type { TaskRepository } from './TaskRepository';
import type { TaskRow, EnqueueOptions } from './types';
import { taskRepository } from './TaskRepository';

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

export const taskQueue = new TaskQueue(taskRepository);
