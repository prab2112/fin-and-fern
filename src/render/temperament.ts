/**
 * How each species swims (GDD §14). Animation data only, not balance: it never feeds the sim.
 * Speeds are in body lengths per second; bands are fractions of the water column
 * (0 = just under the surface, 1 = just above the gravel).
 */
export interface Temperament {
  bandTop: number;
  bandBottom: number;
  cruise: number;
  burst: number;
  /** Max turn rate in rad/s at cruising speed. */
  turnRate: number;
  /** Chance to hover after reaching a waypoint. */
  hover: number;
  /** Burst-and-glide swimmer: short tail-beat bursts, then coasting. */
  burstGlide: boolean;
  /** 0 = loner, 0.3 = loose shoal, 1 = tight school. */
  school: number;
  /** Picks at the gravel and plants. */
  forager: boolean;
  /** Chance a waypoint is at the surface (labyrinth breathers, surface feeders). */
  surface: number;
}

const t = (x: Temperament) => x;

export const TEMPERAMENT: Record<string, Temperament | undefined> = {
  guppy: t({
    bandTop: 0.05,
    bandBottom: 0.6,
    cruise: 1.2,
    burst: 6,
    turnRate: 5,
    hover: 0.25,
    burstGlide: true,
    school: 0.3,
    forager: true,
    surface: 0.08,
  }),
  danio: t({
    bandTop: 0,
    bandBottom: 0.4,
    cruise: 1.9,
    burst: 8,
    turnRate: 6,
    hover: 0.04,
    burstGlide: true,
    school: 1,
    forager: false,
    surface: 0.1,
  }),
  platy: t({
    bandTop: 0.15,
    bandBottom: 0.75,
    cruise: 0.9,
    burst: 5,
    turnRate: 4,
    hover: 0.35,
    burstGlide: false,
    school: 0.2,
    forager: true,
    surface: 0,
  }),
  neon: t({
    bandTop: 0.35,
    bandBottom: 0.8,
    cruise: 1.3,
    burst: 7,
    turnRate: 6,
    hover: 0.15,
    burstGlide: true,
    school: 1,
    forager: false,
    surface: 0,
  }),
  molly: t({
    bandTop: 0.1,
    bandBottom: 0.65,
    cruise: 0.9,
    burst: 5,
    turnRate: 3.5,
    hover: 0.3,
    burstGlide: false,
    school: 0.2,
    forager: true,
    surface: 0.05,
  }),
  swordtail: t({
    bandTop: 0.1,
    bandBottom: 0.6,
    cruise: 1.1,
    burst: 6,
    turnRate: 4,
    hover: 0.2,
    burstGlide: false,
    school: 0.2,
    forager: true,
    surface: 0.05,
  }),
  goldfish: t({
    bandTop: 0.2,
    bandBottom: 1,
    cruise: 0.7,
    burst: 4,
    turnRate: 2.5,
    hover: 0.2,
    burstGlide: false,
    school: 0.3,
    forager: true,
    surface: 0.05,
  }),
  betta: t({
    bandTop: 0,
    bandBottom: 0.5,
    cruise: 0.45,
    burst: 4,
    turnRate: 3,
    hover: 0.55,
    burstGlide: false,
    school: 0,
    forager: false,
    surface: 0.35,
  }),
  angel: t({
    bandTop: 0.15,
    bandBottom: 0.65,
    cruise: 0.5,
    burst: 3.5,
    turnRate: 2,
    hover: 0.6,
    burstGlide: false,
    school: 0.25,
    forager: false,
    surface: 0,
  }),
  discus: t({
    bandTop: 0.3,
    bandBottom: 0.8,
    cruise: 0.4,
    burst: 3,
    turnRate: 1.8,
    hover: 0.6,
    burstGlide: false,
    school: 0.3,
    forager: false,
    surface: 0,
  }),
  flowerhorn: t({
    bandTop: 0.35,
    bandBottom: 0.95,
    cruise: 0.6,
    burst: 4,
    turnRate: 2.2,
    hover: 0.35,
    burstGlide: false,
    school: 0,
    forager: true,
    surface: 0,
  }),
  arowana: t({
    bandTop: 0,
    bandBottom: 0.25,
    cruise: 0.45,
    burst: 3,
    turnRate: 1.2,
    hover: 0.25,
    burstGlide: false,
    school: 0,
    forager: false,
    surface: 0.3,
  }),
};

export const DEFAULT_TEMPERAMENT = TEMPERAMENT.guppy as Temperament;
