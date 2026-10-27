import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { advanceAccumulator, clockOf, gameDay, perStepProbability } from '../../src/sim/time';

describe('perStepProbability (GDD §1)', () => {
  it('compounds back to the daily probability', () => {
    const p = perStepProbability(0.3, 0.1);
    expect(1 - (1 - p) ** 240).toBeCloseTo(0.3, 12);
  });

  it('mean of 100k steps matches the per-step chance', () => {
    const p = perStepProbability(0.3, 0.1);
    const rng = createRng(1234);
    let hits = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) if (rng.next() < p) hits++;
    const mean = hits / n;
    // ±4 standard errors
    expect(Math.abs(mean - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / n));
  });

  it('daily rate over many simulated days ≈ P', () => {
    const P = 0.3;
    const p = perStepProbability(P, 0.1);
    const rng = createRng(5);
    let days = 0;
    let hitDays = 0;
    for (let d = 0; d < 20_000; d++) {
      let hit = false;
      for (let s = 0; s < 240; s++) if (rng.next() < p) hit = true;
      days++;
      if (hit) hitDays++;
    }
    expect(hitDays / days).toBeCloseTo(P, 2);
  });
});

describe('advanceAccumulator (GDD §1: 1 game h = 10 real s at 1×)', () => {
  it('runs one 0.1 h step per real second at 1×', () => {
    const r = advanceAccumulator(0, 1, 1, 10, 0.1);
    expect(r.steps).toBe(1);
    expect(r.acc).toBeCloseTo(0, 9);
  });

  it('runs two steps per real second at 2×', () => {
    expect(advanceAccumulator(0, 1, 2, 10, 0.1).steps).toBe(2);
  });

  it('keeps the remainder', () => {
    const r = advanceAccumulator(0, 0.5, 1, 10, 0.1);
    expect(r.steps).toBe(0);
    expect(r.acc).toBeCloseTo(0.05, 9);
    expect(advanceAccumulator(r.acc, 0.5, 1, 10, 0.1).steps).toBe(1);
  });

  it('does nothing when paused', () => {
    expect(advanceAccumulator(0.05, 10, 0, 10, 0.1)).toEqual({ steps: 0, acc: 0.05 });
  });
});

describe('game calendar', () => {
  it('derives day and clock from game hours', () => {
    expect(gameDay(0)).toBe(1);
    expect(gameDay(23.99)).toBe(1);
    expect(gameDay(24)).toBe(2);
    expect(clockOf(30.5)).toEqual({ hh: 6, mm: 30 });
  });
});
