import { content } from './content';
import { stageOf } from './stage';
import { capacity, cover, tankLoad, wq } from './water';
import type { Allele } from '../content/schema';
import type { Fish, Tank } from './types';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export type Problem = 'wq' | 'temp' | 'hunger' | 'ich';

/** Tank conditions a fish reacts to. */
export interface FishEnv {
  wq: number;
  tempC: number;
  ich: boolean;
}

/** GDD §4 Health: one problem per true condition, in a fixed order. */
export function problems(fish: Fish, env: FishEnv): Problem[] {
  const h = content.balance.health;
  const sp = content.speciesById[fish.speciesId];
  const out: Problem[] = [];
  if (env.wq < h.wqProblemBelow) out.push('wq');
  if (sp && (env.tempC < sp.tempMin || env.tempC > sp.tempMax)) out.push('temp');
  if (fish.hunger > h.hungerProblemAbove) out.push('hunger');
  if (env.ich) out.push('ich');
  return out;
}

/**
 * GDD §4: +1/h with no problems; otherwise −2 per problem, WQ < 25 counts −5 instead of −2,
 * Ich −3. Sensitive species take double damage.
 */
export function hpDeltaPerH(fish: Fish, env: FishEnv): number {
  const h = content.balance.health;
  const list = problems(fish, env);
  if (list.length === 0) return h.regenPerH;
  let dmg = 0;
  for (const p of list) {
    if (p === 'wq') dmg += env.wq < h.wqSevereBelow ? h.wqSevereDamagePerH : h.problemDamagePerH;
    else if (p === 'ich') dmg += h.ichDamagePerH;
    else dmg += h.problemDamagePerH;
  }
  if (content.speciesById[fish.speciesId]?.traits.sensitive) dmg *= h.sensitiveMult;
  return -dmg;
}

/** One sim step for a fish: age, hunger (GDD §4 Food), then HP from the resulting problems. */
export function stepFish(fish: Fish, env: FishEnv, dtH: number): Fish {
  const { food, health } = content.balance;
  const next: Fish = {
    ...fish,
    ageH: fish.ageH + dtH,
    hunger: Math.min(food.hungerMax, fish.hunger + food.hungerPerH * dtH),
  };
  next.hp = Math.min(health.hpMax, fish.hp + hpDeltaPerH(next, env) * dtH);
  return next;
}

/** GDD §4: a fish is sick below 40 HP. */
export function isSick(fish: Fish): boolean {
  return fish.hp < content.balance.health.sickBelowHp;
}

export interface HappinessInputs {
  cover: number;
  decorCount: number;
  load: number;
  capacity: number;
  schoolShort: boolean;
  conflict: boolean;
  wq: number;
}

/** GDD §4 Happiness formula. */
export function happinessScore(i: HappinessInputs): number {
  const h = content.balance.happiness;
  return clamp(
    h.base +
      (i.cover >= h.coverThreshold ? h.coverBonus : 0) +
      h.decorEach * Math.min(i.decorCount, h.decorMax) -
      h.overloadPenalty * Math.max(0, i.load / i.capacity - 1) -
      (i.schoolShort ? h.schoolPenalty : 0) -
      (i.conflict ? h.conflictPenalty : 0) -
      (i.wq < h.wqBelow ? h.wqPenalty : 0),
    0,
    100,
  );
}

/** Any species present in fewer than its school size. */
export function schoolShort(fish: readonly Fish[]): boolean {
  const counts = new Map<string, number>();
  for (const f of fish) counts.set(f.speciesId, (counts.get(f.speciesId) ?? 0) + 1);
  for (const [id, n] of counts) {
    const school = content.speciesById[id]?.traits.school;
    if (school !== undefined && n < school) return true;
  }
  return false;
}

/** GDD §4: more than one adult male betta, or a flowerhorn with any tankmate. */
export function hasConflict(fish: readonly Fish[]): boolean {
  let territorialMales = 0;
  let solitary = false;
  for (const f of fish) {
    const t = content.speciesById[f.speciesId]?.traits;
    if (t?.territorialMales && f.sex === 'M' && stageOf(f.ageH) === 'adult') territorialMales++;
    if (t?.solitary) solitary = true;
  }
  return territorialMales > 1 || (solitary && fish.length > 1);
}

export function tankVolume(tank: Tank): number {
  return content.tankTypeById[tank.tankType]?.volumeL ?? 0;
}

/** H for a tank (recomputed on demand, never stored). */
export function tankHappiness(tank: Tank): number {
  const volumeL = tankVolume(tank);
  return happinessScore({
    cover: cover(tank.plants, volumeL),
    decorCount: tank.decorCount,
    load: tankLoad(tank.fish),
    capacity: capacity(volumeL),
    schoolShort: schoolShort(tank.fish),
    conflict: hasConflict(tank.fish),
    wq: wq(tank.dirt),
  });
}

/** GDD §5: per locus, the first allele in dominance order present in the genotype. */
export function phenotype(fish: Fish): Allele[] {
  const sp = content.speciesById[fish.speciesId];
  if (!sp) return [];
  const pairs = [fish.genes.locus1, fish.genes.locus2];
  const out: Allele[] = [];
  sp.loci.forEach((locus, i) => {
    const pair = pairs[i];
    const expressed = locus.alleles.find((a) => pair?.includes(a.id));
    if (expressed) out.push(expressed);
  });
  return out;
}

export function morphLabel(fish: Fish): string {
  return phenotype(fish)
    .map((a) => a.name)
    .join(' ');
}

/**
 * GDD §5: value = marketPrice × mult(locus1) × mult(locus2) × stageMult × aquadexBonus.
 * aquadexBonus arrives with the Aquadex in M3.
 */
export function fishValue(fish: Fish, marketPrice: number, aquadexBonus = 1): number {
  const stageMult = content.balance.value.stageMult[stageOf(fish.ageH)];
  let v = marketPrice * stageMult * aquadexBonus;
  for (const a of phenotype(fish)) v *= a.mult;
  return v;
}
