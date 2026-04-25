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
