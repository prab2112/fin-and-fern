#!/usr/bin/env node
// Stop hook: when Claude tries to finish a turn with uncommitted changes in
// src/, tests/ or scripts/ and typecheck/tests fail, send it back to fix them.
// At most two forced retries per run of failures, so it can never loop forever.
// Exits 0 (allow stop) whenever there is nothing to check.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_BLOCKS = 2;
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}

const sessionKey = String(input.session_id ?? 'default').replace(/[^\w-]/g, '');
const counterFile = join(tmpdir(), `finfern-quality-gate-${sessionKey}`);
const readBlocks = () => {
  try {
    return Number(readFileSync(counterFile, 'utf8')) || 0;
  } catch {
    return 0;
  }
};
const allowStop = () => {
  rmSync(counterFile, { force: true });
  process.exit(0);
};

// Retry budget used up: let Claude stop and report what is still failing.
if (readBlocks() >= MAX_BLOCKS) allowStop();

// Nothing to check before the M1 scaffold exists.
if (!existsSync(join(root, 'package.json')) || !existsSync(join(root, 'node_modules'))) allowStop();

let changed = '';
try {
  changed = execSync('git status --porcelain -- src tests scripts', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  allowStop(); // not a git repo yet
}
if (!changed) allowStop();

try {
  execSync('npm run -s typecheck && npm test --silent', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 170_000,
  });
  allowStop();
} catch (err) {
  if (err && err.signal) allowStop(); // timed out or killed: don't block on that
  const output = `${err?.stdout ?? ''}${err?.stderr ?? ''}`.trim().slice(-3500);
  writeFileSync(counterFile, String(readBlocks() + 1));
  process.stderr.write(
    'Quality gate: typecheck or tests fail with uncommitted changes in src/, tests/ or scripts/.\n' +
      'Fix them before finishing. If you are deliberately pausing (for example, waiting for my decision), say so and stop.\n\n' +
      output +
      '\n',
  );
  process.exit(2);
}
