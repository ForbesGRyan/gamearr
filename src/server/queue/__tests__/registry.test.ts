import { describe, it, expect } from 'bun:test';
import { HandlerRegistry } from '../registry';
import type { TaskHandler } from '../types';

const noopHandler: TaskHandler = async () => {};

describe('HandlerRegistry', () => {
  it('registers and retrieves handlers by kind', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler });
    expect(r.get('a')?.kind).toBe('a');
    expect(r.get('missing')).toBeUndefined();
  });

  it('throws on duplicate kind', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler });
    expect(() => r.register({ kind: 'a', handler: noopHandler })).toThrow();
  });

  it('applies default concurrency=1 and timeoutSec=300', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler });
    const reg = r.get('a')!;
    expect(reg.concurrency).toBe(1);
    expect(reg.timeoutSec).toBe(300);
  });

  it('tracks in-flight count per kind', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler, concurrency: 2 });
    expect(r.canRun('a')).toBe(true);
    r.acquire('a');
    expect(r.canRun('a')).toBe(true); // 1 of 2
    r.acquire('a');
    expect(r.canRun('a')).toBe(false); // 2 of 2
    r.release('a');
    expect(r.canRun('a')).toBe(true);
  });

  it('canRun returns false for unregistered kind', () => {
    const r = new HandlerRegistry();
    expect(r.canRun('missing')).toBe(false);
  });

  it('returns kinds with available capacity', () => {
    const r = new HandlerRegistry();
    r.register({ kind: 'a', handler: noopHandler, concurrency: 1 });
    r.register({ kind: 'b', handler: noopHandler, concurrency: 1 });
    r.acquire('a');
    expect(r.kindsWithCapacity().sort()).toEqual(['b']);
  });
});
