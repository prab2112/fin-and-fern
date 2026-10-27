import { describe, expect, it } from 'vitest';
import {
  fishValue,
  happinessScore,
  hpDeltaPerH,
  isSick,
  morphLabel,
  phenotype,
  problems,
  stepFish,
  tankHappiness,
} from '../../src/sim/fish';
import type { Fish, Tank } from '../../src/sim/types';

const fish = (over: Partial<Fish> = {}): Fish => ({
  id: 1,
  speciesId: 'guppy',
  sex: 'F',
  ageH: 100,
  genes: { locus1: ['wild', 'wild'], locus2: ['normal', 'normal'] },
  hp: 100,
  hunger: 0,
  origin: 'bought',
  cooldownUntilH: 0,
  ...over,
});

const ok = { wq: 100, tempC: 25, ich: false };

describe('hunger (GDD §4)', () => {
  it('rises 3 per game hour, capped at 100', () => {
    let f = fish({ hunger: 0 });
    for (let i = 0; i < 10; i++) f = stepFish(f, ok, 0.1);
    expect(f.hunger).toBeCloseTo(3, 9);
    f = stepFish(fish({ hunger: 99.9 }), ok, 0.1);
    f = stepFish(f, ok, 0.1);
    expect(f.hunger).toBe(100);
  });

  it('worked example: from a fresh feed, hunger passes 80 after 27 h and the fish dies after another 50 h (≈ 77 h)', () => {
    let f = fish({ hunger: 0 });
    let h = 0;
    let firstHungerProblemH: number | null = null;
    while (f.hp > 0 && h < 200) {
      f = stepFish(f, ok, 0.1);
      h += 0.1;
      if (firstHungerProblemH === null && f.hunger > 80) firstHungerProblemH = h;
    }
    expect(firstHungerProblemH).toBeGreaterThan(26.5);
    expect(firstHungerProblemH).toBeLessThanOrEqual(27);
    expect(h).toBeGreaterThan(76.5);
    expect(h).toBeLessThan(77.5);
  });

  it('ages the fish', () => {
    expect(stepFish(fish({ ageH: 10 }), ok, 0.1).ageH).toBeCloseTo(10.1, 9);
  });
});

describe('problems and HP (GDD §4)', () => {
  it('lists each true condition', () => {
    expect(problems(fish(), ok)).toEqual([]);
    expect(problems(fish({ hunger: 81 }), { wq: 40, tempC: 30, ich: true })).toEqual([
      'wq',
      'temp',
      'hunger',
      'ich',
    ]);
    expect(problems(fish({ hunger: 80 }), { ...ok, wq: 50, tempC: 28 })).toEqual([]);
    expect(problems(fish(), { ...ok, tempC: 21.9 })).toEqual(['temp']);
  });

  it('+1 HP per hour with no problems', () => {
    expect(hpDeltaPerH(fish(), ok)).toBe(1);
  });

  it('−2 per problem', () => {
    expect(hpDeltaPerH(fish({ hunger: 90 }), ok)).toBe(-2);
    expect(hpDeltaPerH(fish({ hunger: 90 }), { ...ok, wq: 40 })).toBe(-4);
    expect(hpDeltaPerH(fish({ hunger: 90 }), { ...ok, wq: 40, tempC: 35 })).toBe(-6);
  });

  it('WQ < 25 counts as −5 instead of −2', () => {
    expect(hpDeltaPerH(fish(), { ...ok, wq: 24.9 })).toBe(-5);
    expect(hpDeltaPerH(fish(), { ...ok, wq: 25 })).toBe(-2);
    expect(hpDeltaPerH(fish({ hunger: 90 }), { ...ok, wq: 10 })).toBe(-7);
  });

  it('Ich is −3', () => {
    expect(hpDeltaPerH(fish(), { ...ok, ich: true })).toBe(-3);
  });

  it('sensitive species (discus) take double damage but heal normally', () => {
    const d = fish({
      speciesId: 'discus',
      genes: { locus1: ['brown', 'brown'], locus2: ['plain', 'plain'] },
    });
    expect(hpDeltaPerH(d, { ...ok, tempC: 29 })).toBe(1);
    expect(hpDeltaPerH(d, { ...ok, tempC: 25 })).toBe(-4);
    expect(hpDeltaPerH(d, { ...ok, tempC: 29, wq: 20 })).toBe(-10);
  });

  it('HP is capped at 100 and a fish is sick below 40', () => {
    expect(stepFish(fish({ hp: 100 }), ok, 0.1).hp).toBe(100);
    expect(isSick(fish({ hp: 39.9 }))).toBe(true);
    expect(isSick(fish({ hp: 40 }))).toBe(false);
  });
});

