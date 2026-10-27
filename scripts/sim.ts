/**
 * Headless balance runner (contract in docs/MILESTONES.md).
 *   npm run sim -- --days 30 --seed 1 --policy basic      one run, daily table
 *   npm run sim -- --days 30 --seeds 1-20 --policy idle   many runs, pacing summary
 *   --json                                                machine-readable output
 */
import { POLICIES, runSim, targetsFor, type PolicyName, type RunResult } from './simCore';

interface Args {
  days: number;
  seeds: number[];
  policy: PolicyName;
  json: boolean;
}

function fail(msg: string): never {
  console.error(`sim: ${msg}`);
  console.error(
    'usage: npm run sim -- --days N (--seed N | --seeds A-B) --policy idle|basic [--json]',
  );
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { days: 30, seeds: [1], policy: 'basic', json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i] ?? fail(`${k} needs a value`);
    if (k === '--days') a.days = Number(v());
    else if (k === '--seed') a.seeds = [Number(v())];
    else if (k === '--seeds') {
      const m = /^(\d+)-(\d+)$/.exec(v());
      if (!m) fail('--seeds must look like 1-20');
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      a.seeds = Array.from({ length: hi - lo + 1 }, (_, j) => lo + j);
    } else if (k === '--policy') {
      const p = v();
      if (!(POLICIES as readonly string[]).includes(p))
        fail(`unknown policy ${p} (M1 has ${POLICIES.join(', ')})`);
      a.policy = p as PolicyName;
    } else if (k === '--json') a.json = true;
    else fail(`unknown option ${k}`);
  }
  if (!(a.days > 0)) fail('--days must be positive');
  if (a.seeds.length === 0 || a.seeds.some((s) => !Number.isInteger(s))) fail('bad seeds');
  return a;
}

const fmt = (x: number, d = 1) => x.toFixed(d).padStart(7);

function printDaily(r: RunResult) {
  console.log(`policy ${r.policy} · seed ${r.seed} · ${r.days} game days\n`);
  console.log('  day  alive deaths  min HP  max hunger  min WQ   food');
  for (const d of r.daily)
    console.log(
      `${String(d.day).padStart(5)}${String(d.alive).padStart(7)}${String(d.deaths).padStart(7)}${fmt(d.minHp)}${fmt(d.maxHunger).padStart(12)}${fmt(d.minWq)}${String(d.food).padStart(7)}`,
    );
  console.log(
    `\ndeaths ${r.deaths} · first death ${r.firstDeathH === null ? 'none' : `${r.firstDeathH.toFixed(1)} game h`} · rejected actions ${r.rejected}`,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runs = args.seeds.map((seed) => runSim({ seed, days: args.days, policy: args.policy }));
  const targets = targetsFor(runs);
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          policy: args.policy,
          days: args.days,
          seeds: args.seeds,
          targets,
          runs: runs.map(({ daily: _d, ...r }) => r),
        },
        null,
        2,
      ),
    );
  } else {
    if (runs.length === 1 && runs[0]) printDaily(runs[0]);
    else
      console.log(
        `policy ${args.policy} · seeds ${args.seeds[0]}-${args.seeds.at(-1)} · ${args.days} game days\n`,
      );
    console.log('\ntarget                          median     p10     p90  result');
    for (const t of targets)
      console.log(
        `${`${t.target} (${t.unit})`.padEnd(30)}${fmt(t.median)}${fmt(t.p10)}${fmt(t.p90)}  ${t.pass ? 'PASS' : 'FAIL'}  ${t.note}`,
      );
  }
  if (targets.some((t) => !t.pass)) process.exitCode = 1;
}

main();
