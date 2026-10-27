---
name: balance
description: Run the headless Fin & Fern sim across seeds, compare with the GDD §17 pacing targets, and tune numbers in src/content JSON only.
argument-hint: "[optional focus, e.g. Lv4 too slow]"
disable-model-invocation: true
---

Balance pass. Focus: $ARGUMENTS

1. Run `npm run sim -- --days 60 --seeds 1-20 --policy bot --json`. Also run `basic`, `idle` and (from M4) `daily` when the targets need them.
2. For each `docs/GDD.md` §17 target that the finished milestones cover, show ✓/✗ with the median and p10/p90.
3. For each ✗, propose the smallest change to `src/content/*.json`, one knob per target where possible, and predict its effect. Never change formulas or TypeScript in a balance pass.
4. Wait for my approval. Then apply the changes, re-run the same seeds, and show before/after.
5. Update the matching **(tune)** numbers in `docs/GDD.md` and commit as `balance: <what changed>`.
