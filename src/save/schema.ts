import { z } from 'zod';

/** zod schema for save format v1. When the format changes, add v2 and a migration. */
const genePair = z.tuple([z.string(), z.string()]);
const genes = z.object({ locus1: genePair, locus2: genePair.optional() });

const fish = z.object({
  id: z.number().int(),
  speciesId: z.string(),
  sex: z.enum(['F', 'M']),
  ageH: z.number(),
  genes,
  hp: z.number(),
  hunger: z.number(),
  origin: z.enum(['bred', 'bought', 'imported', 'reward']),
  pregnancy: z.object({ sireGenes: genes, dueAtH: z.number() }).optional(),
  cooldownUntilH: z.number(),
});

const tank = z.object({
  id: z.number().int(),
  name: z.string(),
  tankType: z.string(),
  filterLevel: z.number().int(),
  heaterLevel: z.number().int(),
  lightLevel: z.number().int(),
  setpointC: z.number(),
  dirt: z.number().min(0).max(100),
  tempC: z.number(),
  algae: z.number().min(0).max(100),
  ich: z.boolean(),
  decorCount: z.number().int().nonnegative(),
  plants: z.array(z.object({ plantId: z.string(), mass: z.number() })),
  fish: z.array(fish),
  waterChangeReadyAtH: z.number(),
});

export const stateV1Schema = z.object({
  seed: z.number(),
  rngState: z.number().int().nonnegative(),
  gameHours: z.number().nonnegative(),
  money: z.number(),
  rep: z.number(),
  level: z.number().int(),
  xp: z.number(),
  food: z.number().nonnegative(),
  speed: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  nextId: z.number().int(),
  tanks: z.array(tank),
  stats: z.object({ deaths: z.number().int().nonnegative() }),
});

export const envelopeSchema = z.object({
  version: z.number().int().positive(),
  savedAtMs: z.number(),
  state: z.unknown(),
});
