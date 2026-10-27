#!/usr/bin/env node
// Fin & Fern overnight runner.
// Drives unattended Claude Code sessions (`claude -p`) until a deadline:
// builds milestones M1 → M4 one at a time, verifies each one itself
// (STATUS.md says DONE + typecheck/lint/tests pass) and tags it `mN-auto`,
// then spends the remaining time on improvement passes.
//
//   node scripts/overnight.mjs --check            preflight + one tiny Claude call (≈1 min)
//   node scripts/overnight.mjs --until 07:00      the real run (default deadline 07:00)
//
// Options: --to 4  --model <alias>  --mode auto|acceptEdits  --max-attempts 3
//          --session-hours 3  --max-improve 6  --no-improve  --minutes <n> (deadline n min from now)

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const isWin = process.platform === 'win32';
const MIN = process.env.OVERNIGHT_FAST === '1' ? 20 : 60_000; // ms per "minute" (FAST is for testing the runner)
const LOG_DIR = path.join(ROOT, '.overnight', 'logs');
const RUNNER_LOG = path.join(ROOT, '.overnight', 'runner.log');
const STATUS = path.join(ROOT, 'docs', 'overnight', 'STATUS.md');
const SUMMARY = path.join(ROOT, 'docs', 'overnight', 'RUNNER_SUMMARY.md');
const ALLOWED_TOOLS = [
  'Bash(npm install *)',
  'Bash(npm i *)',
  'Bash(npx playwright *)',
  'Bash(npx vite *)',
  'Bash(npx prettier *)',
  'Bash(npx eslint *)',
].join(',');
const LIMIT_RE =
  /(usage|rate|session|weekly|5-hour)\s+limit|limit\s+(reached|exceeded|resets)|hit your (usage )?limit|out of (extra )?usage|\b(429|529)\b|overloaded/i;

const started = Date.now();
const results = [];
let lastCheckOutput = '';
let sessionCount = 0;

