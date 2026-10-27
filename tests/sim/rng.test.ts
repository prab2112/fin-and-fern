import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('rng (mulberry32)', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 20 }, () => a.next());
    const ys = Array.from({ length: 20 }, () => b.next());
    expect(xs).toEqual(ys);
  });

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('returns values in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('resumes from a saved state', () => {
    const a = createRng(99);
    a.next();
    a.next();
    const b = createRng(0, a.getState());
    expect(b.next()).toBe(a.next());
  });

  it('int() is inclusive and covers the range', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) seen.add(r.int(6, 20));
    expect([...seen].sort((x, y) => x - y)).toEqual(Array.from({ length: 15 }, (_, i) => i + 6));
  });
});
