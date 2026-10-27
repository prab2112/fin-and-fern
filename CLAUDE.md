# Fin & Fern — aquarium shop sim

A portrait, one-thumb mobile web game that becomes an Android app via Capacitor in M5. Single-player and offline. No ads, no in-app purchases, no loot boxes, no analytics, no network calls from the web layer.

- Rules and numbers: `docs/GDD.md` (source of truth).
- Build order and acceptance: `docs/MILESTONES.md`.
- Read the GDD sections a task touches before coding. If the code and the GDD disagree, stop and ask me. When we agree a design change, update the GDD in the same commit.

## Commands

- `npm run dev`: Vite with `--host`. Prints a Network URL for phone testing.
- `npm test`: Vitest, single run (`vitest run`).
- `npm run typecheck`: `tsc --noEmit`.
- `npm run lint`: ESLint plus Prettier check.
- `npm run sim -- --days 30 --seeds 1-20 --policy bot`: headless balance run. See the contract in `docs/MILESTONES.md`.
- `npm run build`: production build to `dist/`.
- From M5: `npx cap sync android`.

## Architecture

- `src/sim/`: pure TypeScript game rules.
  - No React, DOM, `Date`, `Math.random` or I/O.
  - Entry points: `tick(state, dtHours, rng)` and `applyAction(state, action, rng)`, both returning new state.
  - One module per system: water, fish, breeding, genetics, plants, customers, market, imports, progression, goals.
- `src/content/*.json`: every balance number (species, plants, equipment, levels, goals, achievements, events, `balance.json` for global constants). Validated by zod at load. Never hardcode a balance constant in TS.
- `src/state/`: Zustand store around the sim state, plus the fixed-step loop (0.1 game h per step; 1 game h = 10 real s at 1×).
- `src/render/`: Canvas 2D tank renderer. Procedural fish drawn from phenotype; only the open tank animates.
- `src/ui/`: React screens and components.
- `src/platform/`: adapters for clock, storage, haptics, notifications and lifecycle. Web implementations now, Capacitor ones in M5. `src/sim` never imports from here.
- `src/save/`: versioned save format and migrations.
- `scripts/sim.ts`: headless runner over `src/sim` with bot policies.

## Rules

- TypeScript strict, no `any`. Prefer small pure functions.
- Seeded RNG (mulberry32) is passed in explicitly; tests use fixed seeds.
- Every GDD formula gets a Vitest test that uses the GDD's own worked example.
- Convert a daily probability to a per-step one as `1 - (1 - P) ** (stepH / 24)`.
- Real-world days (goals, streak, festivals) come from the injected clock, with the day boundary at 04:00 local. Never derive them from game time.
- Mobile layout:
  - Portrait, 360×640 minimum.
  - Tap targets ≥ 48 px.
  - Nothing hover-only.
  - Primary actions in the bottom half.
- Performance: 40 fish at 60 fps on a mid-range phone, no allocations inside the render loop, devicePixelRatio capped at 2.
- Ask before adding a dependency, and say why.
- Never change the save format without a migration.
- Commit after each green step as `type(scope): summary`. Types: feat, fix, test, refactor, chore, docs, balance.

## Definition of done (per milestone)

1. `npm run typecheck && npm run lint && npm test` are green.
2. `npm run sim` meets the milestone's pacing targets.
3. Every touched screen has been checked via the Playwright MCP (Galaxy S8 emulation, 360×740): screenshot taken, no console errors.
4. The gdd-reviewer subagent reports no blocking issues.
5. The boxes in `docs/MILESTONES.md` are ticked (by me), and the GDD is updated if the design changed.