// ---------- helpers ----------
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(RUNNER_LOG, line + '\n');
  } catch {
    /* log dir not ready yet */
  }
}
function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
function sh(cmd) {
  const r = spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const winQuote = (a) => (/[\s"()*&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const cmpVer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function usage() {
  console.log(`Usage: node scripts/overnight.mjs [--check] [--until HH:MM] [--to 1-4] [--model opus|sonnet|...]
       [--mode auto|acceptEdits] [--max-attempts 3] [--session-hours 3] [--max-improve 6] [--no-improve] [--minutes N]`);
}

function parseArgs(argv) {
  const o = {
    until: '07:00',
    minutes: null,
    to: 4,
    model: null,
    mode: 'auto',
    maxAttempts: 3,
    sessionHours: 3,
    maxImprove: 6,
    improve: true,
    check: false,
    limitWaitMin: 20,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) die(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--until') o.until = next();
    else if (a === '--minutes') o.minutes = Number(next());
    else if (a === '--to') o.to = Number(next());
    else if (a === '--model') o.model = next();
    else if (a === '--mode') o.mode = next();
    else if (a === '--max-attempts') o.maxAttempts = Number(next());
    else if (a === '--session-hours') o.sessionHours = Number(next());
    else if (a === '--max-improve') o.maxImprove = Number(next());
    else if (a === '--no-improve') o.improve = false;
    else if (a === '--check') o.check = true;
    else if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    } else {
      usage();
      die(`Unknown option: ${a}`);
    }
  }
  if (!(o.to >= 1 && o.to <= 4))
    die('--to must be 1–4 (M5+ needs you awake: app id, keystore, Play Console).');
  if (!['auto', 'acceptEdits'].includes(o.mode)) die('--mode must be auto or acceptEdits');
  return o;
}

function computeDeadline(o) {
  if (o.minutes != null) return Date.now() + o.minutes * MIN;
  const m = /^(\d{1,2}):(\d{2})$/.exec(o.until);
  if (!m) die('--until must look like 07:00');
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function ensureGitignore() {
  const gi = path.join(ROOT, '.gitignore');
  const text = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  const needed = ['node_modules/', '.overnight/'].filter((e) => !text.split(/\r?\n/).includes(e));
  if (needed.length)
    fs.appendFileSync(gi, `${text.endsWith('\n') || !text ? '' : '\n'}${needed.join('\n')}\n`);
}

function checkpoint(label) {
  if (!sh('git status --porcelain').out.trim()) return;
  sh('git add -A');
  const r = sh(`git commit -q -m "wip(overnight): checkpoint after ${label}"`);
  log(
    r.code === 0
      ? `checkpoint commit after ${label}`
      : `checkpoint commit failed: ${r.out.trim().slice(0, 300)}`,
  );
}

const hasTag = (t) => sh(`git rev-parse -q --verify "refs/tags/${t}"`).code === 0;

function claimedDone(n) {
  try {
    return new RegExp(`^\\s*[-*]?\\s*M${n}\\s*:\\s*DONE\\b`, 'mi').test(
      fs.readFileSync(STATUS, 'utf8'),
    );
  } catch {
    return false;
  }
}

function checksPass() {
  if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
    lastCheckOutput = 'no package.json yet';
    return false;
  }
  for (const c of ['npm run typecheck', 'npm run lint', 'npm test']) {
    const r = sh(c);
    if (r.code !== 0) {
      lastCheckOutput = `${c} failed:\n${r.out.slice(-1500)}`;
      log(`check failed: ${c}`);
      return false;
    }
  }
  lastCheckOutput = 'typecheck, lint and tests pass';
  return true;
}

function keepAwake() {
  try {
    if (process.platform === 'darwin') {
      const p = spawn('caffeinate', ['-dimsu', '-w', String(process.pid)], { stdio: 'ignore' });
      p.on('error', () => log('caffeinate not available: keep the Mac awake yourself'));
      return 'caffeinate (macOS)';
    }
    if (isWin) {
      // Holds ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED while this runner is alive.
      const script = [
        `$sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'`,
        '$t = Add-Type -MemberDefinition $sig -Name OvernightPower -Namespace Win32 -PassThru',
        '[void]$t::SetThreadExecutionState([uint32]2147483713)',
        `while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 30 }`,
      ].join('; ');
      const enc = Buffer.from(script, 'utf16le').toString('base64');
      const p = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc],
        {
          stdio: 'ignore',
          windowsHide: true,
        },
      );
      p.on('error', () =>
        log('could not start the keep-awake helper: set Power → Sleep to Never while plugged in'),
      );
      return 'SetThreadExecutionState (Windows)';
    }
  } catch {
    /* best effort */
  }
  return 'none (Linux: run under `systemd-inhibit` if your machine sleeps)';
}

function stopTree(child) {
  if (!child.pid) return;
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else {
    child.kill('SIGINT'); // lets claude end the turn cleanly
    setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    }, MIN).unref();
  }
}

function claudeArgs(prompt, o, flags) {
  const a = ['-p', prompt, '--permission-mode', o.mode, '--output-format', 'text'];
  if (flags.promptsNone) a.push('--permission-prompts', 'none');
  if (o.model) a.push('--model', o.model);
  a.push('--allowedTools', ALLOWED_TOOLS);
  return a;
}

