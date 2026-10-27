import { content } from './content';
import { stageFactor } from './stage';
import type { Fish, PlantInstance, Tank } from './types';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function tankVolume(tank: Tank): number {
  return content.tankTypeById[tank.tankType]?.volumeL ?? 0;
}

/** GDD §3: capacity = V / 5 size units. */
export function capacity(volumeL: number): number {
  return volumeL / content.balance.tank.litresPerCapacityUnit;
}

/** Size of one fish in load units (species size × stage factor). */
export function fishLoad(fish: Fish): number {
  const size = content.speciesById[fish.speciesId]?.size ?? 0;
  return size * stageFactor(fish.ageH);
}

/** GDD §3: load = Σ speciesSize × stageFactor. */
export function tankLoad(fish: readonly Fish[]): number {
  let load = 0;
  for (const f of fish) load += fishLoad(f);
  return load;
}

export function plantMass(plants: readonly PlantInstance[]): number {
  let m = 0;
  for (const p of plants) m += p.mass;
  return m;
}

/** GDD §7: cover = min(1, Σ effectiveMass / (V / 10)); moss counts ×2. */
export function cover(plants: readonly PlantInstance[], volumeL: number): number {
  let eff = 0;
  for (const p of plants) eff += p.mass * (content.plantById[p.plantId]?.coverMult ?? 1);
  return Math.min(1, eff / (volumeL / content.balance.plants.coverLitresPerMass));
}

/** GDD §4: ΔD per game hour = (0.4 × load − filterPower − 0.1 × plantMass) × 40 / V. */
export function dirtRatePerH(
  load: number,
  filterPower: number,
  plantMassTotal: number,
  volumeL: number,
): number {
  const w = content.balance.water;
  return (
    ((w.loadCoef * load - filterPower - w.plantCoef * plantMassTotal) * w.refVolumeL) / volumeL
  );
}

export function stepDirt(dirt: number, ratePerH: number, dtH: number): number {
  return clamp(dirt + ratePerH * dtH, 0, 100);
}

export function wq(dirt: number): number {
  return 100 - dirt;
}

/** GDD §4: water change D ← D / 2. */
export function waterChange(dirt: number): number {
  return dirt * content.balance.water.waterChangeFactor;
}

export function filterPower(level: number): number {
  return content.equipment.filters.find((f) => f.level === level)?.power ?? 0;
}

/** Heater max setpoint, or null when the tank has no heater. */
export function heaterMaxC(level: number): number | null {
  return content.equipment.heaters.find((h) => h.level === level)?.maxC ?? null;
}

/** GDD §4: target = max(ROOM_T, setpoint) with a heater, else ROOM_T. */
export function targetTemp(heaterLevel: number, setpointC: number): number {
  const room = content.balance.temperature.roomC;
  return heaterMaxC(heaterLevel) === null ? room : Math.max(room, setpointC);
}

/** GDD §4: setpoint goes up to the heater's maximum (and never below room). */
export function clampSetpoint(heaterLevel: number, c: number): number {
  const room = content.balance.temperature.roomC;
  const max = heaterMaxC(heaterLevel);
  return max === null ? room : clamp(c, room, max);
}

/** GDD §4: T moves toward its target at 1 °C per game hour. */
export function stepTemp(t: number, target: number, dtH: number): number {
  const maxMove = content.balance.temperature.ratePerH * dtH;
  const diff = target - t;
  if (Math.abs(diff) <= maxMove) return target;
  return t + Math.sign(diff) * maxMove;
}
