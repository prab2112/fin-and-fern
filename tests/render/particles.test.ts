import { describe, expect, it } from 'vitest';
import { Particles } from '../../src/render/particles';
import { floorY, makeView, resizeView } from '../../src/render/projection';
import { createRng } from '../../src/sim/rng';

describe('food flakes', () => {
  it('float, then sink, settle on the gravel and are gone after a while', () => {
    const v = makeView();
    resizeView(v, 328, 450);
    const p = new Particles(createRng(3).next);
    p.dropFood(12, v);
    expect(p.liveFlakes()).toBe(12);
    const f = p.flakes.find((x) => x.alive);
    if (!f) throw new Error('no flake');
    expect(f.y).toBeLessThan(v.surface + 1);
    const step = (seconds: number) => {
      for (let k = 0; k < seconds * 60; k++) p.step(1 / 60, v, null, 0);
    };
    step(0.5);
    expect(f.phase).toBe(0);
    step(60);
    expect(f.settled).toBe(true);
    expect(f.y).toBeCloseTo(floorY(v, f.z) - 0.5, 6);
    step(30);
    expect(p.liveFlakes()).toBe(0);
  });
});
