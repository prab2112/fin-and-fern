import { describe, expect, it } from 'vitest';
import { floorY, makeView, resizeView, screenX, screenY } from '../../src/render/projection';
import { MODE, Swimmers, wrapAngle, type Flake } from '../../src/render/swim';
import { TEMPERAMENT, type Temperament } from '../../src/render/temperament';
import { createRng } from '../../src/sim/rng';

const view = () => {
  const v = makeView();
  resizeView(v, 328, 450);
  return v;
};
const temper = (id: string): Temperament => {
  const t = TEMPERAMENT[id];
  if (!t) throw new Error(id);
  return t;
};
const DT = 1 / 60;
const NO_FOOD: Flake[] = [];

function school(id: string, n: number, seed = 1, over: Partial<Temperament> = {}) {
  const v = view();
  const s = new Swimmers(createRng(seed).next);
  const t = { ...temper(id), ...over };
  for (let i = 0; i < n; i++) s.add(1, 22, t, v);
  return { v, s };
}

/** Mean of `f` sampled every frame over `seconds`. */
function sample(
  s: Swimmers,
  v: ReturnType<typeof view>,
  seconds: number,
  f: () => number,
  food = NO_FOOD,
) {
  // Let the group settle into its behaviour before measuring.
  for (let k = 0; k < 20 / DT; k++) s.step(DT, v, food);
  let sum = 0;
  const n = Math.round(seconds / DT);
  for (let k = 0; k < n; k++) {
    s.step(DT, v, food);
    sum += f();
  }
  return sum / n;
}

/** 0 at the surface, 1 at the gravel, averaged over the group. */
const depthFrac = (s: Swimmers, v: ReturnType<typeof view>) => () => {
  let sum = 0;
  for (let i = 0; i < s.count; i++) {
    const f = s.fish[i];
    if (!f) continue;
    sum += (f.y - v.surface) / (floorY(v, f.z) - v.surface);
  }
  return sum / s.count;
};

