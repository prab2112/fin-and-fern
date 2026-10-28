import { describe, expect, it } from 'vitest';
import { pickShown, reactionsFor } from '../../src/render/reactions';
import { newGame } from '../../src/sim/newGame';
import type { Fish, Tank } from '../../src/sim/types';

const tankA = (over: Partial<Tank> = {}): Tank => ({ ...(newGame(1).tanks[0] as Tank), ...over });
const guppy = (over: Partial<Fish> = {}): Fish => ({
  id: 1,
  speciesId: 'guppy',
  sex: 'F',
  ageH: 100,
  genes: { locus1: ['wild', 'wild'], locus2: ['normal', 'normal'] },
  hp: 100,
  hunger: 30,
  origin: 'bought',
  cooldownUntilH: 0,
  ...over,
});

describe('fish reactions to the tank (GDD §14)', () => {
  it('a content fish in clean water just swims', () => {
    expect(reactionsFor(guppy(), tankA())).toMatchObject({
      speedMul: 1,
      gaspP: 0,
      restP: 0,
      stress: 0,
    });
  });

  it('hunger > 60: begs at the glass; > 80: begs less, rests some, slows', () => {
    expect(reactionsFor(guppy({ hunger: 61 }), tankA()).begP).toBeCloseTo(0.45, 9);
    const starving = reactionsFor(guppy({ hunger: 81 }), tankA());
    expect(starving.begP).toBeCloseTo(0.25, 9);
    expect(starving.restP).toBeCloseTo(0.2, 9);
    expect(starving.speedMul).toBeCloseTo(0.8, 9);
  });

  it('WQ < 50: gasps at the surface and breathes faster; WQ < 25: much more, and slower', () => {
    const dirty = reactionsFor(guppy(), tankA({ dirt: 55 }));
    expect(dirty.gaspP).toBeCloseTo(0.3, 9);
    expect(dirty.stress).toBeGreaterThan(0.3);
    const foul = reactionsFor(guppy(), tankA({ dirt: 80 }));
    expect(foul.gaspP).toBeCloseTo(0.7, 9);
    expect(foul.speedMul).toBeCloseTo(0.75, 9);
    expect(reactionsFor(guppy(), tankA({ dirt: 49 })).gaspP).toBe(0);
  });

  it('outside its temperature range: sluggish and resting when cold, gasping when hot', () => {
    const discus: Fish = guppy({
      speciesId: 'discus',
      genes: { locus1: ['brown', 'brown'], locus2: ['plain', 'plain'] },
    });
    const cold = reactionsFor(discus, tankA({ tempC: 25 }));
    expect(cold.speedMul).toBeCloseTo(0.6, 9);
    expect(cold.restP).toBeCloseTo(0.35, 9);
    const hot = reactionsFor(guppy(), tankA({ tempC: 29 }));
    expect(hot.gaspP).toBeCloseTo(0.25, 9);
    expect(hot.speedMul).toBeCloseTo(1.1, 9);
  });

  it('sick (HP < 40): rests, slow, never begs', () => {
    const sick = reactionsFor(guppy({ hp: 30, hunger: 70 }), tankA());
    expect(sick.restP).toBeGreaterThan(0.8);
    expect(sick.speedMul).toBeCloseTo(0.45, 9);
    expect(sick.begP).toBe(0);
  });

  it('the chances of the three moods never add up to more than 0.95', () => {
    const r = reactionsFor(guppy({ hp: 10, hunger: 90 }), tankA({ dirt: 90, tempC: 35 }));
    expect(r.gaspP + r.begP + r.restP).toBeLessThanOrEqual(0.95 + 1e-9);
  });
});

describe('draw cap (GDD §14 safeguard)', () => {
  it('keeps every fish when there are 60 or fewer', () => {
    const fish = Array.from({ length: 60 }, (_, i) => guppy({ id: i }));
    expect(pickShown(fish, 60)).toBe(fish);
  });

  it('draws the 60 most valuable when there are more', () => {
    const plain = Array.from({ length: 65 }, (_, i) => guppy({ id: i }));
    const albino = guppy({
      id: 999,
      genes: { locus1: ['albino', 'albino'], locus2: ['fancy', 'fancy'] },
    });
    const shown = pickShown([...plain, albino], 60);
    expect(shown).toHaveLength(60);
    expect(shown.map((f) => f.id)).toContain(999);
  });
});
