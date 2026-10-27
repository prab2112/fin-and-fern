import balanceJson from './balance.json';
import equipmentJson from './equipment.json';
import plantsJson from './plants.json';
import speciesJson from './species.json';
import startJson from './start.json';
import tanksJson from './tanks.json';
import {
  balanceFileSchema,
  equipmentFileSchema,
  plantsFileSchema,
  speciesFileSchema,
  startFileSchema,
  tanksFileSchema,
  type Balance,
  type EquipmentFile,
  type Genes,
  type Plant,
  type Species,
  type StartFile,
  type TankType,
} from './schema';

export interface Content {
  species: Species[];
  equipment: EquipmentFile;
  tanks: TankType[];
  plants: Plant[];
  start: StartFile;
  balance: Balance;
  speciesById: Record<string, Species | undefined>;
  tankTypeById: Record<string, TankType | undefined>;
  plantById: Record<string, Plant | undefined>;
}

export interface RawContent {
  species: unknown;
  equipment: unknown;
  tanks: unknown;
  plants: unknown;
  start: unknown;
  balance: unknown;
}

const index = <T extends { id: string }>(items: T[]): Record<string, T | undefined> =>
  Object.fromEntries(items.map((i) => [i.id, i]));

/** Validates every content file with zod and builds lookup tables. Throws on invalid content. */
export function parseContent(raw: RawContent): Content {
  const species = speciesFileSchema.parse(raw.species);
  const tanks = tanksFileSchema.parse(raw.tanks);
  const plants = plantsFileSchema.parse(raw.plants);
  const c: Content = {
    species,
    equipment: equipmentFileSchema.parse(raw.equipment),
    tanks,
    plants,
    start: startFileSchema.parse(raw.start),
    balance: balanceFileSchema.parse(raw.balance),
    speciesById: index(species),
    tankTypeById: index(tanks),
    plantById: index(plants),
  };
  const problems = crossCheck(c);
  if (problems.length > 0) throw new Error(`Invalid content:\n${problems.join('\n')}`);
  return c;
}

/** Checks references between files. Returns a list of problems (empty when valid). */
export function crossCheck(c: Content): string[] {
  const out: string[] = [];
  const unique = (label: string, ids: string[]) => {
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length > 0) out.push(`${label}: duplicate ids ${dup.join(', ')}`);
  };
  unique(
    'species',
    c.species.map((s) => s.id),
  );
  unique(
    'tanks',
    c.tanks.map((t) => t.id),
  );
  unique(
    'plants',
    c.plants.map((p) => p.id),
  );

  const checkGenes = (where: string, speciesId: string, genes: Genes) => {
    const sp = c.speciesById[speciesId];
    if (!sp) return out.push(`${where}: unknown species ${speciesId}`);
    const pairs = [genes.locus1, genes.locus2];
    sp.loci.forEach((locus, i) => {
      const pair = pairs[i];
      if (!pair) return out.push(`${where}: missing locus${i + 1}`);
      for (const allele of pair)
        if (!locus.alleles.some((a) => a.id === allele))
          out.push(`${where}: ${speciesId} has no allele ${allele} at ${locus.id}`);
    });
    if (sp.loci.length < 2 && genes.locus2) out.push(`${where}: ${speciesId} has no locus2`);
    return undefined;
  };

  c.start.tanks.forEach((t, ti) => {
    const where = `start.tanks[${ti}]`;
    if (!c.tankTypeById[t.tankType]) out.push(`${where}: unknown tankType ${t.tankType}`);
    if (!c.equipment.filters.some((f) => f.level === t.filterLevel))
      out.push(`${where}: unknown filterLevel ${t.filterLevel}`);
    if (!c.equipment.heaters.some((h) => h.level === t.heaterLevel))
      out.push(`${where}: unknown heaterLevel ${t.heaterLevel}`);
    if (!c.equipment.lights.some((l) => l.level === t.lightLevel))
      out.push(`${where}: unknown lightLevel ${t.lightLevel}`);
    for (const p of t.plants)
      if (!c.plantById[p.plantId]) out.push(`${where}: unknown plant ${p.plantId}`);
    t.fish.forEach((f, fi) => {
      checkGenes(`${where}.fish[${fi}]`, f.speciesId, f.genes);
      if (f.pregnancy) checkGenes(`${where}.fish[${fi}].sire`, f.speciesId, f.pregnancy.sireGenes);
    });
  });

  for (const s of c.species) {
    if (s.tempMin >= s.tempMax) out.push(`${s.id}: tempMin must be below tempMax`);
    const colour = s.loci[0];
    for (const a of colour?.alleles ?? [])
      if (!a.body || !a.fin) out.push(`${s.id}.${a.id}: colour allele needs body and fin colours`);
  }
  return out;
}

export const content: Content = parseContent({
  species: speciesJson,
  equipment: equipmentJson,
  tanks: tanksJson,
  plants: plantsJson,
  start: startJson,
  balance: balanceJson,
});
