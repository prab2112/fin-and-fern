# START HERE — building Fin & Fern with Claude Code

This folder is a starter kit: the game design, the build plan, and Claude Code configuration. Claude Code writes the code, one milestone at a time. You approve plans, test on your phone and steer.

## What's in the kit

| Path | Purpose |
|---|---|
| `docs/GDD.md` | Game design: every rule, formula and number. The source of truth. |
| `docs/MILESTONES.md` | 8 milestones with scope, tests and acceptance boxes. |
| `CLAUDE.md` | Project instructions Claude Code loads in every session. |
| `.claude/skills/milestone` | `/milestone N`: plan → build test-first → balance → screenshots → review → report. |
| `.claude/skills/balance` | `/balance`: run the headless sim over 20 seeds and tune numbers in JSON only. |
| `.claude/skills/playtest` | `/playtest <notes>`: turn your phone notes into fixes with regression tests. |
| `.claude/skills/overnight` + `scripts/overnight.mjs` | Unattended overnight build of M1–M4 plus improvement passes (section 2b). |
| `.claude/agents/gdd-reviewer.md` | A fresh-eyes reviewer that checks each milestone against the GDD. |
| `.claude/settings.json` | Sessions start in Plan mode; safe commands are pre-approved; force-push and key files are blocked; a Stop hook won't let Claude finish while tests fail (max 2 retries). |
| `.mcp.json` | Playwright MCP, so Claude can open the game on an emulated 360 px phone screen, take screenshots and read console errors. |

## 1. One-time setup (≈ 30 min)

**1. Install the basics.**
- Node.js LTS (22 or newer) and Git.
- Google Chrome, which Playwright drives.
- On Windows, also install Git for Windows (it provides Git Bash for Claude Code).

**2. Install Claude Code.** In a terminal:

```bash
# macOS / Linux / WSL
curl -fsSL https://claude.ai/install.sh | bash
```

```powershell
# Windows PowerShell
irm https://claude.ai/install.ps1 | iex
```

Open a new terminal and run `claude --version` to check. Claude Code needs a Pro, Max, Team or Enterprise plan (or a Console account).

**3. Make it a git repo.** Unzip this kit, then:

```bash
cd fin-and-fern
git init
git add -A
git commit -m "docs: design + Claude Code kit"
```

Create a **private** GitHub repo and push to it. You'll need it for the Android builds in M5.

**4. Start Claude Code** in the folder with `claude`.
- Log in through the browser when asked.
- Trust the folder.
- Approve the `playwright` MCP server when prompted. Run `/mcp` to check that it's connected.
- **Windows:** if the playwright server won't start, edit `.mcp.json` so the command is `"cmd"` and the args start with `"/c", "npx", …`.

## 2. The milestone loop (repeat for M1 → M8)

1. **Start.** Run `claude`. The status bar shows `⏸ plan mode on`, because the kit makes every session start in Plan mode.
2. **Kick off.** Type `/milestone 1`. Claude reads the docs and writes a plan. Read it:
   - `Ctrl+G` opens the plan in your editor if you want to edit it.
   - **No, keep planning** lets you push back.
   - **Yes, and use auto mode** (or **Yes, auto-accept edits**) approves it.
3. **Let it work.** Claude writes tests first, commits each green step, runs the sim, screenshots the screens and runs the reviewer.
   - `Esc` interrupts.
   - `Esc Esc` on an empty prompt, or `/rewind`, rolls back code and/or conversation.
4. **Phone test.** Claude's final report includes the Network URL from `npm run dev`. Open it on your phone on the same Wi-Fi and play for 10 minutes. On Windows, allow Node through the firewall for Private networks.
5. **Fix.** Type `/playtest` and paste your notes (Hinglish is fine; screenshots help).
6. **Close the milestone.**
   - Tick the boxes in `docs/MILESTONES.md`.
   - Tag it with `git tag m1`, then `git push --follow-tags`.
