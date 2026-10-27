import { content } from '../content';
import { isSick, phenotype } from '../sim/fish';
import { stageOf } from '../sim/stage';
import type { Fish, FishGenes } from '../sim/types';

/**
 * Species silhouettes and phenotype markings for the procedural fish (GDD §14).
 * Units: the body runs from the tail base at x = −38 to the nose at x = +50; heights are
 * half-heights in the same units. Render shape only, no balance numbers.
 */

export type TailKind = 'fan' | 'fork' | 'round' | 'lyre' | 'double' | 'veil' | 'halfmoon' | 'angel';
export type DorsalKind = 'small' | 'mid' | 'sail' | 'long' | 'angel' | 'fringe' | 'spiny' | 'rear';
export type AnalKind = 'none' | 'small' | 'long' | 'angel' | 'fringe' | 'rear';
export type PatternKind =
  | 'none'
  | 'guppySpots'
  | 'hstripes'
  | 'neon'
  | 'spots'
  | 'calico'
  | 'vbars'
  | 'marble'
  | 'koi'
  | 'discusBars'
  | 'blotches'
  | 'pearl'
  | 'scales'
  | 'lateral'
  | 'tailSpot';

export interface SpeciesShape {
  hTop: number;
  hBot: number;
  /** Half-height of the tail base (peduncle). */
  ped: number;
  /** x of the deepest point of the body. */
  peakX: number;
  /** Nose y offset (negative = upturned mouth, arowana). */
  noseY: number;
  tail: TailKind;
  tailLen: number;
  tailSpread: number;
  dorsal: DorsalKind;
  anal: AnalKind;
  /** Long belly filaments (angelfish). */
  filaments: boolean;
  /** Chin barbels (arowana). */
  barbels: boolean;
  eyeR: number;
  /** Body length multiplier for females vs males (guppy females are bigger). */
  femaleScale: number;
}

const shape = (
  s: Partial<SpeciesShape> & Pick<SpeciesShape, 'hTop' | 'hBot' | 'tail'>,
): SpeciesShape => ({
  ped: 5,
  peakX: 6,
  noseY: 0,
  tailLen: 24,
  tailSpread: 14,
  dorsal: 'small',
  anal: 'small',
  filaments: false,
  barbels: false,
  eyeR: 5,
  femaleScale: 1,
  ...s,
});

export const SHAPES: Record<string, SpeciesShape | undefined> = {
  guppy: shape({
    femaleScale: 1.3,
    hTop: 11,
    hBot: 11,
    ped: 4,
    peakX: 10,
    tail: 'fan',
    tailLen: 26,
    tailSpread: 14,
    eyeR: 6,
  }),
  danio: shape({
    hTop: 8,
    hBot: 8,
    ped: 4,
    peakX: 4,
    tail: 'fork',
    tailLen: 22,
    tailSpread: 11,
  }),
  platy: shape({
    femaleScale: 1.1,
    hTop: 17,
    hBot: 14,
    ped: 7,
    peakX: 6,
    tail: 'round',
    tailLen: 20,
    tailSpread: 14,
    dorsal: 'mid',
  }),
  neon: shape({
    hTop: 9,
    hBot: 9,
    ped: 4,
    peakX: 8,
    tail: 'fork',
    tailLen: 20,
    tailSpread: 10,
    eyeR: 6.5,
  }),
  molly: shape({
    femaleScale: 1.1,
    hTop: 15,
    hBot: 14,
    ped: 7,
    peakX: 4,
    tail: 'round',
    tailLen: 22,
    tailSpread: 15,
    dorsal: 'mid',
  }),
  swordtail: shape({
    femaleScale: 1.1,
    hTop: 12,
    hBot: 10,
    ped: 5,
    peakX: 8,
    tail: 'round',
    tailLen: 20,
    tailSpread: 12,
    dorsal: 'mid',
  }),
  goldfish: shape({
    hTop: 21,
    hBot: 19,
    ped: 7,
    peakX: 8,
    tail: 'fork',
    tailLen: 26,
    tailSpread: 16,
    dorsal: 'mid',
    eyeR: 6,
  }),
  betta: shape({
    hTop: 11,
    hBot: 11,
    ped: 6,
    peakX: 4,
    tail: 'round',
    tailLen: 20,
    tailSpread: 13,
    dorsal: 'long',
    anal: 'long',
  }),
  angel: shape({
    hTop: 22,
    hBot: 22,
    ped: 4,
    peakX: 12,
    tail: 'angel',
    tailLen: 18,
    tailSpread: 14,
    dorsal: 'angel',
    anal: 'angel',
    filaments: true,
    eyeR: 5.5,
  }),
  discus: shape({
    hTop: 36,
    hBot: 36,
    ped: 6,
    peakX: 4,
    tail: 'round',
    tailLen: 12,
    tailSpread: 11,
    dorsal: 'fringe',
    anal: 'fringe',
    eyeR: 5,
  }),
  flowerhorn: shape({
    hTop: 18,
    hBot: 16,
    ped: 7,
    peakX: 6,
    tail: 'round',
    tailLen: 22,
    tailSpread: 17,
    dorsal: 'spiny',
    anal: 'long',
  }),
  arowana: shape({
    hTop: 8,
    hBot: 10,
    ped: 6,
    peakX: -6,
    noseY: -4,
    tail: 'round',
    tailLen: 16,
    tailSpread: 10,
    dorsal: 'rear',
    anal: 'rear',
    barbels: true,
    eyeR: 6,
  }),
};