describe('happiness (GDD §4)', () => {
  it('worked example: 40 L, 10 adult guppies, cover 0.5, no decor, WQ 60 → H = 60', () => {
    expect(
      happinessScore({
        cover: 0.5,
        decorCount: 0,
        load: 10,
        capacity: 8,
        schoolShort: false,
        conflict: false,
        wq: 60,
      }),
    ).toBeCloseTo(60, 9);
  });

  it('the same example from a real tank', () => {
    const t = tank({
      fish: Array.from({ length: 10 }, (_, i) => fish({ id: i })),
      plants: [
        { plantId: 'javafern', mass: 1 },
        { plantId: 'javafern', mass: 1 },
      ],
      dirt: 40,
    });
    expect(tankHappiness(t)).toBeCloseTo(60, 9);
  });

  it('applies school, conflict, WQ and decor terms and clamps to [0, 100]', () => {
    const base = {
      cover: 0,
      decorCount: 0,
      load: 4,
      capacity: 8,
      schoolShort: false,
      conflict: false,
      wq: 80,
    };
    expect(happinessScore(base)).toBe(70);
    expect(happinessScore({ ...base, decorCount: 5 })).toBe(85);
    expect(happinessScore({ ...base, schoolShort: true })).toBe(50);
    expect(happinessScore({ ...base, conflict: true })).toBe(40);
    expect(happinessScore({ ...base, wq: 49 })).toBe(60);
    expect(happinessScore({ ...base, load: 20 })).toBe(0);
    expect(happinessScore({ ...base, cover: 1, decorCount: 3 })).toBe(100);
    expect(happinessScore({ ...base, capacity: 0 })).toBe(70);
  });

  it('detects short schools and betta/flowerhorn conflict', () => {
    const danio = (id: number) =>
      fish({
        id,
        speciesId: 'danio',
        genes: { locus1: ['wild', 'wild'], locus2: ['short', 'short'] },
      });
    expect(tankHappiness(tank({ fish: [1, 2, 3].map(danio) }))).toBe(50);
    expect(tankHappiness(tank({ fish: [1, 2, 3, 4, 5, 6].map(danio) }))).toBe(70);
    const betta = (id: number, sex: 'F' | 'M') =>
      fish({
        id,
        sex,
        speciesId: 'betta',
        genes: { locus1: ['red', 'red'], locus2: ['veil', 'veil'] },
      });
    expect(tankHappiness(tank({ fish: [betta(1, 'M'), betta(2, 'M')] }))).toBe(40);
    expect(tankHappiness(tank({ fish: [betta(1, 'M'), betta(2, 'F')] }))).toBe(70);
    const fh = fish({
      id: 9,
      speciesId: 'flowerhorn',
      genes: { locus1: ['classic', 'classic'], locus2: ['small', 'small'] },
    });
    expect(tankHappiness(tank({ volumeL: 100, fish: [fh] }))).toBe(70);
    expect(tankHappiness(tank({ volumeL: 100, fish: [fh, fish({ id: 2 })] }))).toBe(40);
  });
});

describe('phenotype and value (GDD §5)', () => {
  it('expresses the first allele in dominance order', () => {
    expect(
      phenotype(fish({ genes: { locus1: ['albino', 'wild'], locus2: ['fancy', 'normal'] } })).map(
        (a) => a.id,
      ),
    ).toEqual(['wild', 'normal']);
    expect(
      phenotype(fish({ genes: { locus1: ['albino', 'blue'], locus2: ['fancy', 'fancy'] } })).map(
        (a) => a.id,
      ),
    ).toEqual(['blue', 'fancy']);
    expect(
      morphLabel(fish({ genes: { locus1: ['albino', 'albino'], locus2: ['fancy', 'fancy'] } })),
    ).toBe('Albino Fancy');
  });

  it('worked example: an adult Albino Fancy guppy at market ₹30 is worth ₹240', () => {
    const f = fish({ genes: { locus1: ['albino', 'albino'], locus2: ['fancy', 'fancy'] } });
    expect(fishValue(f, 30)).toBe(240);
  });

  it('juveniles are worth 50% and fry 0', () => {
    expect(fishValue(fish({ ageH: 30 }), 30)).toBe(15);
    expect(fishValue(fish({ ageH: 10 }), 30)).toBe(0);
  });
});

function tank(over: Partial<Tank> & { volumeL?: number } = {}): Tank {
  const { volumeL = 40, ...rest } = over;
  return {
    id: 1,
    name: 'T',
    tankType: volumeL === 100 ? 't100' : 't40',
    filterLevel: 1,
    heaterLevel: 0,
    lightLevel: 1,
    setpointC: 25,
    dirt: 0,
    tempC: 25,
    algae: 0,
    ich: false,
    decorCount: 0,
    plants: [],
    fish: [],
    waterChangeReadyAtH: 0,
    ...rest,
  };
}
