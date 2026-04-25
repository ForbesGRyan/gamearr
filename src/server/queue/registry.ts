import type { HandlerRegistration } from './types';
import { DEFAULT_CONCURRENCY, DEFAULT_TIMEOUT_SEC } from './types';

interface InternalRegistration extends Required<Omit<HandlerRegistration, 'concurrency' | 'timeoutSec'>> {
  concurrency: number;
  timeoutSec: number;
}

export class HandlerRegistry {
  private handlers = new Map<string, InternalRegistration>();
  private inFlight = new Map<string, number>();

  register(reg: HandlerRegistration): void {
    if (this.handlers.has(reg.kind)) {
      throw new Error(`Handler for kind "${reg.kind}" already registered`);
    }
    this.handlers.set(reg.kind, {
      kind: reg.kind,
      handler: reg.handler,
      concurrency: reg.concurrency ?? DEFAULT_CONCURRENCY,
      timeoutSec: reg.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });
    this.inFlight.set(reg.kind, 0);
  }

  get(kind: string): InternalRegistration | undefined {
    return this.handlers.get(kind);
  }

  /** True if the kind is registered and has available concurrency capacity. */
  canRun(kind: string): boolean {
    const reg = this.handlers.get(kind);
    if (!reg) return false;
    const current = this.inFlight.get(kind) ?? 0;
    return current < reg.concurrency;
  }

  acquire(kind: string): void {
    const current = this.inFlight.get(kind) ?? 0;
    this.inFlight.set(kind, current + 1);
  }

  release(kind: string): void {
    const current = this.inFlight.get(kind) ?? 0;
    this.inFlight.set(kind, Math.max(0, current - 1));
  }

  kindsWithCapacity(): string[] {
    return [...this.handlers.keys()].filter((k) => this.canRun(k));
  }

  allKinds(): string[] {
    return [...this.handlers.keys()];
  }

  inFlightCount(kind: string): number {
    return this.inFlight.get(kind) ?? 0;
  }
}

export const handlerRegistry = new HandlerRegistry();
