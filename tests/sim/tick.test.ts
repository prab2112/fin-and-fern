import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/sim/actions';
import { newGame } from '../../src/sim/newGame';
import { createRng } from '../../src/sim/rng';
import { tick } from '../../src/sim/tick';
import type { Fish, GameState, Tank } from '../../src/sim/types';

const rng = () => createRng(1);
const tankA = (s: GameState): Tank => s.tanks[0] as Tank;
const tankB = (s: GameState): Tank => s.tanks[1] as Tank;
const withTankA = (s: GameState, over: Partial<Tank>): GameState => ({
  ...s,
  tanks: [{ ...tankA(s), ...over }, tankB(s)],
});
const guppy = (id: number, over: Partial<Fish> = {}): Fish => ({
  id,
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

describe('tick', () => {
  it('advances game time in 0.1 h steps and does not mutate its input', () => {
    const s0 = newGame(1);
    const snapshot = JSON.stringify(s0);
    const s1 = tick(s0, 1, rng());
    expect(s1.gameHours).toBeCloseTo(1, 9);
    expect(JSON.stringify(s0)).toBe(snapshot);
    expect(tankA(s1).fish[0]?.hunger).toBeCloseTo(23, 9);
  });

  it('starting Tank A gets dirtier at 0.4/h (load 4, filter L1, 2 ferns)', () => {
    const s = tick(newGame(1), 10, rng());
    expect(tankA(s).dirt).toBeCloseTo(4, 6);
    expect(tankB(s).dirt).toBe(0);
  });

  it('idle start: first death after hunger passes 80 at 20 h plus 50 h of −2 HP (≈ 70 h)', () => {
    let s = newGame(1);
    let firstDeathH: number | null = null;
    const r = rng();
    while (firstDeathH === null && s.gameHours < 200) {
      s = tick(s, 0.1, r);
      if (s.events.some((e) => e.type === 'death')) firstDeathH = s.gameHours;
    }
    expect(firstDeathH).toBeGreaterThan(69.5);
    expect(firstDeathH).toBeLessThan(70.5);
    expect(firstDeathH).toBeGreaterThanOrEqual(48);
  });

  it('death removes the body, raises D by 2 × size and emits an event', () => {
    const s0 = withTankA(newGame(1), {
      fish: [guppy(100, { hp: 0.1, hunger: 100 }), guppy(101)],
      dirt: 10,
      plants: [],
    });
    const s1 = tick(s0, 0.1, rng());
    expect(tankA(s1).fish.map((f) => f.id)).toEqual([101]);
    // 0.1 h of dirt from load 2 (0.08 − 0.1 → −0.02) plus 2 × size 1.
    expect(tankA(s1).dirt).toBeCloseTo(10 - 0.02 + 2, 6);
    expect(s1.events).toContainEqual({
      type: 'death',
      tankId: tankA(s0).id,
      fishId: 100,
      speciesId: 'guppy',
    });
    expect(s1.stats.deaths).toBe(1);
  });

  it('WQ < 25 costs −5 HP per hour in a real tank', () => {
    const s0 = withTankA(newGame(1), { fish: [guppy(100, { hp: 50 })], dirt: 80, plants: [] });
    const s1 = tick(s0, 1, rng());
    expect(tankA(s1).fish[0]?.hp).toBeCloseTo(45, 6);
  });

  it('emits a threshold alert once when crossing, not every step', () => {
    let s = withTankA(newGame(1), { fish: [guppy(100, { hunger: 59 })] });
    const r = rng();
    const alerts: string[] = [];
    for (let i = 0; i < 20; i++) {
      s = tick(s, 0.1, r);
      for (const e of s.events) if (e.type === 'alert') alerts.push(e.kind);
    }
    expect(alerts).toEqual(['hunger']);
  });

  it('the stored pregnancy does nothing in M1', () => {
    const s = tick(newGame(1), 40, rng());
    expect(tankA(s).fish).toHaveLength(4);
    expect(tankA(s).fish[0]?.pregnancy?.dueAtH).toBe(30);
  });
});

describe('actions (GDD §4)', () => {
  it('feed: hunger to 0, uses max(1, ceil(load / 4)) food', () => {
    const s0 = tick(newGame(1), 10, rng());
    const s1 = applyAction(s0, { type: 'feed', tankId: tankA(s0).id }, rng());
    expect(tankA(s1).fish.every((f) => f.hunger === 0)).toBe(true);
    expect(s1.food).toBe(49);
    const crowded = withTankA(s0, {
      fish: Array.from({ length: 44 }, (_, i) => guppy(200 + i, { hunger: 50 })),
    });
    expect(applyAction(crowded, { type: 'feed', tankId: tankA(s0).id }, rng()).food).toBe(50 - 11);
  });

  it('overfeeding: mean hunger below 20 adds 5 dirt', () => {
    const s0 = withTankA(newGame(1), {
      fish: [guppy(1, { hunger: 10 }), guppy(2, { hunger: 31 })],
      dirt: 3,
    });
    expect(tankA(applyAction(s0, { type: 'feed', tankId: 1 }, rng())).dirt).toBe(3);
    const s1 = withTankA(s0, { fish: [guppy(1, { hunger: 10 }), guppy(2, { hunger: 20 })] });
    expect(tankA(applyAction(s1, { type: 'feed', tankId: 1 }, rng())).dirt).toBe(8);
  });

  it('feed is rejected with no food or no fish', () => {
    const s0 = { ...newGame(1), food: 0 };
    const s1 = applyAction(s0, { type: 'feed', tankId: tankA(s0).id }, rng());
    expect(s1.events).toEqual([{ type: 'rejected', action: 'feed', reason: 'noFood' }]);
    expect(tankA(s1).fish[0]?.hunger).toBe(20);
    const s2 = applyAction(newGame(1), { type: 'feed', tankId: tankB(s0).id }, rng());
    expect(s2.events).toEqual([{ type: 'rejected', action: 'feed', reason: 'empty' }]);
    expect(s2.food).toBe(50);
  });

  it('water change halves D with a 1 game-hour cooldown per tank', () => {
    const s0 = withTankA(newGame(1), { dirt: 40 });
    const s1 = applyAction(s0, { type: 'waterChange', tankId: 1 }, rng());
    expect(tankA(s1).dirt).toBe(20);
    const s2 = applyAction(s1, { type: 'waterChange', tankId: 1 }, rng());
    expect(tankA(s2).dirt).toBe(20);
    expect(s2.events).toEqual([{ type: 'rejected', action: 'waterChange', reason: 'cooldown' }]);
    const s3 = applyAction(tick(s2, 1, rng()), { type: 'waterChange', tankId: 1 }, rng());
    expect(tankA(s3).dirt).toBeLessThan(15);
  });

  it('heater setpoint is rejected without a heater and clamped with one; T follows', () => {
    const s0 = newGame(1);
    expect(
      applyAction(s0, { type: 'setHeaterSetpoint', tankId: 1, c: 27 }, rng()).events[0],
    ).toMatchObject({
      type: 'rejected',
      reason: 'noHeater',
    });
    const heated = withTankA(s0, { heaterLevel: 1 });
    const s1 = applyAction(heated, { type: 'setHeaterSetpoint', tankId: 1, c: 30 }, rng());
    expect(tankA(s1).setpointC).toBe(27);
    expect(tankA(tick(s1, 1, rng())).tempC).toBeCloseTo(26, 6);
    expect(tankA(tick(s1, 5, rng())).tempC).toBe(27);
  });

  it('setSpeed', () => {
    expect(applyAction(newGame(1), { type: 'setSpeed', speed: 2 }, rng()).speed).toBe(2);
    expect(applyAction(newGame(1), { type: 'setSpeed', speed: 0 }, rng()).speed).toBe(0);
  });

  it('unknown tanks are rejected', () => {
    expect(applyAction(newGame(1), { type: 'feed', tankId: 999 }, rng()).events[0]).toMatchObject({
      reason: 'noTank',
    });
  });
});

describe('debug actions', () => {
  it('spawns 40 adult wholesale guppies deterministically and advances the rng state', () => {
    const s0 = newGame(1);
    const s1 = applyAction(
      s0,
      { type: 'debugSpawnFish', tankId: tankB(s0).id, speciesId: 'guppy', count: 40 },
      createRng(7, s0.rngState),
    );
    const s2 = applyAction(
      s0,
      { type: 'debugSpawnFish', tankId: tankB(s0).id, speciesId: 'guppy', count: 40 },
      createRng(7, s0.rngState),
    );
    expect(tankB(s1).fish).toHaveLength(40);
    expect(s1).toEqual(s2);
    expect(s1.rngState).not.toBe(s0.rngState);
    expect(new Set(tankB(s1).fish.map((f) => f.id)).size).toBe(40);
    expect(tankB(s1).fish.every((f) => f.ageH >= 72 && f.hp === 100)).toBe(true);
  });

  it('advances one game day', () => {
    const s = applyAction(newGame(1), { type: 'debugAdvanceHours', hours: 24 }, rng());
    expect(s.gameHours).toBeCloseTo(24, 6);
  });

  it('adds food', () => {
    expect(applyAction(newGame(1), { type: 'debugAddFood', units: 50 }, rng()).food).toBe(100);
  });

  it('dirties the water, clamped at 100', () => {
    const s0 = withTankA(newGame(1), { dirt: 80 });
    expect(
      tankA(applyAction(s0, { type: 'debugAddDirt', tankId: 1, amount: 30 }, rng())).dirt,
    ).toBe(100);
    expect(
      tankA(applyAction(newGame(1), { type: 'debugAddDirt', tankId: 1, amount: 30 }, rng())).dirt,
    ).toBe(30);
  });

  it('debug values are clamped so the save stays valid', () => {
    const clean = applyAction(
      withTankA(newGame(1), { dirt: 10 }),
      { type: 'debugAddDirt', tankId: 1, amount: -50 },
      rng(),
    );
    expect(tankA(clean).dirt).toBe(0);
    expect(
      tankA(applyAction(newGame(1), { type: 'debugSickFish', tankId: 1, hp: -5 }, rng())).fish[0]
        ?.hp,
    ).toBe(0);
    expect(
      tankA(applyAction(newGame(1), { type: 'debugSickFish', tankId: 1, hp: 500 }, rng())).fish[0]
        ?.hp,
    ).toBe(100);
  });

  it('makes the first fish in a tank sick', () => {
    const s = applyAction(newGame(1), { type: 'debugSickFish', tankId: 1, hp: 30 }, rng());
    expect(tankA(s).fish[0]?.hp).toBe(30);
    expect(tankA(s).fish[1]?.hp).toBe(100);
    expect(
      applyAction(
        newGame(1),
        { type: 'debugSickFish', tankId: tankB(newGame(1)).id, hp: 30 },
        rng(),
      ).events[0],
    ).toMatchObject({ reason: 'empty' });
  });
});
