import { content } from './content';
import { createRng } from './rng';
import type { Fish, FishGenes, GameState, Tank } from './types';

const copyGenes = (g: {
  locus1: [string, string];
  locus2?: [string, string] | undefined;
}): FishGenes =>
  g.locus2 ? { locus1: [...g.locus1], locus2: [...g.locus2] } : { locus1: [...g.locus1] };

/** Builds the GDD §2 starting state from start.json. */
export function newGame(seed: number): GameState {
  const { start, balance } = content;
  // Advance once so different seeds are visibly different in saves.
  const rng = createRng(seed);
  rng.next();
  let nextId = 1;
  const tanks: Tank[] = start.tanks.map((t) => ({
    id: nextId++,
    name: t.name,
    tankType: t.tankType,
    filterLevel: t.filterLevel,
    heaterLevel: t.heaterLevel,
    lightLevel: t.lightLevel,
    setpointC: balance.temperature.roomC,
    dirt: 0,
    tempC: balance.temperature.roomC,
    algae: 0,
    ich: false,
    decorCount: 0,
    plants: t.plants.map((p) => ({ plantId: p.plantId, mass: p.mass })),
    fish: t.fish.map((f): Fish => ({
      id: nextId++,
      speciesId: f.speciesId,
      sex: f.sex,
      ageH: start.fish.ageH,
      genes: copyGenes(f.genes),
      hp: start.fish.hp,
      hunger: start.fish.hunger,
      origin: 'bought',
      ...(f.pregnancy
        ? { pregnancy: { sireGenes: copyGenes(f.pregnancy.sireGenes), dueAtH: f.pregnancy.dueAtH } }
        : {}),
      cooldownUntilH: 0,
    })),
    waterChangeReadyAtH: 0,
  }));
  return {
    seed,
    rngState: rng.getState(),
    gameHours: 0,
    money: start.money,
    rep: start.rep,
    level: start.level,
    xp: 0,
    food: start.food,
    speed: 1,
    nextId,
    tanks,
    stats: { deaths: 0 },
    events: [],
  };
}
