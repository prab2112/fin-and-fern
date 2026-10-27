/** Sim state. Plain JSON-serialisable data; the save format wraps it (src/save). */

export type Sex = 'F' | 'M';
export type Origin = 'bred' | 'bought' | 'imported' | 'reward';
export type Speed = 0 | 1 | 2;
export type Stage = 'fry' | 'juvenile' | 'adult';

export interface FishGenes {
  locus1: [string, string];
  locus2?: [string, string];
}

/** GDD §5 fish record. */
export interface Fish {
  id: number;
  speciesId: string;
  sex: Sex;
  ageH: number;
  genes: FishGenes;
  hp: number;
  hunger: number;
  origin: Origin;
  pregnancy?: { sireGenes: FishGenes; dueAtH: number };
  cooldownUntilH: number;
}

export interface PlantInstance {
  plantId: string;
  mass: number;
}

export interface Tank {
  id: number;
  name: string;
  tankType: string;
  filterLevel: number;
  /** 0 = no heater. */
  heaterLevel: number;
  lightLevel: number;
  /** Heater setpoint °C; ignored without a heater. */
  setpointC: number;
  /** Dirt D in [0, 100]; WQ = 100 − D. */
  dirt: number;
  tempC: number;
  /** Algae A in [0, 100]; static at 0 before M6. */
  algae: number;
  /** Active Ich outbreak (M7). */
  ich: boolean;
  /** Decor items (M4). */
  decorCount: number;
  plants: PlantInstance[];
  fish: Fish[];
  waterChangeReadyAtH: number;
}

export type AlertKind = 'hunger' | 'wq' | 'hp';

export type SimEvent =
  | { type: 'death'; tankId: number; fishId: number; speciesId: string }
  | { type: 'alert'; kind: AlertKind; tankId: number; fishId?: number }
  | { type: 'rejected'; action: string; reason: string };

export interface GameState {
  seed: number;
  rngState: number;
  gameHours: number;
  money: number;
  rep: number;
  level: number;
  xp: number;
  food: number;
  speed: Speed;
  nextId: number;
  tanks: Tank[];
  stats: { deaths: number };
  /** Events emitted by the latest tick/applyAction call only. Not saved. */
  events: SimEvent[];
}
