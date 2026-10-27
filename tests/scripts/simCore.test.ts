import { describe, expect, it } from 'vitest';
import { runSim, summarize } from '../../scripts/simCore';

describe('headless sim runner', () => {
  it('basic policy: zero deaths over 30 game days (GDD §17 #5)', () => {
    const r = runSim({ seed: 1, days: 30, policy: 'basic' });
    expect(r.deaths).toBe(0);
    expect(r.daily).toHaveLength(30);
    expect(Math.min(...r.daily.map((d) => d.minWq))).toBeGreaterThanOrEqual(50);
  });

  it('idle policy: first death no sooner than 2 game days (GDD §17 #6)', () => {
    const r = runSim({ seed: 1, days: 5, policy: 'idle' });
    expect(r.firstDeathH).not.toBeNull();
    expect(r.firstDeathH).toBeGreaterThanOrEqual(48);
  });

  it('is deterministic per seed', () => {
    expect(runSim({ seed: 3, days: 3, policy: 'basic' })).toEqual(
      runSim({ seed: 3, days: 3, policy: 'basic' }),
    );
  });

  it('summarize gives median, p10 and p90', () => {
    expect(summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({ median: 5.5, p10: 1.9, p90: 9.1 });
  });
});
