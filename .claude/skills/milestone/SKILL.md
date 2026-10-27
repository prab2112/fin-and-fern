---
name: milestone
description: Plan and build one Fin & Fern milestone from docs/MILESTONES.md, test-first, then check balance, screens and review.
argument-hint: "[1-8]"
disable-model-invocation: true
---

Build milestone M$ARGUMENTS of Fin & Fern (the section headed "M$ARGUMENTS" in `docs/MILESTONES.md`).

1. **Orient.** Run `git log --oneline -10` and `git status`. Read the M$ARGUMENTS section of `docs/MILESTONES.md`, every `docs/GDD.md` section it cites, and the rules in `CLAUDE.md`.
2. **Prerequisites.** For M2 onwards, check that the earlier milestones are tagged (`m1`, `m2`, …) and that `npm test` is green. If not, stop and tell me what is missing.
3. **Plan before code.** The plan must list:
   - the files to add or change
   - the sim functions and their signatures
   - content JSON and schema changes
   - the tests you will write first, using the GDD worked examples
   - the UI screens
   - the sim policies and summary rows to add
   - risks and open questions

   Wait for my approval.
4. **Build in thin vertical steps.** For each step: write the failing test, write the code, run `npm run typecheck && npm test`, then commit (`type(scope): summary`). Keep the game runnable after every commit.
5. **Balance.** Run the sim commands that this milestone's acceptance names. From M2 onwards, always include `npm run sim -- --days 60 --seeds 1-20 --policy bot`. Compare against the pacing targets. If a target is missed, propose JSON-only changes with before/after numbers. Don't change formulas.
6. **Screens.** Start `npm run dev` in the background. Using the Playwright MCP, open every screen this milestone touched: take a screenshot, read the console errors, and fix what is broken or cramped at 360 px wide.
7. **Review.** Run the `gdd-reviewer` subagent on this milestone's changes and fix every BLOCKING item.
8. **Report** in this order:
   - each acceptance box with ✓/✗ and its evidence (don't tick the boxes; I tick them after my phone test)
   - sim numbers against the targets
   - the Network URL from `npm run dev` for my phone
   - any GDD changes, with the reason
   - a 5-item playtest checklist for my phone session
