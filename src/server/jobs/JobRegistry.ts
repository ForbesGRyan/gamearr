import { CronTime } from 'cron';
import { logger } from '../utils/logger';

export type JobKind = 'cron' | 'interval' | 'continuous';

export interface JobInfo {
  name: string;
  /** Human-readable schedule. e.g. "every 30s", "every 5 minutes", "daily at 00:00". */
  schedule: string;
  kind: JobKind;
  /** Last successful run timestamp (unix sec). null if never run. */
  lastRunAt: number | null;
  /** Last run duration in ms. null if never run. */
  lastDurationMs: number | null;
  /** Last error message. null if last run succeeded or never ran. */
  lastError: string | null;
  /** Predicted next run timestamp (unix sec). null for continuous or unknown. */
  nextRunAt: number | null;
  /** Currently running. */
  running: boolean;
  /** Total successful runs since process start. */
  runCount: number;
  /** Total failed runs since process start. */
  errorCount: number;
  /** Whether a manual trigger is supported. */
  triggerable: boolean;
}

interface RegistrationInput {
  name: string;
  schedule: string;
  kind?: JobKind;
  /** Interval in ms — used to compute nextRunAt for kind='interval'. */
  intervalMs?: number;
  /** Cron expression — used to compute nextRunAt for kind='cron'. */
  cronExpr?: string;
  /** Optional callback for manual "Run now" triggers. */
  runNow?: () => Promise<unknown> | unknown;
}

interface InternalState extends Omit<JobInfo, 'nextRunAt'> {
  intervalMs: number | null;
  cronExpr: string | null;
  runNow: (() => Promise<unknown> | unknown) | null;
}

/**
 * In-process registry of scheduled jobs. Each job singleton calls register() at
 * startup, then wraps its tick handler with recordRun() to track last/duration/error.
 * Powers GET /api/v1/jobs and the Background Jobs UI.
 */
export class JobRegistry {
  private jobs = new Map<string, InternalState>();

  register(input: RegistrationInput): void {
    if (this.jobs.has(input.name)) {
      // Re-registration is allowed (e.g. SearchScheduler restarts when interval changes).
      // Update schedule + runNow + cadence sources but preserve metrics.
      const existing = this.jobs.get(input.name)!;
      existing.schedule = input.schedule;
      existing.kind = input.kind ?? existing.kind;
      existing.intervalMs = input.intervalMs ?? existing.intervalMs;
      existing.cronExpr = input.cronExpr ?? existing.cronExpr;
      existing.runNow = input.runNow ?? existing.runNow;
      existing.triggerable = !!existing.runNow;
      return;
    }
    this.jobs.set(input.name, {
      name: input.name,
      schedule: input.schedule,
      kind: input.kind ?? 'interval',
      lastRunAt: null,
      lastDurationMs: null,
      lastError: null,
      running: false,
      runCount: 0,
      errorCount: 0,
      triggerable: !!input.runNow,
      intervalMs: input.intervalMs ?? null,
      cronExpr: input.cronExpr ?? null,
      runNow: input.runNow ?? null,
    });
  }

  /**
   * Predict the next run time (unix sec). Returns null if unpredictable
   * (continuous workers, jobs without a schedule source).
   */
  private nextRunFor(state: InternalState): number | null {
    if (state.kind === 'continuous') return null;
    if (state.kind === 'cron' && state.cronExpr) {
      try {
        const next = new CronTime(state.cronExpr).getNextDateFrom(new Date());
        // CronTime returns a Luxon DateTime; toMillis() gives epoch ms.
        const ms = (next as unknown as { toMillis?: () => number }).toMillis?.() ?? next.valueOf();
        return Math.floor(ms / 1000);
      } catch {
        return null;
      }
    }
    if (state.kind === 'interval' && state.intervalMs) {
      const baseMs = state.lastRunAt !== null ? state.lastRunAt * 1000 : Date.now();
      return Math.floor((baseMs + state.intervalMs) / 1000);
    }
    return null;
  }

  /**
   * Wrap an async tick handler. Records start, end, duration, and error.
   * Returns whatever the wrapped function returns.
   */
  async recordRun<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const state = this.jobs.get(name);
    if (!state) {
      // Job not registered — run anyway, but warn.
      logger.warn(`JobRegistry.recordRun called for unregistered job "${name}"`);
      return fn();
    }
    state.running = true;
    const start = Date.now();
    try {
      const result = await fn();
      state.lastRunAt = Math.floor(Date.now() / 1000);
      state.lastDurationMs = Date.now() - start;
      state.lastError = null;
      state.runCount++;
      return result;
    } catch (err) {
      state.lastRunAt = Math.floor(Date.now() / 1000);
      state.lastDurationMs = Date.now() - start;
      state.lastError = err instanceof Error ? err.message : String(err);
      state.errorCount++;
      throw err;
    } finally {
      state.running = false;
    }
  }

  /** List all registered jobs with current state. */
  list(): JobInfo[] {
    return [...this.jobs.values()]
      .map((state) => {
        const { runNow: _runNow, intervalMs: _i, cronExpr: _c, ...info } = state;
        return { ...info, nextRunAt: this.nextRunFor(state) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Trigger a manual run. Returns false if the job isn't registered or isn't triggerable. */
  async trigger(name: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const state = this.jobs.get(name);
    if (!state) return { ok: false, reason: 'Job not found' };
    if (!state.runNow) return { ok: false, reason: 'Job is not triggerable' };
    if (state.running) return { ok: false, reason: 'Job is already running' };

    // Run via recordRun so metrics stay consistent.
    void this.recordRun(name, async () => {
      await state.runNow!();
    }).catch(() => {/* error already recorded */});
    return { ok: true };
  }
}

export const jobRegistry = new JobRegistry();