describe('swimmers', () => {
  it('every species stays inside the tank', () => {
    for (const id of Object.keys(TEMPERAMENT)) {
      const { v, s } = school(id, 6, 3);
      for (let k = 0; k < 60 / DT; k++) {
        s.step(DT, v, NO_FOOD);
        for (let i = 0; i < s.count; i++) {
          const f = s.fish[i];
          if (!f) continue;
          expect(f.x, id).toBeGreaterThanOrEqual(0);
          expect(f.x, id).toBeLessThanOrEqual(v.w);
          expect(f.z, id).toBeGreaterThanOrEqual(0);
          expect(f.z, id).toBeLessThanOrEqual(v.depth);
          expect(f.y, id).toBeGreaterThanOrEqual(v.surface);
          expect(f.y, id).toBeLessThanOrEqual(floorY(v, f.z));
        }
      }
    }
  });

  it('turns smoothly: heading never jumps faster than the turn rate', () => {
    for (const id of ['guppy', 'danio', 'discus']) {
      const { v, s } = school(id, 5, 7);
      const t = temper(id);
      const prev = s.fish.slice(0, s.count).map((f) => f.yaw);
      for (let k = 0; k < 30 / DT; k++) {
        s.step(DT, v, NO_FOOD);
        for (let i = 0; i < s.count; i++) {
          const f = s.fish[i];
          if (!f) continue;
          expect(Math.abs(wrapAngle(f.yaw - (prev[i] as number))), id).toBeLessThanOrEqual(
            t.turnRate * DT + 1e-6,
          );
          prev[i] = f.yaw;
        }
      }
    }
  });

  it('fish actually travel around the tank, not just sit still', () => {
    const { v, s } = school('guppy', 4, 5);
    const f = s.fish[0];
    if (!f) throw new Error('no fish');
    let minX = Infinity;
    let maxX = -Infinity;
    for (let k = 0; k < 60 / DT; k++) {
      s.step(DT, v, NO_FOOD);
      minX = Math.min(minX, f.x);
      maxX = Math.max(maxX, f.x);
    }
    expect(maxX - minX).toBeGreaterThan(v.w * 0.4);
  });

  it('danios school: the group stays tighter than the same fish with schooling off', () => {
    const spread = (sch: number) => {
      const { v, s } = school('danio', 8, 11, { school: sch });
      return sample(s, v, 40, () => {
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let i = 0; i < s.count; i++) {
          const f = s.fish[i];
          if (!f) continue;
          cx += f.x;
          cy += f.y;
          cz += f.z;
        }
        cx /= s.count;
        cy /= s.count;
        cz /= s.count;
        let d = 0;
        for (let i = 0; i < s.count; i++) {
          const f = s.fish[i];
          if (!f) continue;
          d += Math.hypot(f.x - cx, f.y - cy, f.z - cz);
        }
        return d / s.count;
      });
    };
    expect(spread(1)).toBeLessThan(spread(0) * 0.75);
  });

  it('feeding: fish chase and eat the flakes', () => {
    const { v, s } = school('guppy', 6, 2);
    const rng = createRng(9);
    const flakes: Flake[] = Array.from({ length: 18 }, () => ({
      alive: true,
      settled: false,
      x: v.w * (0.2 + 0.6 * rng.next()),
      y: v.surface + 4,
      z: v.depth * (0.2 + 0.5 * rng.next()),
    }));
    for (let k = 0; k < 40 / DT; k++) s.step(DT, v, flakes);
    expect(flakes.filter((f) => f.alive).length).toBeLessThanOrEqual(2);
  });

  it('a tap on the glass startles nearby fish into a burst away', () => {
    const { v, s } = school('guppy', 3, 4);
    for (let k = 0; k < 60; k++) s.step(DT, v, NO_FOOD);
    const f = s.fish[0];
    if (!f) throw new Error('no fish');
    s.poke(screenX(v, f.x, f.z) + 10, screenY(v, f.y, f.z), v);
    expect(f.mode).toBe(MODE.flee);
    const before = f.speed;
    for (let k = 0; k < 12; k++) s.step(DT, v, NO_FOOD);
    expect(f.speed).toBeGreaterThan(Math.max(before, temper('guppy').cruise * f.len));
  });

  it('sick fish rest near the bottom; healthy guppies swim higher', () => {
    const healthy = school('guppy', 6, 6);
    const sick = school('guppy', 6, 6);
    for (let i = 0; i < sick.s.count; i++) sick.s.setEnv(i, 0.45, 0, 0, 0.9, 0.5);
    const h = sample(healthy.s, healthy.v, 60, depthFrac(healthy.s, healthy.v));
    const k = sample(sick.s, sick.v, 60, depthFrac(sick.s, sick.v));
    expect(k).toBeGreaterThan(0.75);
    expect(h).toBeLessThan(k - 0.2);
  });

  it('dirty water: fish gasp at the surface', () => {
    const clean = school('platy', 6, 8);
    const dirty = school('platy', 6, 8);
    for (let i = 0; i < dirty.s.count; i++) dirty.s.setEnv(i, 0.8, 0.75, 0, 0, 0.8);
    const c = sample(clean.s, clean.v, 60, depthFrac(clean.s, clean.v));
    const d = sample(dirty.s, dirty.v, 60, depthFrac(dirty.s, dirty.v));
    expect(d).toBeLessThan(c - 0.2);
  });

  it('hungry fish come to the front glass to beg', () => {
    const fed = school('molly', 6, 12);
    const hungry = school('molly', 6, 12);
    for (let i = 0; i < hungry.s.count; i++) hungry.s.setEnv(i, 1, 0, 0.6, 0, 0);
    const meanZ = (s: Swimmers) => () => {
      let z = 0;
      for (let i = 0; i < s.count; i++) z += s.fish[i]?.z ?? 0;
      return z / s.count;
    };
    const a = sample(fed.s, fed.v, 60, meanZ(fed.s));
    const b = sample(hungry.s, hungry.v, 60, meanZ(hungry.s));
    expect(b).toBeLessThan(a * 0.6);
  });

  it('removing a fish keeps the others intact', () => {
    const { v, s } = school('guppy', 3, 1);
    const last = s.fish[2];
    s.removeAt(0, v);
    expect(s.count).toBe(2);
    expect(s.fish[0]).toBe(last);
  });
});
