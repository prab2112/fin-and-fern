# Fin & Fern — Milestones

Build one milestone at a time with `/milestone N`. Each one ends playable on your phone.

- Tick a box only after checking it yourself.
- Tag each finished milestone (`git tag m1`, `m2`, …). The reviewer subagent diffs against the latest tag.
- `docs/GDD.md` holds the rules. This file holds scope, tests and acceptance.

**Headless sim contract** (built in M1, extended later):

```
npm run sim -- --days 30 --seed 1 --policy basic       # one run, daily table
npm run sim -- --days 60 --seeds 1-20 --policy bot     # many runs, pacing summary
  --policy idle | basic | bot | daily   (daily = bot + one session per real day, fake clock; M4+)
  --json                                (machine-readable output for /balance)
```

The summary prints median, p10 and p90 for every GDD §17 target that the current milestone covers.

---

## M1 — Living tank

**Goal:** a tank of guppies that swim, get hungry and dirty, and can die. State survives a page refresh.

**Build**

- Scaffold: Vite + React + TypeScript (strict) + Zustand + zod + Vitest + ESLint + Prettier. Use the npm scripts and folders listed in `CLAUDE.md`. `npm run dev` must listen on the LAN (`--host`).
- `src/sim`:
  - `rng.ts` (mulberry32) and `time.ts` (fixed step, per-step probability).
  - `water.ts`, `fish.ts` (hunger, temperature, HP, death, happiness subset), `tick.ts`.
  - `actions.ts`: feed, waterChange, setHeaterSetpoint, setSpeed.
- `src/content`:
  - `species.json` with all 12 species and the full schema.
  - `equipment.json`, `tanks.json`, `start.json` (GDD §2).
  - `balance.json` for global constants.
  - A zod schema for each file.
- `src/render/tankRenderer.ts`: procedural guppies coloured by phenotype, wander plus wall avoidance, DPR capped at 2, FPS counter in a debug overlay.
- `src/ui`:
  - Top bar: ₹, day, clock, speed.
  - Tank view with meters and Feed / Water change buttons.
  - Fish info sheet.
  - A tank switcher for the 2 tanks.
  - Debug menu (dev builds only): spawn 40 fish, +1 game day, kill switch for autosave.
- `src/platform/clock.ts` and `src/platform/storage.ts` (web implementations).
- `src/save`: versioned save, autosave every 10 s and on hidden/pagehide, 3 rotating slots, export/import code.
- `scripts/sim.ts`: the contract above, with `idle` and `basic` policies.

**Tests**

- GDD §4 worked examples: water ×3, hunger, HP rules including WQ < 25, death, the happiness example.
- RNG determinism; per-step probability conversion (mean of 100k steps ≈ P).
- Save round-trip and the migration-chain no-op.
- Every content file passes its schema.

**Acceptance**

- [ ] `npm run typecheck && npm run lint && npm test` green
- [ ] `--policy basic --days 30 --seeds 1-20`: 0 deaths
- [ ] `--policy idle`: first death ≥ 2 game days in every seed
- [ ] "Spawn 40 fish" holds ~60 fps on your phone
- [ ] Refresh restores the game; export → import round-trips
- [ ] Portrait 360×740 layout works; every button ≥ 48 px