function runSession(prompt, label, o, flags, deadline) {
  return new Promise((resolve) => {
    sessionCount++;
    const logFile = path.join(
      LOG_DIR,
      `${stamp()}-${String(sessionCount).padStart(2, '0')}-${label}.log`,
    );
    const out = fs.createWriteStream(logFile);
    const args = claudeArgs(prompt, o, flags);
    const child = isWin
      ? spawn(['claude', ...args].map(winQuote).join(' '), {
          cwd: ROOT,
          shell: true,
          windowsHide: true,
        })
      : spawn('claude', args, { cwd: ROOT });
    let buf = '';
    let done = false;
    let timedOut = false;
    const onData = (d) => {
      out.write(d);
      buf += d;
      if (buf.length > 200_000) buf = buf.slice(-100_000);
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    const limitAt = Math.min(deadline, Date.now() + o.sessionHours * 60 * MIN);
    const timer = setTimeout(
      () => {
        timedOut = true;
        log(`${label}: session time limit reached, stopping it`);
        stopTree(child);
      },
      Math.max(0, limitAt - Date.now()),
    );
    const finish = (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      out.end();
      resolve({ code, out: buf, timedOut, logFile });
    };
    child.on('error', (e) => {
      onData(`\n[runner] could not start claude: ${e.message}\n`);
      finish(127);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

const isLimited = (res) => res.code !== 0 && !res.timedOut && LIMIT_RE.test(res.out.slice(-5000));

// ---------- preflight ----------
function preflight() {
  if (
    !fs.existsSync(path.join(ROOT, 'docs', 'MILESTONES.md')) ||
    !fs.existsSync(path.join(ROOT, '.claude', 'skills', 'overnight', 'SKILL.md'))
  )
    die(
      'Run this from the fin-and-fern folder (docs/MILESTONES.md or the overnight skill is missing).',
    );
  fs.mkdirSync(LOG_DIR, { recursive: true });
  if (Number(process.versions.node.split('.')[0]) < 20)
    die(`Node ${process.versions.node} is too old: install Node 22+.`);

  const v = sh('claude --version');
  if (v.code !== 0)
    die('`claude` is not on PATH. Install Claude Code, open a new terminal, and retry.');
  const ver = (/(\d+)\.(\d+)\.(\d+)/.exec(v.out) || []).slice(1).map(Number);
  const promptsNone = ver.length === 3 && cmpVer(ver, [2, 1, 259]) >= 0;
  if (sh('claude auth status').code !== 0)
    die('Claude Code is not logged in. Run `claude`, type /login, then retry.');
  if (sh('git --version').code !== 0) die('git is not installed.');

  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    sh('git init -q');
    log('initialised a git repository');
  }
  if (!sh('git config user.email').out.trim()) {
    sh('git config user.name "Fin and Fern overnight"');
    sh('git config user.email "overnight@localhost"');
    log('no git identity configured: set a repo-local one for tonight’s commits');
  }
  ensureGitignore();
  checkpoint('preflight (kit files / your changes)');
  return { promptsNone, version: v.out.trim() };
}

// ---------- summary ----------
function writeSummary(reason, o, flags, deadline) {
  const tags = sh('git tag --list "m*"').out.trim().split(/\r?\n/).filter(Boolean);
  const checks = checksPass()
    ? '✓ typecheck, lint and tests pass'
    : `✗ ${lastCheckOutput.split('\n')[0]}`;
  const commits = sh('git log --oneline -30').out.trim();
  const rows = results.map((r) => `| ${r.label} | ${r.outcome} | ${r.exit ?? ''} |`).join('\n');
  const md = `# Overnight run summary

- Started: ${new Date(started).toLocaleString()} · Ended: ${new Date().toLocaleString()} · Deadline: ${new Date(deadline).toLocaleString()}
- Stop reason: **${reason}**
- Claude Code: ${flags.version} · mode: ${o.mode}${o.model ? ` · model: ${o.model}` : ''}
- Milestone tags: ${tags.length ? tags.join(', ') : 'none'}
- Final checks: ${checks}

| Session | Outcome | Exit |
|---|---|---|
${rows || '| — | no sessions ran | |'}

## Last commits

\`\`\`
${commits}
\`\`\`

Full session logs: \`.overnight/logs/\` (not committed). Claude's own notes: \`docs/overnight/MORNING_REPORT.md\`, \`DECISIONS.md\`, \`STATUS.md\`.

**Morning:** read MORNING_REPORT.md → \`npm install\` → \`npm run dev\` → open the Network URL on your phone (same Wi-Fi).
`;
  fs.mkdirSync(path.dirname(SUMMARY), { recursive: true });
  fs.writeFileSync(SUMMARY, md);
  sh('git add -A');
  sh('git commit -q -m "docs(overnight): runner summary"');
  log(`summary written to docs/overnight/RUNNER_SUMMARY.md: ${reason}`);
}

// ---------- main ----------
async function main() {
  const o = parseArgs(process.argv.slice(2));
  const deadline = computeDeadline(o);
  const flags = preflight();

  if (o.check) {
    log(
      `preflight ok: ${flags.version}; --permission-prompts none ${flags.promptsNone ? 'supported' : 'not supported (older version, still fine)'}`,
    );
    log('running one tiny unattended Claude session to test login, flags and permission mode…');
    const res = await runSession(
      'Reply with exactly the text OVERNIGHT-OK and nothing else. Do not use any tools.',
      'check',
      o,
      flags,
      Date.now() + 10 * MIN,
    );
    if (res.code === 0 && /OVERNIGHT-OK/.test(res.out)) {
      log(`✔ check passed. Start the real run with: node scripts/overnight.mjs --until ${o.until}`);
      process.exit(0);
    }
    console.log(res.out.slice(-1500));
    die(
      `check failed (exit ${res.code}). If it mentions auto mode, retry with --mode acceptEdits. Log: ${res.logFile}`,
    );
  }

  const awake = keepAwake();
  let reason = 'all planned work finished';
  let stopping = false;
  process.on('SIGINT', () => {
    if (stopping) process.exit(130);
    stopping = true;
    log('Ctrl+C: stopping after the current session (press again to quit immediately)');
  });

  log(
    `overnight run until ${new Date(deadline).toLocaleString()} · M1–M${o.to}${o.improve ? ' then improvement passes' : ''} · keep-awake: ${awake}`,
  );

  outer: for (let n = 1; n <= o.to; n++) {
    if (hasTag(`m${n}`) || hasTag(`m${n}-auto`)) {
      log(`M${n} already tagged: skipping`);
      continue;
    }
    let attempts = 0;
    for (;;) {
      if (stopping) {
        reason = 'stopped by you (Ctrl+C)';
        break outer;
      }
      if (deadline - Date.now() < 20 * MIN) {
        reason = `deadline reached during M${n}`;
        break outer;
      }
      if (attempts >= o.maxAttempts) {
        reason = `M${n} not verified after ${attempts} session${attempts === 1 ? '' : 's'}: see STATUS.md and the logs`;
        break outer;
      }
      const label = `m${n}-a${attempts + 1}`;
      log(`▶ ${label}: /overnight ${n}`);
      const res = await runSession(`/overnight ${n}`, label, o, flags, deadline);
      checkpoint(label);
      if (isLimited(res)) {
        const wait = Math.min(o.limitWaitMin * MIN, deadline - Date.now() - 20 * MIN);
        results.push({
          label,
          outcome: 'usage limit / overload: waited and retried',
          exit: res.code,
        });
        log(
          `${label}: usage limit or overload detected; waiting ${Math.max(0, Math.round(wait / MIN))} min`,
        );
        await sleep(wait);
        continue;
      }
      attempts++;
      const claimed = claimedDone(n);
      const verified = claimed && checksPass();
      results.push({
        label,
        outcome: verified
          ? '✔ verified'
          : claimed
            ? '✖ claimed DONE but checks fail'
            : res.timedOut
              ? '… time limit: continuing'
              : '… in progress',
        exit: res.code,
      });
      if (verified) {
        sh(`git tag m${n}-auto`);
        log(`✔ M${n} verified and tagged m${n}-auto`);
        break;
      }
      log(`${label}: not verified yet (STATUS says DONE: ${claimed}); next session continues`);
    }
  }

  if (o.improve && reason === 'all planned work finished') {
    for (let k = 1; k <= o.maxImprove; k++) {
      if (stopping) {
        reason = 'stopped by you (Ctrl+C)';
        break;
      }
      if (deadline - Date.now() < 30 * MIN) {
        reason = 'deadline reached during improvement passes';
        break;
      }
      const label = `improve-${k}`;
      log(`▶ ${label}: /overnight improve`);
      const res = await runSession('/overnight improve', label, o, flags, deadline);
      checkpoint(label);
      if (isLimited(res)) {
        const wait = Math.min(o.limitWaitMin * MIN, deadline - Date.now() - 30 * MIN);
        results.push({ label, outcome: 'usage limit / overload: waited', exit: res.code });
        log(
          `${label}: usage limit or overload detected; waiting ${Math.max(0, Math.round(wait / MIN))} min`,
        );
        await sleep(wait);
        k--;
        continue;
      }
      results.push({
        label,
        outcome: checksPass() ? '✔ checks green' : '✖ checks red (next pass fixes first)',
        exit: res.code,
      });
    }
  }

  writeSummary(reason, o, flags, deadline);
  log('done. Good morning!');
}

main().catch((e) => {
  log(`runner crashed: ${e?.stack || e}`);
  process.exit(1);
});
