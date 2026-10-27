import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9_]+$/);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const positive = z.number().positive();
const nonNeg = z.number().nonnegative();
const level = z.number().int().min(1).max(10);

// ---------- species.json (GDD §5) ----------

export const alleleSchema = z.object({
  id,
  name: z.string(),
  /** Value multiplier when this allele is expressed. */
  mult: positive,
  /** Render colours (colour locus only): body, fins/tail, and an eye override (albino red eye). */
  body: hex.optional(),
  fin: hex.optional(),
  eye: hex.optional(),
  /** Render shape: scale of the tail/fin for this phenotype. */
  finScale: positive.optional(),
});

export const locusSchema = z.object({
  id,
  name: z.string(),
  /** Dominant → recessive. */
  alleles: z.array(alleleSchema).min(1),
});

export const careFactSchema = z.object({
  text: z.string(),
  verified: z.boolean(),
});

export const speciesSchema = z.object({
  id,
  name: z.string(),
  kind: z.enum(['livebearer', 'egg-layer', 'import-only']),
  size: positive,
  tempMin: z.number(),
  tempMax: z.number(),
  basePrice: positive,
  unlockLevel: level,
  sources: z.array(z.enum(['wholesale', 'Thailand', 'Singapore', 'Brazil'])).min(1),
  traits: z.object({
    school: z.number().int().positive().optional(),
    territorialMales: z.boolean().optional(),
    sensitive: z.boolean().optional(),
    solitary: z.boolean().optional(),
    minTankL: positive.optional(),
    noBreeding: z.boolean().optional(),
  }),
  /** locus1 (colour) first, then locus2. Arowana has a single fixed variant locus. */
  loci: z.array(locusSchema).min(1).max(2),
  careFacts: z.array(careFactSchema),
});

export const speciesFileSchema = z.array(speciesSchema).min(1);

// ---------- equipment.json (GDD §3) ----------

const pricedLevel = z.object({ level: z.number().int().nonnegative(), price: nonNeg });

export const equipmentFileSchema = z.object({
  filters: z.array(pricedLevel.extend({ power: positive })).min(1),
  /** maxC null = no heater: the tank sits at room temperature. */
  heaters: z.array(pricedLevel.extend({ maxC: z.number().nullable() })).min(1),
  lights: z.array(pricedLevel.extend({ intensity: positive })).min(1),
  co2: z.object({ growthMult: positive, price: nonNeg, unlockLevel: level }),
  breedingTank: z.object({ unlockLevel: level }),
  quarantineTank: z.object({ unlockLevel: level, maxFish: z.number().int().positive() }),
  resaleFraction: z.number().min(0).max(1),
});

// ---------- tanks.json (GDD §3) ----------

export const tankTypeSchema = z.object({
  id,
  name: z.string(),
  volumeL: positive,
  price: nonNeg,
  unlockLevel: level,
});

export const tanksFileSchema = z.array(tankTypeSchema).min(1);

// ---------- plants.json (GDD §7) ----------

export const plantSchema = z.object({
  id,
  name: z.string(),
  lightNeed: positive,
  growthPerH: nonNeg,
  /** Multiplier on mass when computing cover (Java Moss counts ×2). */
  coverMult: positive,
  price: nonNeg,
  unlockLevel: level,
});

export const plantsFileSchema = z.array(plantSchema).min(1);

// ---------- start.json (GDD §2) ----------

const genePair = z.tuple([id, id]);
export const genesSchema = z.object({
  locus1: genePair,
  locus2: genePair.optional(),
});

export const startFishSchema = z.object({
  speciesId: id,
  sex: z.enum(['F', 'M']),
  genes: genesSchema,
  pregnancy: z.object({ sireGenes: genesSchema, dueAtH: nonNeg }).optional(),
});

export const startFileSchema = z.object({
  money: nonNeg,
  rep: z.number(),
  level,
  food: nonNeg,
  fish: z.object({ hp: positive, hunger: nonNeg, ageH: nonNeg }),
  tanks: z
    .array(
      z.object({
        name: z.string(),
        tankType: id,
        filterLevel: z.number().int(),
        heaterLevel: z.number().int(),
        lightLevel: z.number().int(),
        plants: z.array(z.object({ plantId: id, mass: positive })),
        fish: z.array(startFishSchema),
      }),
    )
    .min(1),
});

// ---------- balance.json (global constants) ----------

export const balanceFileSchema = z.object({
  time: z.object({ simStepH: positive, realSecondsPerGameHour: positive }),
  stages: z.object({ juvenileAtH: positive, adultAtH: positive }),
  tank: z.object({
    litresPerCapacityUnit: positive,
    stageFactor: z.object({ fry: positive, juvenile: positive, adult: positive }),
  }),
  water: z.object({
    loadCoef: nonNeg,
    plantCoef: nonNeg,
    refVolumeL: positive,
    waterChangeFactor: z.number().min(0).max(1),
    waterChangeCooldownH: nonNeg,
    deathDirtPerSize: nonNeg,
  }),
  food: z.object({
    hungerPerH: nonNeg,
    hungerMax: positive,
    loadPerFoodUnit: positive,
    overfeedMeanHungerBelow: nonNeg,
    overfeedDirt: nonNeg,
    tinUnits: positive,
    tinPrice: nonNeg,
  }),
  temperature: z.object({ roomC: z.number(), ratePerH: positive }),
  health: z.object({
    hpMax: positive,
    regenPerH: nonNeg,
    problemDamagePerH: nonNeg,
    hungerProblemAbove: nonNeg,
    wqProblemBelow: nonNeg,
    wqSevereBelow: nonNeg,
    wqSevereDamagePerH: nonNeg,
    ichDamagePerH: nonNeg,
    sensitiveMult: positive,
    sickBelowHp: nonNeg,
  }),
  happiness: z.object({
    base: z.number(),
    coverThreshold: nonNeg,
    coverBonus: z.number(),
    decorEach: z.number(),
    decorMax: z.number().int().nonnegative(),
    overloadPenalty: z.number(),
    schoolPenalty: z.number(),
    conflictPenalty: z.number(),
    wqBelow: nonNeg,
    wqPenalty: z.number(),
  }),
  plants: z.object({ coverLitresPerMass: positive }),
  alerts: z.object({ hungerAbove: nonNeg, wqBelow: nonNeg, hpBelow: nonNeg }),
  wholesale: z.object({
    recessiveChancePerLocus: z.number().min(0).max(1),
    femaleChance: z.number().min(0).max(1),
  }),
  value: z.object({ stageMult: z.object({ fry: nonNeg, juvenile: nonNeg, adult: nonNeg }) }),
});

export type Allele = z.infer<typeof alleleSchema>;
export type Locus = z.infer<typeof locusSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type EquipmentFile = z.infer<typeof equipmentFileSchema>;
export type TankType = z.infer<typeof tankTypeSchema>;
export type Plant = z.infer<typeof plantSchema>;
export type StartFile = z.infer<typeof startFileSchema>;
export type Balance = z.infer<typeof balanceFileSchema>;
export type Genes = z.infer<typeof genesSchema>;
