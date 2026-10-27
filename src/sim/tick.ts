import { content } from './content';
import { stepFish } from './fish';
import type { Rng } from './rng';
import type { Fish, GameState, SimEvent, Tank } from './types';
import {
  dirtRatePerH,
  filterPower,
  fishLoad,
  plantMass,
  stepDirt,
  stepTemp,
  tankLoad,
  tankVolume,
  targetTemp,
  wq,
} from './water';

const meanHunger = (fish: readonly Fish[]) =>
  fish.length === 0 ? 0 : fish.reduce((s, f) => s + f.hunger, 0) / fish.length;

/** One fixed step for one tank. Pushes events and returns the new tank and death count. */
function stepTank(tank: Tank, dtH: number, events: SimEvent[]): { tank: Tank; deaths: number } {
  const { balance } = content;
  const volumeL = tankVolume(tank);
  let dirt = stepDirt(
    tank.dirt,
    dirtRatePerH(
      tankLoad(tank.fish),
      filterPower(tank.filterLevel),
      plantMass(tank.plants),
      volumeL,
    ),
    dtH,
  );
  const tempC = stepTemp(tank.tempC, targetTemp(tank.heaterLevel, tank.setpointC), dtH);
  const env = { wq: wq(dirt), tempC, ich: tank.ich };

  const alive: Fish[] = [];
  let deaths = 0;
  for (const before of tank.fish) {
    const f = stepFish(before, env, dtH);
    if (f.hp <= 0) {
      // GDD §4: the body is removed and D rises by 2 × size (size scaled by stage, like load).
      dirt = Math.min(100, dirt + balance.water.deathDirtPerSize * fishLoad(f));
      deaths++;
      events.push({ type: 'death', tankId: tank.id, fishId: f.id, speciesId: f.speciesId });
      continue;
    }
    if (before.hp >= balance.alerts.hpBelow && f.hp < balance.alerts.hpBelow)
      events.push({ type: 'alert', kind: 'hp', tankId: tank.id, fishId: f.id });
    alive.push(f);
  }

  const a = balance.alerts;
  if (meanHunger(tank.fish) <= a.hungerAbove && meanHunger(alive) > a.hungerAbove)
    events.push({ type: 'alert', kind: 'hunger', tankId: tank.id });
  if (alive.length > 0 && wq(tank.dirt) >= a.wqBelow && wq(dirt) < a.wqBelow)
    events.push({ type: 'alert', kind: 'wq', tankId: tank.id });

  return { tank: { ...tank, dirt, tempC, fish: alive }, deaths };
}

/**
 * Advances the sim by dtHours in whole SIM_STEP_H steps (GDD §1).
 * Returns new state; `events` holds only what happened during this call.
 */
export function tick(state: GameState, dtHours: number, rng: Rng): GameState {
  const stepH = content.balance.time.simStepH;
  const steps = Math.round(dtHours / stepH);
  const events: SimEvent[] = [];
  let { gameHours, tanks } = state;
  let deaths = state.stats.deaths;
  for (let i = 0; i < steps; i++) {
    gameHours += stepH;
    tanks = tanks.map((t) => {
      const r = stepTank(t, stepH, events);
      deaths += r.deaths;
      return r.tank;
    });
  }
  return {
    ...state,
    // Rounded so long sessions don't drift away from whole steps.
    gameHours: Math.round(gameHours / stepH) * stepH,
    tanks,
    stats: { ...state.stats, deaths },
    rngState: rng.getState(),
    events,
  };
}