export interface FishLook {
  shape: SpeciesShape;
  body: string;
  belly: string;
  fin: string;
  /** Pupil colour (red for albinos). */
  eye: string;
  /** Iris ring colour, per species. */
  iris: string;
  accent: string;
  accent2: string;
  tail: TailKind;
  dorsal: DorsalKind;
  /** Fin/tail size multiplier (phenotype × sex). */
  finMul: number;
  /** Belly depth multiplier (balloon molly, pregnant female). */
  bellyMul: number;
  /** Forehead hump size (flowerhorn). */
  hump: number;
  /** Male swordtail's lower tail extension. */
  sword: boolean;
  /** Colour-locus marking. */
  pattern: PatternKind;
  /** Locus-2 marking (discus snakeskin). */
  pattern2: 'none' | 'snakeskin';
  sick: boolean;
  /** Whole-fish opacity (fry are see-through). */
  alpha: number;
  /** Eye size multiplier (young fish have big eyes). */
  eyeScale: number;
}

// ---------- colour helpers (run at sync time only, never per frame) ----------

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

const DARK_EYE = '#15171a';

/** Iris colour per species: silver guppies, red-ringed angels, orange-eyed discus. */
const IRIS: Record<string, string | undefined> = {
  guppy: '#c9d4d8',
  danio: '#d5dade',
  platy: '#c9a85a',
  neon: '#8cc4e0',
  molly: '#c9b27a',
  swordtail: '#d9b26a',
  goldfish: '#e6c27a',
  betta: '#6a4038',
  angel: '#c4483c',
  discus: '#d2502f',
  flowerhorn: '#e0b33c',
  arowana: '#d7c9a0',
};
const SICK_GREY = '#a3abae';

/** '#rrggbb' + alpha → 'rgba(r,g,b,a)' (sync time only). */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Colour-locus markings and accents, keyed `species.allele`. */
const COLOUR_MARKS: Record<
  string,
  { pattern: PatternKind; accent: string; accent2?: string } | undefined
> = {
  'guppy.wild': { pattern: 'guppySpots', accent: '#e8742c', accent2: '#1d1d1d' },
  'guppy.blue': { pattern: 'guppySpots', accent: '#9fd0ff', accent2: '#1b3f8f' },
  'guppy.albino': { pattern: 'none', accent: '#f6c9a8' },
  'danio.wild': { pattern: 'hstripes', accent: '#24407a' },
  'danio.golden': { pattern: 'hstripes', accent: '#c99a2e' },
  'danio.albino': { pattern: 'hstripes', accent: '#e9d2bd' },
  'platy.wild': { pattern: 'tailSpot', accent: '#2a2a2a' },
  'platy.red': { pattern: 'none', accent: '#a82a1e' },
  'platy.blue': { pattern: 'none', accent: '#2d58a8' },
  'neon.neon': { pattern: 'neon', accent: '#20c8ff', accent2: '#e0323e' },
  'neon.diamond': { pattern: 'neon', accent: '#e6fbff', accent2: '#e0323e' },
  'neon.albino': { pattern: 'neon', accent: '#f6dfe3', accent2: '#f0a2aa' },
  'molly.black': { pattern: 'none', accent: '#3a3e47' },
  'molly.dalmatian': { pattern: 'spots', accent: '#1d1f24' },
  'molly.gold': { pattern: 'none', accent: '#c47a10' },
  'swordtail.green': { pattern: 'lateral', accent: '#d2352a' },
  'swordtail.red': { pattern: 'none', accent: '#7f1a12' },
  'swordtail.pineapple': { pattern: 'none', accent: '#e8682a' },
  'goldfish.orange': { pattern: 'scales', accent: '#d9701a' },
  'goldfish.calico': { pattern: 'calico', accent: '#f08a24', accent2: '#23262d' },
  'goldfish.black': { pattern: 'scales', accent: '#3a3e47' },
  'betta.red': { pattern: 'none', accent: '#7e0c16' },
  'betta.blue': { pattern: 'none', accent: '#4a86ff' },
  'betta.koi': { pattern: 'koi', accent: '#e8582a', accent2: '#1d1f24' },
  'angel.silver': { pattern: 'vbars', accent: '#22262a' },
  'angel.marble': { pattern: 'marble', accent: '#26282b' },
  'angel.platinum': { pattern: 'none', accent: '#ffffff' },
  'discus.brown': { pattern: 'discusBars', accent: '#5f3b1c' },
  'discus.bluediamond': { pattern: 'none', accent: '#9fe0ff' },
  'discus.albinored': { pattern: 'discusBars', accent: '#e0533c' },
  'flowerhorn.classic': { pattern: 'blotches', accent: '#1d1f24', accent2: '#f2e6c9' },
  'flowerhorn.golden': { pattern: 'none', accent: '#a86a14' },
  'flowerhorn.pearl': { pattern: 'pearl', accent: '#ffffff', accent2: '#c43c4a' },
  'arowana.silver': { pattern: 'scales', accent: '#8f9aa1' },
  'arowana.black': { pattern: 'scales', accent: '#4c5260' },
};

