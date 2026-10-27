import { describe, expect, it } from 'vitest';
import {
  capacity,
  clampSetpoint,
  cover,
  dirtRatePerH,
  stepDirt,
  stepTemp,
  tankLoad,
  targetTemp,
  waterChange,
  wq,
} from '../../src/sim/water';
import type { Fish } from '../../src/sim/types';

const adultGuppy = (id: number, ageH = 100): Fish => ({
  id,
  speciesId: 'guppy',
  sex: 'F',
  ageH,
  genes: { locus1: ['wild', 'wild'], locus2: ['normal', 'normal'] },
  hp: 100,
  hunger: 0,
  origin: 'bought',
  cooldownUntilH: 0,
});

/** Integrates ΔD over `hours` with 0.1 h steps, as the tick does. */
const runDirt = (d0: number, ratePerH: number, hours: number) => {
  let d = d0;
  for (let i = 0; i < Math.round(hours / 0.1); i++) d = stepDirt(d, ratePerH, 0.1);
  return d;
};

describe('water quality (GDD §4 worked examples)', () => {
  it('40 L, 6 adult guppies, filter L1, no plants: ΔD = 1.4/h; after 24 h D = 33.6, WQ = 66.4', () => {
    const load = tankLoad(Array.from({ length: 6 }, (_, i) => adultGuppy(i)));
    expect(load).toBe(6);
    const rate = dirtRatePerH(load, 1, 0, 40);
    expect(rate).toBeCloseTo(1.4, 10);
    const d = runDirt(0, rate, 24);
    expect(d).toBeCloseTo(33.6, 6);
    expect(wq(d)).toBeCloseTo(66.4, 6);
  });

  it('40 L, 6 guppies, filter L2, plantMass 4.0: ΔD = 0, the tank holds steady', () => {
    const rate = dirtRatePerH(6, 2, 4, 40);
    expect(rate).toBeCloseTo(0, 10);
    expect(runDirt(20, rate, 48)).toBeCloseTo(20, 6);
  });

  it('100 L, load 10, filter L2, plantMass 2.0: ΔD = 0.72/h', () => {
    expect(dirtRatePerH(10, 2, 2, 100)).toBeCloseTo(0.72, 10);
  });

  it('clamps D to [0, 100]', () => {
    expect(runDirt(1, -5, 1)).toBe(0);
    expect(runDirt(99, 50, 1)).toBe(100);
  });

  it('water change halves D', () => {
    expect(waterChange(33.6)).toBeCloseTo(16.8, 10);
  });
});

describe('capacity, load and cover (GDD §3, §7)', () => {
  it('capacity = V / 5', () => {
    expect(capacity(40)).toBe(8);
    expect(capacity(100)).toBe(20);
    expect(capacity(300)).toBe(60);
  });

  it('load scales by stage: fry 0.2, juvenile 0.5, adult 1.0', () => {
    expect(tankLoad([adultGuppy(1, 10), adultGuppy(2, 30), adultGuppy(3, 72)])).toBeCloseTo(
      1.7,
      10,
    );
  });

  it('2 Java Ferns in 40 L → cover 0.5; moss counts ×2; capped at 1', () => {
    const ferns = [
      { plantId: 'javafern', mass: 1 },
      { plantId: 'javafern', mass: 1 },
    ];
    expect(cover(ferns, 40)).toBeCloseTo(0.5, 10);
    expect(cover([{ plantId: 'moss', mass: 1 }], 40)).toBeCloseTo(0.5, 10);
    expect(cover([...ferns, ...ferns, ...ferns], 40)).toBe(1);
  });
});

describe('temperature (GDD §4)', () => {
  it('without a heater the target is room temperature (25 °C)', () => {
    expect(targetTemp(0, 30)).toBe(25);
  });

  it('with a heater the target is max(room, setpoint)', () => {
    expect(targetTemp(1, 27)).toBe(27);
    expect(targetTemp(1, 20)).toBe(25);
  });

  it('moves toward the target at 1 °C per game hour without overshooting', () => {
    let t = 25;
    for (let i = 0; i < 10; i++) t = stepTemp(t, 27, 0.1);
    expect(t).toBeCloseTo(26, 9);
    for (let i = 0; i < 30; i++) t = stepTemp(t, 27, 0.1);
    expect(t).toBe(27);
    for (let i = 0; i < 10; i++) t = stepTemp(t, 25, 0.1);
    expect(t).toBeCloseTo(26, 9);
  });

  it('the setpoint is limited to the heater maximum (L1 27, L2 29, L3 31)', () => {
    expect(clampSetpoint(1, 35)).toBe(27);
    expect(clampSetpoint(2, 35)).toBe(29);
    expect(clampSetpoint(3, 30)).toBe(30);
    expect(clampSetpoint(3, 10)).toBe(25);
    expect(clampSetpoint(0, 30)).toBe(25);
  });
});