7. **Reset.** Run `/clear` before the next milestone. The docs carry the memory, not the chat.

Run `/balance` after M2, M3, M6, M7 and M8, or whenever the pacing feels off.

## 2b. Overnight run (unattended)

`scripts/overnight.mjs` keeps Claude Code working while you sleep:

- It builds M1 → M4 in fresh headless sessions (`claude -p "/overnight N" --permission-mode auto`).
- It verifies each milestone itself: `docs/overnight/STATUS.md` must say `MN: DONE`, and typecheck, lint and tests must pass. Then it tags `mN-auto`.
- It retries up to 3 sessions per milestone and waits out usage limits.
- Once M1–M4 are done, it runs improvement passes until the deadline.

```bash
cd fin-and-fern
node scripts/overnight.mjs --check          # 1 minute: login, flags, git: must say "check passed"
node scripts/overnight.mjs --until 07:00    # the real run: leave this terminal open
```

- **Keep the laptop plugged in with the lid open.** The runner blocks sleep on macOS (`caffeinate`) and Windows (a power request), but closing the lid can still sleep it. On Windows, also check Settings → System → Power → "Lid close action: Do nothing" when plugged in.
- **If the check mentions auto mode,** add `--mode acceptEdits` to both commands.
- **Optional:** add `--model opus` for the strongest model; it uses your plan's limit faster.
- **In the morning:**
  1. Read `docs/overnight/RUNNER_SUMMARY.md` (what ran), `MORNING_REPORT.md` (what was built, decisions, playtest checklist) and `DECISIONS.md`.
  2. Run `npm install`, then `npm run dev`, and open the Network URL on your phone.
  3. Run `/playtest` with your notes. Tag `mN` (without `-auto`) once you've checked a milestone on your phone.
- **Hard limits:** the runner never pushes, never touches Android or Play (M5 needs you), and only installs the M1 stack. Session logs are in `.overnight/logs/`.

## 3. Habits that keep the game good

- **One milestone per session.** If a session gets long, use `/compact`.
- **GDD first.** Rules change in `docs/GDD.md` first, then in code. Numbers change in `src/content/*.json`, never in TypeScript.
- **Model choice.** Use `/model` to pick Opus when planning M1, M3 and M5, the architecture-heavy ones. A faster model is fine for `/playtest` and UI polish.
- **You tick the boxes.** Claude reports ✓/✗ with evidence; you confirm on your phone.

## 4. Steer from your phone

- **Remote Control.** Start with `claude --remote-control` (or type `/remote-control` in a running session) and scan the QR code with the Claude app. Your laptop keeps running the session; you chat from your phone. The laptop must stay awake with the session open.
- **Cloud sessions** (optional, after pushing to GitHub). Start a task from claude.ai/code or the Code tab in the Claude mobile app. Claude works in a cloud VM and pushes a branch for you to review. This is good for small, well-defined jobs like care facts, content JSON or a contained bug. It isn't suited to phone testing or Android builds.

## 5. Android (M5) — the steps only you can do

`docs/MILESTONES.md` → M5 → "Your steps" has the exact commands. In short:

1. Choose a permanent applicationId.
2. Create an upload keystore with `keytool` and back it up in two places.
3. Add 4 GitHub secrets.
4. Create the Play Console app and upload to Internal testing.
5. Start a Closed test with 15+ testers. They must stay opted in for 14 continuous days before you can apply for production.

## Troubleshooting

- **`claude: command not found`:** open a new terminal. If it still fails, see code.claude.com/docs/en/troubleshoot-install.
- **"Quality gate" message:** tests or typecheck are failing with uncommitted changes. Claude gets up to 2 tries to fix them, then stops and tells you what is still red.
- **Skills don't show:** type `/` in Claude Code. The skills live in `.claude/skills/*/SKILL.md`.
- **The playwright server shows "pending approval":** run `claude` interactively and approve it. `claude mcp reset-project-choices` makes Claude Code ask again.