/** Builds the look of one fish from species, phenotype, sex and health. */
export function lookFor(fish: Fish): FishLook {
  const sp = content.speciesById[fish.speciesId];
  const shp = SHAPES[fish.speciesId] ?? (SHAPES.guppy as SpeciesShape);
  const [colour, second] = phenotype(fish);
  const male = fish.sex === 'M';
  const marks = COLOUR_MARKS[`${fish.speciesId}.${colour?.id ?? ''}`];

  let body = colour?.body ?? '#999999';
  let fin = colour?.fin ?? body;
  let finMul = second?.finScale ?? 1;
  let tail: TailKind = shp.tail;
  let dorsal: DorsalKind = shp.dorsal;
  let bellyMul = fish.pregnancy ? 1.25 : 1;
  let hump = 0;
  let pattern: PatternKind = marks?.pattern ?? 'none';
  let pattern2: FishLook['pattern2'] = 'none';
  const accent = marks?.accent ?? mix(body, '#000000', 0.4);
  const accent2 = marks?.accent2 ?? accent;

  switch (fish.speciesId) {
    case 'guppy':
      // Males: small, colourful, big tail. Females: larger, greyer, short tail.
      if (male) finMul *= 1.35;
      else {
        body = mix(body, '#a7a690', colour?.id === 'albino' ? 0.15 : 0.6);
        fin = mix(fin, body, 0.55);
        finMul *= 0.7;
        if (pattern === 'guppySpots') pattern = 'none';
      }
      break;
    case 'swordtail':
      if (second?.id === 'lyretail') tail = 'lyre';
      break;
    case 'platy':
      if (second?.id === 'hifin') dorsal = 'sail';
      break;
    case 'molly':
      if (male) dorsal = 'sail';
      if (second?.id === 'balloon') bellyMul *= 1.45;
      break;
    case 'goldfish':
      if (second?.id === 'fantail') {
        tail = 'double';
        bellyMul *= 1.15;
      }
      break;
    case 'betta':
      if (male) tail = second?.id === 'halfmoon' ? 'halfmoon' : 'veil';
      else {
        finMul *= 0.55;
        dorsal = 'mid';
      }
      break;
    case 'flowerhorn':
      hump = second?.id === 'bigkok' ? 16 : 7;
      if (!male) hump *= 0.6;
      break;
    case 'discus':
      if (second?.id === 'snakeskin') pattern2 = 'snakeskin';
      break;
  }

  // How the fish is doing shows on its body.
  const sick = sp ? isSick(fish) : false;
  if (sick) {
    body = mix(body, SICK_GREY, 0.35);
    fin = mix(fin, SICK_GREY, 0.3);
    finMul *= 0.62;
  }
  if (fish.hunger < 15) bellyMul *= 1.08;
  else if (fish.hunger > content.balance.health.hungerProblemAbove) bellyMul *= 0.85;
  const stage = stageOf(fish.ageH);
  const albino = colour?.eye !== undefined;

  return {
    shape: shp,
    body,
    belly: mix(body, '#ffffff', 0.35),
    fin,
    eye: colour?.eye ?? DARK_EYE,
    iris: albino ? '#f3c4c4' : (IRIS[fish.speciesId] ?? '#d0d4d6'),
    accent,
    accent2,
    tail,
    dorsal,
    finMul,
    bellyMul,
    hump,
    sword: fish.speciesId === 'swordtail' && male,
    pattern,
    pattern2,
    sick,
    alpha: stage === 'fry' ? 0.72 : 1,
    eyeScale: stage === 'fry' ? 1.5 : stage === 'juvenile' ? 1.18 : 1,
  };
}

/** One adult of every phenotype (homozygous) × both sexes, for the gallery and tests. */
export function allPhenotypeFish(): Fish[] {
  const out: Fish[] = [];
  let id = 1;
  for (const sp of content.species) {
    const [l1, l2] = sp.loci;
    for (const a of l1?.alleles ?? [])
      for (const b of l2?.alleles ?? [undefined])
        for (const sex of ['M', 'F'] as const) {
          const genes: FishGenes = b
            ? { locus1: [a.id, a.id], locus2: [b.id, b.id] }
            : { locus1: [a.id, a.id] };
          out.push({
            id: id++,
            speciesId: sp.id,
            sex,
            ageH: content.balance.stages.adultAtH,
            genes,
            hp: 100,
            hunger: 0,
            origin: 'reward',
            cooldownUntilH: 0,
          });
        }
  }
  return out;
}
