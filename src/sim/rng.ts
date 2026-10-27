/** Seeded PRNG (mulberry32). The state is a uint32 that can be saved and resumed. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  getState(): number;
}

export function createRng(seed: number, state?: number): Rng {
  let s = (state ?? seed) >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty list');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    getState: () => s,
  };
}