**Out of scope:** customers, breeding (the starter pregnancy is stored but doesn't give birth yet), plant growth, levels.

---

## M2 — Open shop

**Goal:** earn money. Walk-ins buy fish, you restock from the wholesaler, take orders and level up.

**Build**

- Bottom tab bar (Shop, Tank, Market, Upgrades; Breeding shows as locked).
- Shop screen: tank cards plus customer bubbles.
- Customers (GDD §8) with starMult = 1:
  - Poisson arrivals, wanted-species weights, patience.
  - Serve flow and P(buy).
  - rep, including the sick-fish penalty.
- Price multipliers per species (Market → Prices).
- Wholesaler with the wholesale gene pool and a capacity warning.
- Orders board (GDD §8).
- Market price drift (GDD §9; events come later).
- XP, levels, slots and titles (GDD §11). Level-up toast; unlocks list what is now available.
- Buying tanks; equipment upgrades per tank (filter, heater, light).
- Rescue rule.
- `--policy bot`: a greedy shopkeeper. It restocks to capacity from the wholesaler, prices at 1.0×, serves everyone, feeds daily, changes water when WQ < 60, takes orders it can fill, and buys tanks/filters when affordable.

**Tests**

- P(buy) at 1.0× / 1.5× / 1.8×.
- Arrival mean over 1,000 game days ≈ N.
- Order pay example (10 neons → ₹600).
- XP and level thresholds; slot counts.
- Capacity warning; rescue rule.

**Acceptance**

- [ ] Checks green
- [ ] Bot reaches Lv2 in ≤ 10 real min (median, seeds 1–20)
- [ ] On your phone, a 10-minute session reaches Lv2 and never dead-ends
- [ ] Customers, orders and level-up read clearly at 360 px wide

---

## M3 — Breeding + Aquadex

**Goal:** the treasure hunt. Fish breed, hidden genes show up, and rare morphs are worth more.

**Build**

- Sex and stages (fry / juvenile / adult) with stage-scaled size, load and value. Juveniles sell at 50%; fry can't be sold.
- Breeding (GDD §6):
  - The daily-chance formula, gestation, cooldown, litter size and survival.
  - Inheritance and mutation.
  - Livebearers breed in display tanks.
- Breeding tank + Nursery (Lv2) for egg-layers; "Move juveniles" action.
- Starter pregnancy (GDD §2) with the guaranteed albino.
- Morph value multipliers. The renderer draws every phenotype distinctly; albino is pale with a red eye.
- Aquadex screen:
  - 68 entries with silhouettes and discovery tracking.
  - The +5% bonus for a complete species page.
  - 2–3 care facts per species in `species.json`, each `verified: false`. Never invent facts; leave a TODO if unsure.
- Genetics Lab (Lv5): genotypes on the fish sheet and Punnett odds on the pairing screen.
- SHINY placeholder (a simple toast; the full juice comes in M4).
- Sim: breeding inside `bot` and `basic`; new summary rows for first-albino time, population vs capacity, and fry raised.

**Tests**

- Punnett frequencies: W/A×W/A → 25% albino; W/B×B/A → 50/50/0.
- Mutation rate 1%.
- Survival formula; P(breed) example; cooldown.
- The crowding cap stops fry at 2 × capacity (adult-size count).
- Albino Fancy value = ₹240.
- Aquadex completion bonus.
- The starter litter always contains an albino.

**Acceptance**

- [ ] Checks green
- [ ] First albino ≤ 15 real min in ≥ 90% of seeds
- [ ] `basic` (never sells): no tank exceeds 2× capacity at adult size; 0 deaths over 30 game days
- [ ] Every phenotype is recognisable on your phone screen
- [ ] You have checked (and fixed) the Aquadex facts, then set them `verified: true`

---

## M4 — Gamification core

**Goal:** every session ends with something to claim, and every day has a reason to return.

**Build**

- Injected clock with a fake clock in tests; real-day boundary at 04:00 local.
- Daily goals with templates scaled to level, and the claim flow.
- Streak: the 7-step reward track (never resets) plus the counter with a weekly freeze.
- 42 achievements (14 families × 3 tiers) and an achievements screen.
- Pearls with sinks: decor, backgrounds, themes, timer-skip stub.
- Tank and shop stars; starMult in walk-ins (GDD §12).
- Titles and shopfront art changes.
- Juice:
  - Coin burst, level-up fanfare, SHINY birth (confetti, haptic, banner, zoom), goal chime.
  - Haptics through `src/platform/haptics.ts`.
- Net-catch minigame behind a Settings toggle.
- `--policy daily` (fake clock, one 10-minute session per real day).

**Tests**

- 04:00 reset across a date change.
- Freeze rules: one miss keeps the counter; a second miss in the same week resets the counter but keeps the track.
- Stars example (→ 4★); starMult 5★/1★ = 1.92.
- Goal rewards scale with level.
- Pearl rate: `daily` policy over 14 real days earns 8–12 per day.

**Acceptance**

- [ ] Checks green
- [ ] Pearl-rate target met
- [ ] On your phone, three sessions on different days all end with something claimable
- [ ] Juice never blocks input for more than 1.5 s, and every effect is skippable

---

## M5 — Android app

**Goal:** the same game as an installable Android app, built automatically, with the Play closed test started.

**Build**

- Capacitor (current stable) with the Android platform.
  - `targetSdkVersion` 36.
  - Portrait lock.
  - Safe-area padding so nothing sits under the status or navigation bars (edge-to-edge is enforced at API 36).
- Capacitor implementations of the platform adapters:
  - storage: same JSON, 3 rotating backups, included in Android Auto Backup.
  - haptics.
  - local notifications: permission requested after the first real day, max 2/day (goals ready, a 19:30 streak reminder), no exact-alarm permission.
  - lifecycle: pause the sim on background.
  - back button: close the topmost panel, else minimise.
- GitHub Actions:
  - On every push to `main`: `npm ci` → test → build → `cap sync` → `assembleDebug`, uploading the APK as an artifact.
  - On `v*` tags: a signed `bundleRelease` AAB using the keystore from repository secrets.
- `.claude/skills/release/SKILL.md`: bump `versionCode`/`versionName`, update `CHANGELOG.md`, tag `vX.Y.Z`. Pushing stays manual.

**Your steps** (Claude can't do these)

1. **Choose the applicationId** now, e.g. `in.<yourname>.finandfern`. It can never change after the first Play upload.
2. **Create the upload key** and keep two backups outside the repo:
   `keytool -genkeypair -v -keystore upload-key.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
3. **Add GitHub secrets** (repo → Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   - Get the base64 on macOS with `base64 -i upload-key.jks`.
   - On Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-key.jks"))`.
4. **Play Console:** create the developer account and the app (type: Game), then upload the first AAB to **Internal testing**.
5. **Closed testing:** move to Closed testing and invite 15+ testers. They must stay opted in for 14 continuous days before you can apply for production.

**Acceptance**

- [ ] Debug APK from Actions installs on your phone; cold start < 3 s
- [ ] Save survives force-stop and a phone restart
- [ ] Back gesture works on Android 16; nothing is hidden under the system bars
- [ ] Notifications arrive and respect the 2/day cap
- [ ] APK < 10 MB
- [ ] The signed AAB from a `v*` tag is accepted by Play Console
- [ ] Closed test live with 15+ testers (the 14-day clock is running)

---

## M6 — Plants

**Goal:** plants that grow, need care and pay for it.

**Build**

- Plant system (GDD §7): growth, light match, fertiliser, CO₂ (Lv7), overgrowth, trimming, cuttings (sell or replant).
- Algae, scrubbing, and the clean-up crew (Lv3).
- Moss cover ×2; the full Beauty formula feeding into stars.
- Plant shop.
- Renderer: plants scale with mass; algae overlay.
- Trim goals and the Green Thumb achievement go live.
- `bot` learns to trim, dose and scrub.

**Tests:** Java Fern growth example; algae examples (with and without Amano); Beauty example; cover example; trim yield.

**Acceptance**

- [ ] Checks green
- [ ] On your phone, plants visibly grow over a session, and too much light visibly causes algae
- [ ] Bot pacing still within GDD §17 (re-run `/balance`)

---

## M7 — Imports + festival events

**Goal:** a mid-game of risk and rare stock, plus seasonal reasons to return.

**Build**

- Imports (GDD §10): hubs, delivery times, express shipping, DOA, the import gene pool.
- Quarantine tank, skip-quarantine risk, Ich and medicine.
- Timer skip with Pearls.
- `events.json` with this year's festival dates entered by hand, plus event goals, Festival Tokens, an event shop, an event fish (Gold allele) and demand/price modifiers.
- Import goal and the Globetrotter / Festival Fan achievements go live.
- `bot` imports discus when it can afford them and always quarantines.

**Tests:** import cost example (₹1,640); DOA rates; 30% outbreak on skip; medicine effect; event date windows (fake clock); price-drift mean reversion.

**Acceptance**

- [ ] Checks green
- [ ] Bot reaches Lv4 in 45–75 real min
- [ ] Imported discus have an expected return ≥ 1.5× their cost for the bot
- [ ] An event can be forced on in the debug menu and played through on your phone

---

## M8 — Launch

**Goal:** ready for strangers, and published.

**Build**

- Staff (GDD §11) and offline earnings with the "While you were away" summary.
- Tutorial: a guided first session (feed → water change → serve → buy → breed) in under 3 minutes, skippable.
- Sound: small SFX set, mute toggle, respects the phone's silent mode on Android.
- Play Games Services:
  - A thin custom Capacitor plugin (Java): sign-in, unlock/increment achievements, submit scores.
  - Mirror the 42 achievements.
  - 3 leaderboards: net worth, Aquadex %, most valuable fish bred.
  - The game works fully when signed out.
- Web build as a PWA (manifest + service worker) published on Cloudflare Pages (already auto-deploying from `main`; launch turns off `VITE_DEBUG_TOOLS`).
- A privacy policy page on Cloudflare Pages.

**Your steps**

1. Store listing: icon, feature graphic, phone screenshots, short and full description.
2. Content rating questionnaire and Data safety form. The game itself collects no data; check what the Play Games SDK requires.
3. Target audience: if you include ages under 13, Google Play's Families policy applies, with extra requirements and review.
4. After the 14-day closed test, apply for production access and answer its questions.

**Acceptance**

- [ ] Checks green
- [ ] Bot reaches Lv10 in 8–12 real hours
- [ ] A new tester finishes the tutorial in < 3 min without help
- [ ] Achievements and leaderboards appear in Play Games on a real device (installed from a Play testing track)
- [ ] Production release approved
