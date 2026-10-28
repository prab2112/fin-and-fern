import { content } from '../content';
import { fishValue, isSick } from '../sim/fish';
import type { Fish, Tank } from '../sim/types';
import { wq as waterQuality } from '../sim/water';

/** How a fish reacts to its tank (GDD §14). Read by the swim model; never fed back to the sim. */
export interface Reactions {
  speedMul: number;
  /** Chances that the next thing it does is gasping at the surface, begging, or resting. */
  gaspP: number;
  begP: number;
  restP: number;
  /** 0..1, drives the breathing rate. */
  stress: number;
}

/** Runs at sync time (about once a second), not per frame. */
export function reactionsFor(f: Fish, tank: Tank): Reactions {
  const h = content.balance.health;
  const sp = content.speciesById[f.speciesId];
  const wq = waterQuality(tank.dirt);
  const wqLow = wq < h.wqProblemBelow;
  const wqSevere = wq < h.wqSevereBelow;
  const cold = sp ? tank.tempC < sp.tempMin : false;
  const hot = sp ? tank.tempC > sp.tempMax : false;
  const sick = isSick(f);
  const starving = f.hunger > h.hungerProblemAbove;
  const hungry = f.hunger > content.balance.alerts.hungerAbove;

  let speedMul = 1;
  if (sick) speedMul *= 0.45;
  if (cold) speedMul *= 0.6;
  if (starving) speedMul *= 0.8;
  if (hot) speedMul *= 1.1;
  if (wqSevere) speedMul *= 0.75;

  let gaspP = wqSevere ? 0.7 : wqLow ? 0.3 : 0;
  if (hot) gaspP += 0.25;
  const begP = sick ? 0 : starving ? 0.25 : hungry ? 0.45 : 0.03;
  const restP = sick ? 0.85 : starving ? 0.2 : cold ? 0.35 : 0;
  // Keep some time for ordinary swimming.
  const sum = gaspP + begP + restP;
  const k = sum > 0.95 ? 0.95 / sum : 1;

  const stress = Math.min(
    1,
    Math.max(
      wqLow ? (h.wqProblemBelow - wq) / h.wqProblemBelow + 0.3 : 0,
      hot ? 0.6 : 0,
      sick ? 0.5 : 0,
    ),
  );
  return { speedMul, gaspP: gaspP * k, begP: begP * k, restP: restP * k, stress };
}

/** GDD §14 safeguard: past `max` fish, draw the most valuable ones. */
export function pickShown(fish: readonly Fish[], max: number): readonly Fish[] {
  if (fish.length <= max) return fish;
  const price = (f: Fish) => content.speciesById[f.speciesId]?.basePrice ?? 0;
  return [...fish].sort((a, b) => fishValue(b, price(b)) - fishValue(a, price(a))).slice(0, max);
}
