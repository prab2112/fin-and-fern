---
name: playtest
description: Turn rough phone playtest notes (any language, screenshots welcome) into a bug and feel list, then fix them one by one with regression tests.
argument-hint: "<paste notes, attach screenshots>"
disable-model-invocation: true
---

My playtest notes: $ARGUMENTS

1. Rewrite the notes as a numbered list, giving each item one type:
   - **Bug:** expected vs actual, and the likely cause with a file path.
   - **Feel:** what should change, and which GDD number or UI element.

   Ask me only about notes you can't interpret.
2. Fix bugs first.
   - If the cause is in `src/sim`, write a failing test, fix it, run `npm run typecheck && npm test`, and commit `fix(scope): …`.
   - For UI bugs, confirm the fix with a Playwright screenshot at 360×740.
3. Feel items that are numbers change `src/content/*.json` and the matching **(tune)** value in `docs/GDD.md`, never code. Commit as `balance: …`.
4. Feel items that change a rule or formula go to me as a GDD change proposal. Don't implement them yet.
5. Finish with a list: item → fixed / tuned / needs my decision.
