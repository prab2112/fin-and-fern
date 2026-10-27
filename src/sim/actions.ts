import { content } from './content';
import { wholesaleGenes } from './genetics';
import type { Rng } from './rng';
import { tick } from './tick';
import type { Fish, GameState, Speed, Tank } from './types';
import { clampSetpoint, heaterMaxC, tankLoad, waterChange } from './water';

export type Action =
  | { type: 'feed'; tankId: number }
  | { type: 'waterChange'; tankId: number }
  | { type: 'setHeaterSetpoint'; tankId: number; c: number }
  | { type: 'setSpeed'; speed: Speed }
  // Debug menu (dev builds only).
  | { type: 'debugSpawnFish'; tankId: number; speciesId: string; count: number }
  | { type: 'debugAdvanceHours'; hours: number }
  | { type: 'debugAddFood'; units: number }
  | { type: 'debugAddDirt'; tankId: number; amount: number }
  | { type: 'debugSickFish'; tankId: number; hp: number };

const reject = (state: GameState, action: Action, reason: string): GameState => ({
  ...state,
  events: [{ type: 'rejected', action: action.type, reason }],
});

const replaceTank = (state: GameState, tank: Tank, over: Partial<GameState> = {}): GameState => ({
  ...state,
  ...over,
  tanks: state.tanks.map((t) => (t.id === tank.id ? tank : t)),
  events: [],
});

/** Applies one player (or debug) action. Invalid actions return the state with a `rejected` event. */
export function applyAction(state: GameState, action: Action, rng: Rng): GameState {
  const { balance } = content;
  const findTank = (id: number) => state.tanks.find((t) => t.id === id);

  switch (action.type) {
    case 'feed': {
      const tank = findTank(action.tankId);
      if (!tank) return reject(state, action, 'noTank');
      if (tank.fish.length === 0) return reject(state, action, 'empty');
      // GDD §4: consumes max(1, ceil(load / 4)) food units.
      const units = Math.max(1, Math.ceil(tankLoad(tank.fish) / balance.food.loadPerFoodUnit));
      if (state.food < units) return reject(state, action, 'noFood');
      const mean = tank.fish.reduce((s, f) => s + f.hunger, 0) / tank.fish.length;
      const overfed = mean < balance.food.overfeedMeanHungerBelow;
      return replaceTank(
        state,
        {
          ...tank,
          dirt: overfed ? Math.min(100, tank.dirt + balance.food.overfeedDirt) : tank.dirt,
          fish: tank.fish.map((f) => ({ ...f, hunger: 0 })),
        },
        { food: state.food - units },
      );
    }

    case 'waterChange': {
      const tank = findTank(action.tankId);
      if (!tank) return reject(state, action, 'noTank');
      if (state.gameHours < tank.waterChangeReadyAtH - 1e-9)
        return reject(state, action, 'cooldown');
      return replaceTank(state, {
        ...tank,
        dirt: waterChange(tank.dirt),
        waterChangeReadyAtH: state.gameHours + balance.water.waterChangeCooldownH,
      });
    }

    case 'setHeaterSetpoint': {
      const tank = findTank(action.tankId);
      if (!tank) return reject(state, action, 'noTank');
      if (heaterMaxC(tank.heaterLevel) === null) return reject(state, action, 'noHeater');
      return replaceTank(state, { ...tank, setpointC: clampSetpoint(tank.heaterLevel, action.c) });
    }

    case 'setSpeed':
      return { ...state, speed: action.speed, events: [] };

    case 'debugSpawnFish': {
      const tank = findTank(action.tankId);
      const species = content.speciesById[action.speciesId];
      if (!tank) return reject(state, action, 'noTank');
      if (!species) return reject(state, action, 'noSpecies');
      let nextId = state.nextId;
      const born: Fish[] = [];
      for (let i = 0; i < action.count; i++)
        born.push({
          id: nextId++,
          speciesId: species.id,
          sex: rng.next() < balance.wholesale.femaleChance ? 'F' : 'M',
          ageH: balance.stages.adultAtH,
          genes: wholesaleGenes(species, rng),
          hp: content.start.fish.hp,
          hunger: content.start.fish.hunger,
          origin: 'bought',
          cooldownUntilH: 0,
        });
      return replaceTank(
        state,
        { ...tank, fish: [...tank.fish, ...born] },
        { nextId, rngState: rng.getState() },
      );
    }

    case 'debugAdvanceHours':
      return tick(state, action.hours, rng);

    case 'debugAddFood':
      return { ...state, food: state.food + action.units, events: [] };

    case 'debugAddDirt': {
      const tank = findTank(action.tankId);
      if (!tank) return reject(state, action, 'noTank');
      return replaceTank(state, { ...tank, dirt: Math.min(100, tank.dirt + action.amount) });
    }

    case 'debugSickFish': {
      const tank = findTank(action.tankId);
      if (!tank) return reject(state, action, 'noTank');
      const [first, ...rest] = tank.fish;
      if (!first) return reject(state, action, 'empty');
      return replaceTank(state, { ...tank, fish: [{ ...first, hp: action.hp }, ...rest] });
    }
  }
}
