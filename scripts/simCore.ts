/** Headless runner core over src/sim: bot policies, one-run results and summary stats. */
import { content } from '../src/content';
import { applyAction, type Action } from '../src/sim/actions';
import { newGame } from '../src/sim/newGame';
import { createRng } from '../src/sim/rng';
import { tick } from '../src/sim/tick';
import type { GameState } from '../src/sim/types';
import { wq } from '../src/sim/water';

export const POLICIES = ['idle', 'basic'] as const;
export type PolicyName = (typeof POLICIES)[number];

/** A policy looks at the state before each step and returns actions. It may keep memory. */
type Policy = (state: GameState) => Action[];

const BASIC_FEED_HOUR = 8;
const BASIC_WATER_CHANGE_BELOW_WQ = 60;

function makePolicy(name: PolicyName): Policy {
  switch (name) {
    case 'idle':
      return () => [];
    case 'basic': {
      // GDD §17 #5: feed daily, water change when WQ < 60.
      const lastFedDay = new Map<number, number>();
      return (s) => {
        const day = Math.floor(s.gameHours / 24);
        const hourOfDay = s.gameHours - day * 24;
        const actions: Action[] = [];
        for (const t of s.tanks) {
          if (t.fish.length === 0) continue;
          if (hourOfDay >= BASIC_FEED_HOUR - 1e-9 && (lastFedDay.get(t.id) ?? -1) < day) {
            lastFedDay.set(t.id, day);
            actions.push({ type: 'feed', tankId: t.id });
          }
          if (wq(t.dirt) < BASIC_WATER_CHANGE_BELOW_WQ && s.gameHours >= t.waterChangeReadyAtH)
            actions.push({ type: 'waterChange', tankId: t.id });
        }
        return actions;
      };
    }
  }
}

export interface DayRow {
  day: number;
  alive: number;
  deaths: number;
  minHp: number;
  maxHunger: number;
  minWq: number;
  food: number;
  money: number;
}

export interface RunResult {
  seed: number;
  policy: PolicyName;
  days: number;
  deaths: number;
  /** Game hour of the first death, or null if nothing died. */
  firstDeathH: number | null;
  rejected: number;
  daily: DayRow[];
}

export function runSim(opts: { seed: number; days: number; policy: PolicyName }): RunResult {
  const stepH = content.balance.time.simStepH;
  const stepsPerDay = Math.round(24 / stepH);
  const policy = makePolicy(opts.policy);
  let s = newGame(opts.seed);
  const rng = createRng(opts.seed, s.rngState);
  let firstDeathH: number | null = null;
  let rejected = 0;
  const daily: DayRow[] = [];

  for (let d = 0; d < opts.days; d++) {
    let minHp = Infinity;
    let maxHunger = 0;
    let minWq = Infinity;
    for (let i = 0; i < stepsPerDay; i++) {
      for (const a of policy(s)) {
        s = applyAction(s, a, rng);
        rejected += s.events.filter((e) => e.type === 'rejected').length;
      }
      s = tick(s, stepH, rng);
      if (firstDeathH === null && s.events.some((e) => e.type === 'death'))
        firstDeathH = s.gameHours;
      for (const t of s.tanks) {
        if (t.fish.length > 0) minWq = Math.min(minWq, wq(t.dirt));
        for (const f of t.fish) {
          minHp = Math.min(minHp, f.hp);
          maxHunger = Math.max(maxHunger, f.hunger);
        }
      }
    }
    daily.push({
      day: d + 1,
      alive: s.tanks.reduce((n, t) => n + t.fish.length, 0),
      deaths: s.stats.deaths,
      minHp: Number.isFinite(minHp) ? minHp : 0,
      maxHunger,
      minWq: Number.isFinite(minWq) ? minWq : 100,
      food: s.food,
      money: s.money,
    });
  }
  return {
    seed: opts.seed,
    policy: opts.policy,
    days: opts.days,
    deaths: s.stats.deaths,
    firstDeathH,
    rejected,
    daily,
  };
}

/** Linear-interpolated percentile of a sorted copy. */
function percentile(values: readonly number[], p: number): number {
  const xs = [...values].sort((a, b) => a - b);
  if (xs.length === 0) return NaN;
  const idx = (xs.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const v = (xs[lo] as number) + ((xs[hi] as number) - (xs[lo] as number)) * (idx - lo);
  return Math.round(v * 1e6) / 1e6;
}

export function summarize(values: readonly number[]): { median: number; p10: number; p90: number } {
  return {
    median: percentile(values, 0.5),
    p10: percentile(values, 0.1),
    p90: percentile(values, 0.9),
  };
}

export interface TargetRow {
  target: string;
  unit: string;
  median: number;
  p10: number;
  p90: number;
  pass: boolean;
  note: string;
}

const realMinutes = (gameH: number) => (gameH * content.balance.time.realSecondsPerGameHour) / 60;

/** GDD §17 targets that M1 covers, evaluated over a set of runs of one policy. */
export function targetsFor(runs: readonly RunResult[]): TargetRow[] {
  const policy = runs[0]?.policy;
  const days = runs[0]?.days ?? 0;
  const rows: TargetRow[] = [];
  const deaths = runs.map((r) => r.deaths);
  rows.push({
    target: `deaths over ${days} game days`,
    unit: 'fish',
    ...summarize(deaths),
    pass: policy === 'basic' ? deaths.every((d) => d === 0) : true,
    note: policy === 'basic' ? '§17 #5: 0 in every seed' : 'info',
  });
  // A run with no death is censored at the end of the run.
  const firstDeath = runs.map((r) => r.firstDeathH ?? r.days * 24);
  const fd = summarize(firstDeath);
  rows.push({
    target: 'first death',
    unit: 'game h',
    ...fd,
    pass: policy === 'idle' ? firstDeath.every((h) => h >= 48) : true,
    note:
      policy === 'idle'
        ? `§17 #6: ≥ 48 game h (8 real min) in every seed; median ${realMinutes(fd.median).toFixed(1)} real min`
        : runs.every((r) => r.firstDeathH === null)
          ? 'no deaths (censored at run end)'
          : 'info',
  });
  return rows;
}
