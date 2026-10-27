---
name: overnight
description: Unattended overnight work on Fin & Fern, started by scripts/overnight.mjs. Builds one milestone end to end without asking questions, or runs one improvement pass.
argument-hint: "[1-4 | improve]"
disable-model-invocation: true
---

You are running **unattended**: no human will read anything until morning. Task: **$ARGUMENTS**. If it's a number N, follow part A for milestone MN. If it's `improve`, follow part B.

## Ground rules

These override anything in other skills or docs that says to wait for me.

- **Never ask questions or wait for approval.** Decide from `docs/GDD.md`, `CLAUDE.md` and the code. Log every non-obvious decision in `docs/overnight/DECISIONS.md` with the milestone, the decision, why, and how to revert it.
- **Stay inside this repo.**
  - Never push, never force anything, never delete branches or tags, never change git config.
  - Never edit `.claude/` or `scripts/overnight.mjs`.
- **No interactive generators.** Don't use `npm create`/`npm init` wizards; write the scaffold files directly.
- **Dependencies:** only the M1 stack and its usual dev tooling:
  - runtime: react, react-dom, zustand, zod
  - build: vite, @vitejs/plugin-react, typescript
  - tests: vitest, jsdom
  - lint: eslint with typescript-eslint and React plugins, prettier
  - scripts: tsx
  - @types/*

  Anything else goes into DECISIONS.md as a proposal; don't install it.
- **No Android, Capacitor or Play work.** M5 and later need me.
- **Formulas follow the GDD.** Change a formula only if the GDD contradicts itself. In that case, pick the reading closest to the GDD §0 pillars, update the GDD text in the same commit, and log it.
- **Balance changes are JSON-only.** Update the matching **(tune)** numbers in the GDD and log each change.
- **Commit after every green step** (`type(scope): summary`). After each commit, update the "Next steps" list in `docs/overnight/STATUS.md`, so a session that gets cut off leaves a trail.
- **Leave the tree clean.** Before you finish, commit everything; use `wip(scope): …` for an unfinished step.
- **Stop every background process you start** (dev server, preview) before you finish. The overnight runner waits on them.

## A. Milestone N

1. **Resume.** Read `docs/overnight/STATUS.md` (create it if missing) and `git log --oneline -15`. If MN is partly done, continue from its "Next steps".
2. **Read** the MN section of `docs/MILESTONES.md`, the GDD sections it cites, and `CLAUDE.md`.
3. **Plan.** If `docs/overnight/plan-mN.md` doesn't exist yet, write it with:
   - files to add or change
   - function signatures
   - content and schema changes
   - the tests to write first
   - screens
   - sim policies
   - risks

   Commit it. Don't wait for approval.
4. **Build** in thin vertical steps, test-first. After each step, run `npm run typecheck && npm test`, then commit. Keep the game runnable after every commit.
5. **Simulate.** Run the sim checks this milestone's acceptance names; from M2, include `npm run sim -- --days 60 --seeds 1-20 --policy bot`. If a target is missed, tune the JSON and log the change.
6. **Screens, if the playwright MCP tools work:**
   1. Run `npm run build`, then start `npx vite preview --port 4173 --strictPort` in the background.
   2. Screenshot every screen this milestone touched at 360×740, and play it briefly through the UI.
   3. Fix console errors, broken flows and cramped layouts.
   4. If the tool can write files, save the final screenshots as `docs/overnight/screens/mN-*.png`.
   5. Stop the preview server.

   If the MCP isn't available, skip this step and say so in the report.
7. **Review.** Run the `gdd-reviewer` subagent and fix every BLOCKING item. Then run `npm run typecheck && npm run lint && npm test` again.
8. **Status.** In `docs/overnight/STATUS.md`, write the line `MN: DONE` only if `npm run typecheck && npm run lint && npm test` all pass and every acceptance item that doesn't need a phone or a human is met. Otherwise write `MN: IN PROGRESS` with a precise "Next steps" list.
9. **Report.** Append a "MN" section to `docs/overnight/MORNING_REPORT.md`:
   - what was built
   - each acceptance item as ✓ / ✗ / needs-phone
   - sim numbers vs targets
   - decisions made
   - known issues
   - a 5-item checklist for my phone playtest

   Commit.

If MN finishes and there's plenty of room left in this session, stop anyway. The runner verifies MN and starts the next milestone in a fresh session.

## B. Improvement pass (`improve`)

1. **Read** `docs/overnight/MORNING_REPORT.md`, `DECISIONS.md` and `STATUS.md`, including their known issues.
2. **Fix red checks first.** If `npm run typecheck && npm run lint && npm test` isn't green, fix that before anything else.
3. **Gather evidence:**
   - run `npm run sim -- --days 60 --seeds 1-20 --policy bot`
   - run the `gdd-reviewer` subagent
   - if the playwright MCP works, self-playtest through the UI at 360×740 for about 10 game days: feed, change water, serve customers, buy stock, breed, claim goals. Note bugs, dead ends, confusing UI and slow frames.
4. **Pick the 3–5 highest-value fixes**, in this order of priority: bugs, then missed pacing targets, then confusing UX, then visual polish. Fix each one test-first where possible and commit each.
5. **Stay in scope.** Never start the scope of a new milestone.
6. **Report.** Append "Improvement pass" (numbered) to MORNING_REPORT.md with what changed and the evidence before and after. Commit.
