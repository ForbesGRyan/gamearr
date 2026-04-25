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
