import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/sim/newGame';

describe('newGame (GDD §2)', () => {
  const s = newGame(1);

  it('starts with ₹1,000, 0 rep, Lv1, 50 food, at game hour 0, 1× speed', () => {
    expect(s).toMatchObject({
      money: 1000,
      rep: 0,
      level: 1,
      xp: 0,
      food: 50,
      gameHours: 0,
      speed: 1,
    });
  });

  it('has two clean 40 L tanks at room temperature', () => {
    expect(s.tanks.map((t) => t.name)).toEqual(['Tank A', 'Tank B']);
    for (const t of s.tanks) {
      expect(t).toMatchObject({ tankType: 't40', filterLevel: 1, heaterLevel: 0, lightLevel: 1 });
      expect(t.dirt).toBe(0);
      expect(t.tempC).toBe(25);
      expect(t.algae).toBe(0);
    }
    expect(s.tanks[0]?.plants).toEqual([
      { plantId: 'javafern', mass: 1 },
      { plantId: 'javafern', mass: 1 },
    ]);
    expect(s.tanks[1]?.fish).toEqual([]);
  });

  it('Tank A holds the 4 starter guppies at HP 100, hunger 20', () => {
    const fish = s.tanks[0]?.fish ?? [];
    expect(fish.map((f) => [f.sex, f.genes.locus1.join('/'), f.genes.locus2?.join('/')])).toEqual([
      ['F', 'wild/albino', 'normal/fancy'],
      ['F', 'wild/wild', 'normal/normal'],
      ['M', 'wild/blue', 'normal/normal'],
      ['M', 'wild/wild', 'normal/normal'],
    ]);
    for (const f of fish) expect(f).toMatchObject({ hp: 100, hunger: 20, origin: 'bought' });
    expect(new Set(fish.map((f) => f.id)).size).toBe(4);
  });

  it('Guppy 1 is pregnant by a W/A N/N sire, due at game hour 30', () => {
    expect(s.tanks[0]?.fish[0]?.pregnancy).toEqual({
      sireGenes: { locus1: ['wild', 'albino'], locus2: ['normal', 'normal'] },
      dueAtH: 30,
    });
  });

  it('is deterministic per seed and stores the rng state', () => {
    expect(newGame(1)).toEqual(newGame(1));
    expect(newGame(1).rngState).not.toBe(newGame(2).rngState);
  });
});
