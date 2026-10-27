# Fin & Fern — Game Design Document (v1)

Working title. An aquarium-shop simulation: keep fish healthy, breed rare colour morphs, grow plants, buy, sell and import stock, and grow a 2-tank street stall into an aquatics showroom.

- Platform: portrait, one-thumb mobile web first; Android app via Capacitor from M5.
- Sessions: 5–15 minutes. Single-player, offline, free. No ads, no in-app purchases, no loot boxes, no analytics.
- This file is the source of truth for rules and numbers. Numbers marked **(tune)** are v1 defaults: they live in `src/content/*.json` and `/balance` may change them (update this file in the same commit). Formulas change only by editing this file first.

---

## 0. Pillars

1. **Care that feels alive.** Fish visibly react to food, water and temperature.
2. **Breeding as treasure hunting.** Hidden recessive genes, rare morphs and "SHINY!" births.
3. **A shop that grows.** Stall → showroom, more tanks, rarer species, imports.
4. **Kind pressure.** A missed day never wipes progress. Fish die only after sustained neglect, and never while the app is closed.

---

## 1. Time

- 1 game hour = 10 real seconds at 1×. 1 game day = 24 game hours = 240 s = 4 real minutes.
- Speeds: ⏸, 1×, 2×.
- Fixed-step simulation: `SIM_STEP_H = 0.1` game hours. The loop accumulates `realDtSeconds × speed / 10` and runs whole steps; rendering interpolates between steps.
- A daily probability `P` becomes a per-step probability `p = 1 − (1 − P)^(SIM_STEP_H / 24)`.
- When the app is closed or in the background, the sim clock stops. Offline earnings are covered in §11.
- Real-world days (daily goals, streaks, festivals) come from the device's local date, with the day boundary at **04:00**. Never derive them from game time.

---

## 2. Starting state

- ₹1,000, 0 rep, Lv1, 50 food units.
- Two display tanks: 40 L each, filter L1, no heater, light L1.
- Tank A holds 4 adult guppies and 2 Java Ferns (mass 1.0 each). Tank B is empty.
- Every starting fish has HP 100 and hunger 20. Newborn fry start with HP 100 and hunger 0.

Notation: guppy colour alleles W (Wild) > B (Blue) > A (Albino); tail alleles N (Normal) > F (Fancy).

| Fish | Sex | Genotype | Note |
|---|---|---|---|
| Guppy 1 | ♀ | W/A N/F | Pregnant. Stored sire genes W/A N/N. Due at game hour 30 (≈ 5 real min). |
| Guppy 2 | ♀ | W/W N/N | |
| Guppy 3 | ♂ | W/B N/N | Carries Blue |
| Guppy 4 | ♂ | W/W N/N | |

**Starter litter (tutorial):** 10 fry, all survive, and at least one is A/A. If the normal roll gives none, re-roll one fry's colour locus as A/A. This guarantees the first "SHINY!" moment in the first session.

---

## 3. Tanks and equipment

| Item | Effect | Price ₹ (tune) | Unlock |
|---|---|---|---|
| Tank 40 L | capacity 8 size units | 400 | Lv1 |
| Tank 100 L | capacity 20 | 1,500 | Lv3 |
| Showroom tank 300 L | capacity 60 | 8,000 | Lv10 |
| Filter L1 / L2 / L3 | filterPower 1 / 2 / 4 | included / 600 / 2,000 | Lv1 |
| Heater none / L1 / L2 / L3 | max setpoint = room / 27 / 29 / 31 °C | — / 300 / 800 / 2,000 | Lv1 |
| Light L1 / L2 / L3 | intensity 1 / 2 / 3 | included / 500 / 1,500 | Lv1 |
| CO₂ kit | plant growth ×1.5 | 3,000 | Lv7 |
| Breeding tank + Nursery | one pair; fry raised in Nursery | free on unlock | Lv2 |
| Quarantine tank | holds up to 10 imported fish | free on unlock | Lv3 |

- `capacity = V / 5` size units.
- `load = Σ speciesSize × stageFactor`, where stageFactor is fry 0.2, juvenile 0.5 and adult 1.0.
- Equipment resale value is 50% of the price paid.

---

## 4. Water, food, temperature, health, happiness

### Water quality

- Dirt `D` is in [0, 100] and `WQ = 100 − D`.
- Per game hour: `ΔD = (0.4 × load − filterPower − 0.1 × plantMass) × 40 / V`. Clamp D to [0, 100]. (0.4 and 0.1 are tune)
- **Water change:** `D ← D / 2`. Free, with a 1 game-hour cooldown per tank.

Worked examples (unit tests):

- 40 L, 6 adult guppies (load 6), filter L1, no plants: ΔD = 1.4/h. After 24 h, D = 33.6 and WQ = 66.4.
- 40 L, 6 guppies, filter L2, plantMass 4.0: ΔD = 2.4 − 2 − 0.4 = 0, so the tank holds steady.
- 100 L, load 10, filter L2, plantMass 2.0: ΔD = (4 − 2 − 0.2) × 0.4 = 0.72/h.

### Food

- Hunger rises 3 per game hour, capped at 100 (tune).
- **Feed (per tank):** every fish in the tank goes to hunger 0. It consumes `max(1, ceil(load / 4))` food units.
- **Overfeeding:** if mean hunger before feeding was below 20, D rises by 5.
- A food tin is 50 units for ₹100 (tune).

### Temperature

- Room temperature `ROOM_T = 25 °C` (tune).
- T moves toward its target at 1 °C per game hour. The target is `max(ROOM_T, setpoint)` with a heater, else `ROOM_T`.
- The player sets the setpoint up to the heater's maximum.

### Health

- A fish has a problem for each of these that is true:
  - WQ < 50
  - T outside its species range
  - hunger > 80
  - its tank has an active Ich outbreak (§10)
- HP per game hour:
  - +1 when there are no problems (max 100).
  - Otherwise −2 per problem; WQ < 25 counts as −5 instead of −2; Ich is −3.
  - Sensitive species (discus) take double damage. (tune)
- A fish dies at HP ≤ 0. The body is removed, D rises by 2 × size (species size × stageFactor, as in load), and a gentle toast is shown.
- A fish is **sick** below 40 HP: it shows an icon and swims slowly. Selling a sick fish costs 3 rep.
- Worked example: from a fresh feed with nothing else wrong, hunger passes 80 after 27 h. Then HP drops 2/h, so death comes after another 50 h: 77 game hours ≈ 12.8 real minutes at 1×.

### Happiness

Happiness `H` in [0, 100] is recomputed each step; it is not stored.

```
H = clamp(70
          + 15 × [cover ≥ 0.3]
          + 5 × min(decorCount, 3)
          − 100 × max(0, load / capacity − 1)
          − 20 × [species below its school size in this tank]
          − 30 × [conflict]
          − 10 × [WQ < 50], 0, 100)
```

- **Conflict** means either more than one adult male betta in the tank, or a flowerhorn with any tankmate. It applies to every fish in that tank.
- Worked example: 40 L tank, 10 adult guppies (25% over capacity), cover 0.5, no decor, WQ 60 → H = 70 + 15 − 25 = 60.

---

## 5. Fish and species

- **Fish record:** `id, speciesId, sex, ageH, genes {locus1:[a,b], locus2:[a,b]}, hp, hunger, origin ('bred'|'bought'|'imported'|'reward'), pregnancy? {sireGenes, dueAtH}, cooldownUntilH`.
- **Stages:** fry 0–24 h, juvenile 24–72 h, adult ≥ 72 h. Fish don't die of old age.
- **Phenotype:** for each locus, the first allele in dominance order present in the genotype is expressed.
- **Value:** `value = marketPrice(species) × mult(locus1 phenotype) × mult(locus2 phenotype) × stageMult × aquadexBonus`.
  - stageMult: fry 0 (unsellable), juvenile 0.5, adult 1.
  - aquadexBonus is 1.05 once that species' Aquadex page is complete, else 1.
  - Worked example: an adult Albino Fancy guppy at market ₹30 is worth 30 × 4 × 2 = ₹240.

### Species (base prices tune)

| id | Name | Kind | Size | Temp °C | Base ₹ | Unlock | Source | Traits |
|---|---|---|---|---|---|---|---|---|
| guppy | Guppy | livebearer | 1 | 22–28 | 30 | Lv1 | wholesale | |
| danio | Zebra Danio | egg-layer | 1 | 18–26 | 25 | Lv1 | wholesale | school 6 |
| platy | Platy | livebearer | 1 | 20–26 | 40 | Lv2 | wholesale | |
| neon | Neon Tetra | egg-layer | 0.5 | 22–26 | 35 | Lv2 | wholesale, Brazil | school 6 |
| molly | Molly | livebearer | 1.5 | 24–28 | 60 | Lv2 | wholesale | |
| swordtail | Swordtail | livebearer | 1.5 | 22–28 | 70 | Lv3 | wholesale | |
| goldfish | Goldfish | egg-layer | 3 | 18–25 | 80 | Lv3 | wholesale | |
| betta | Betta | egg-layer | 1 | 24–30 | 250 | Lv4 | Thailand | territorial males |
| angel | Angelfish | egg-layer | 3 | 24–30 | 400 | Lv5 | Singapore | |
| discus | Discus | egg-layer | 4 | 28–31 | 1,500 | Lv6 | Singapore, Brazil | sensitive |
| flowerhorn | Flowerhorn | egg-layer | 6 | 26–30 | 3,000 | Lv8 | Thailand | solitary |
| arowana | Silver Arowana | import-only | 10 | 24–30 | 8,000 | Lv10 | Brazil | needs ≥ 300 L, no breeding |

**Clean-up crew** (Lv3, wholesale; not in the Aquadex):

- Amano Shrimp: ₹60, size 0.3, eats 1 algae/h.
- Otocinclus: ₹80, size 0.3, eats 1 algae/h, school 3.
- Neither breeds. Both need food and clean water like other fish.

### Morph loci (alleles listed dominant → recessive, with value multipliers)

| Species | Locus 1 (colour) | Locus 2 |
|---|---|---|
| guppy | Wild ×1 > Blue ×1.5 > Albino ×4 | tail: Normal ×1 > Fancy ×2 |
| danio | Wild ×1 > Golden ×1.5 > Albino ×3 | fin: Short ×1 > Longfin ×1.8 |
| platy | Wild ×1 > Red ×1.3 > Blue ×2.5 | fin: Normal ×1 > Hi-fin ×1.8 |
| neon | Neon ×1 > Diamond ×2 > Albino ×3 | fin: Short ×1 > Longfin ×2 |
| molly | Black ×1 > Dalmatian ×1.5 > Gold ×3 | body: Normal ×1 > Balloon ×1.8 |
| swordtail | Green ×1 > Red ×1.3 > Pineapple ×2.5 | fin: Normal ×1 > Lyretail ×2 |
| goldfish | Orange ×1 > Calico ×1.6 > Black ×2.5 | tail: Single ×1 > Fantail ×2 |
| betta | Red ×1 > Blue ×1.3 > Koi ×4 | tail: Veil ×1 > Halfmoon ×2.5 |
| angel | Silver ×1 > Marble ×1.5 > Platinum ×4 | fin: Normal ×1 > Veil ×1.8 |
| discus | Brown ×1 > Blue Diamond ×2 > Albino Red ×4 | pattern: Plain ×1 > Snakeskin ×2 |
| flowerhorn | Classic ×1 > Golden ×1.5 > Pearl ×4 | head: Small ×1 > Big Kok ×2.5 |
| arowana | variant fixed at import: Silver ×1 or Black ×1.6 | — |

**Gene pools:**

- **Wholesale fish:** each allele is the dominant allele, except a 10% chance per locus that one allele is a random recessive.
- **Imported fish:** each allele has a 30% chance of being a random recessive. Imports are how fresh rare genes enter the shop.

---

## 6. Breeding and genetics

- **Eligible pair:** an adult ♂ and an adult ♀ of the same species in the same tank.
  - Livebearers breed in any display tank.
  - Egg-layers breed only in the breeding tank (Lv2).
  - Each female rolls once per step against a random eligible male.
- **Daily chance:** `P = base × HP♀/100 × H/100 × (WQ ≥ 70 ? 1 : 0.25)`. base is 0.5 for livebearers and 0.2 for egg-layers (tune). Convert to a per-step chance with §1.
  - Worked example: livebearer, HP 100, H 60, WQ 75 → P = 0.30 per game day.
- **Conception:**
  - Livebearer: the female becomes pregnant.
  - Egg-layer: eggs appear in the breeding tank.
  - Due in 24 game hours (tune). The sire's genes are stored at conception, so the male can be sold afterwards.
- **Cooldown:** no new pregnancy while pregnant, nor for 48 h after birth (tune).
- **Birth:**
  - Litter size `n = randint(6, 20)` (tune).
  - Each fry survives with `S = 0.3 + 0.6 × cover` in a display tank, or 0.9 in the breeding tank (tune).
  - Breeding-tank fry go to the Nursery and must be moved to a display tank once they are juveniles.
  - Worked example: cover 0.5 → S = 0.6.
  - **Crowding:** in a display tank, surviving fry are added one at a time and stop surviving once the tank's adult-size count (every fish counted at its full adult size) reaches 2 × capacity. The starter litter is exempt. Without this rule, a tank nobody sells from overshoots to 2–4× capacity (checked in a quick simulation), which would break the render budget.
- **Inheritance:** at each locus the child takes one random allele from each parent.
- **Mutation:** per fry, per locus, 1% chance that one allele is replaced by a uniformly random allele of that locus (tune).
- **SHINY moment:** a fry triggers it if its colour multiplier is ≥ 4, or if its phenotype is a first-ever Aquadex discovery (§12).
- **Genetics Lab (Lv5):** reveals every fish's genotype. The pairing screen shows offspring phenotype odds (Punnett square).

Worked examples (unit tests with ≥ 100,000 fry, fixed seed):

- W/A × W/A gives 25% Albino (±0.5%).
- W/B × B/A gives 50% Wild, 50% Blue, 0% Albino.
- The mutation rate measures 1% (±0.1%).

---

## 7. Plants and algae

| id | Name | Light need | Growth rate (mass/h) | Beauty note | Price ₹ | Unlock |
|---|---|---|---|---|---|---|
| javafern | Java Fern | 1 | 0.010 | | 50 | Lv1 |
| anubias | Anubias | 1 | 0.008 | | 80 | Lv1 |
| moss | Java Moss | 1 | 0.020 | counts ×2 for cover | 40 | Lv2 |
| val | Vallisneria | 2 | 0.030 | | 60 | Lv3 |
| rotala | Rotala | 3 | 0.040 | | 90 | Lv5 |
| lotus | Red Tiger Lotus | 2 | 0.025 | streak reward | 200 | Lv6 |

All rates and prices are tune.

### Growth and trimming

- Per game hour: `Δm = rate × lightMatch × fertFactor × (CO₂ ? 1.5 : 1)`.
  - `lightMatch = max(0, 1 − 0.4 × |tankLight − need|)`.
  - `fertFactor = 0.5 + F / 200`. Fertiliser F is in [0, 100], drains 10 per game day, and a dose costs ₹50 for +50.
  - Worked example: Java Fern at light 1 with F = 100 gains 0.24 mass per game day.
- A new plant starts at mass 1.0.
- **Overgrown:** mass ≥ 2.5.
- **Trim:** mass returns to 1.0 and the plant yields `floor(m_before − 1.0)` cuttings. A cutting sells for 40% of the plant price, or can be replanted for free.

### Cover and algae

- `cover = min(1, Σ effectiveMass / (V / 10))`, where moss counts ×2. Worked example: 2 Java Ferns in 40 L → cover 0.5.
- Algae A is in [0, 100]. Per game hour: `ΔA = 2 × max(0, light − 3 × cover) − algaeEaterCount`. Clamp to [0, 100].
  - Worked example: 40 L, light 2, cover 0.5 → +1/h. With one Amano shrimp → 0/h.
- **Scrub:** A ← 0. Free, with a 1 h cooldown.

### Beauty

`Beauty = clamp(60 × cover + 10 × min(decorCount, 4) − 0.5 × A − 10 × overgrownCount, 0, 100)`

- Worked example: cover 0.5, 2 decor, A = 20, one overgrown plant → 30 + 20 − 10 − 10 = 30.
- Before M6, plants are static at mass 1.0 and A stays 0.

---

## 8. Customers, pricing, orders, wholesaler

### Walk-ins

- Per game day: `N = (8 + rep / 5) × starMult`.
  - `starMult = 0.5 + 0.15 × shopStars` from M4. Before M4, starMult = 1.
- Arrivals are a Poisson process with rate N / 24 per game hour (per step: `rate × SIM_STEP_H`).
- **Wanted species:** drawn from unlocked species with weight `1 / sqrt(basePrice)` × event demand multiplier.
- **Morph requests:** 20% of customers want a specific phenotype, drawn from the discovered Aquadex entries of that species.
- **Patience:** 2 game hours; the bubble shows the wanted fish and a timer.

### Serving and pricing

- **Serving:** tap the bubble. The game proposes the best match: a sellable fish, healthiest first, lowest value first unless a morph was requested.
- **Asking price:** `askPrice = value × priceMult(species)`. priceMult is set by the player per species, from 0.5 to 2.0, default 1.0.
- **Buy chance:** `P(buy) = clamp(1.8 − askPrice / value, 0, 1)`. That gives 0.8 at 1.0×, 0.3 at 1.5× and 0 at 1.8× or more.
- **On a sale:**
  - ₹ += askPrice.
  - rep +1, or +2 if a morph request was met.
  - If the fish was sick (HP < 40), rep −3 instead.
- No sale, no stock, or a timeout: the customer leaves with no penalty.

### Wholesaler

- Always open. Sells adults of wholesale species at 50% of current market price, using the gene pools in §5.
- Delivery is instant into a chosen tank, with a warning if the tank goes over capacity.

### Orders board

- Up to 3 open orders. A new one appears each game day while fewer than 3 are open.
- Each order asks for species s (unlocked, wholesale or bred) and quantity `q = randint(3, 12)` adults, with a deadline of 2–3 game days.
- Pay is `round(q × marketPrice × 1.7 / 10) × 10`, plus 5 rep and 20 XP.
- **Deliver:** the game picks the lowest-value matching fish.
- Expired orders vanish with no penalty.
- Worked example: 10 neons at ₹35 → ₹600.

---

## 9. Market prices

- Each species has a market price p, starting at its base price.
- At each game-day rollover: `p ← p + 0.2 × (base − p) + noise`, where `noise ~ U(−0.05, 0.05) × p`. Clamp p to [0.5, 2] × base.
- Festival events (§12) multiply demand weights and/or prices while active.

---

## 10. Imports, quarantine, disease (M7)

- **Unlock:** Lv4.
- **Hubs and delivery times:**
  - Thailand (betta, flowerhorn): 2 days.
  - Singapore (angel, discus): 1 day.
  - Brazil (neon, discus, arowana): 3 days.
  - Express shipping makes any hub 1 day.
- **Cost per fish:** `0.4 × base × 1.2` (duty). Shipping per order is ₹200 standard or ₹500 express. Up to 10 fish per order.
  - Worked example: 2 discus, standard → 2 × 720 + 200 = ₹1,640.
- **Dead on arrival:** each fish has a 15% chance (5% with express).
- **Arrival:** fish go to the quarantine tank for 48 game hours.
- **Skip quarantine:** fish go straight to a display tank, with a 30% chance of starting an Ich outbreak there.
- **Ich:**
  - Every fish in the tank takes −3 HP/h; it counts as a problem (§4).
  - Medicine costs ₹150 per tank. It halves the damage at once and ends the outbreak after 24 h.
  - Any tank with WQ < 30 also has a 2% chance per game day of a spontaneous outbreak.
- **Timer skip:** 5 Pearls removes 24 game hours from one import in transit or in quarantine.

All numbers in this section are tune.

---

## 11. Progression, staff, offline

### XP and levels

- XP: +1 per ₹10 of sale or order revenue, +20 per completed order, plus goal rewards (§12).
- Cumulative XP thresholds (tune): Lv2 60 · Lv3 250 · Lv4 700 · Lv5 1,500 · Lv6 3,000 · Lv7 5,500 · Lv8 9,500 · Lv9 15,000 · Lv10 23,000.
- Display tank slots: Lv1 2 · Lv2 3 · Lv3 4 · Lv4 5 · Lv5 6 · Lv6 7 · Lv7 8 · Lv8 9 · Lv9 10 · Lv10 12.
- Unlocks: see the species, equipment and plant tables. Also: Lv2 breeding tank and Nursery; Lv3 quarantine and clean-up crew; Lv4 imports; Lv5 Genetics Lab; Lv6 staff; Lv7 CO₂; Lv10 showroom tank.
- **Titles:** Street Stall (Lv1–2) → Fish Corner (Lv3–5) → Aqua Store (Lv6–9) → Aquatics Showroom (Lv10). Each title changes the shopfront art.

### Staff (Lv6, M8; wages per game day, tune)

- **Feeder, ₹200:** feeds any tank whose mean hunger is above 60.
- **Cleaner, ₹250:** water change when WQ < 60, scrubs algae above 30, trims overgrown plants.
- **Clerk, ₹300:** serves every walk-in at your prices.

### Offline (M8)

- On return, take `t_away` = real time away, capped at 2 hours.
- Simulate customers only, over the game time equal to that, at 50% of the normal arrival rate.
- The Clerk serves them if hired; without a Clerk, nothing happens.
- Hunger, water, HP, breeding, plants and algae stay frozen, so nothing dies while you're away.
- Show a "While you were away" summary.

### Rescue rule

If ₹ is below the cheapest wholesale fish and the shop has no sellable fish, the wholesaler gifts 2 guppies, at most once per real day.

### Net worth

₹ + Σ fish value + 50% of equipment paid.

---

## 12. Gamification (M4)

### Daily goals (real days)

- 3 goals per real day, reset at 04:00 local. Drawn without repeats from the templates available at the current level:
  - Sell (5 + 2 × Lv) fish.
  - Earn ₹(500 × Lv) from sales.
  - Breed 1 litter.
  - Complete 1 order.
  - Do 3 water changes.
  - Feed every tank 3 times.
  - Trim 3 plants (M6+).
  - Import 1 fish (Lv4+, M7+).
  - Discover 1 new Aquadex entry (only offered if one is reachable).
- Each claimed goal pays ₹(100 × Lv) and (50 × Lv) XP. Claiming all three adds 3 Pearls. (tune)

### Streak

- **Reward track:** 7 steps. A step is earned on each real day you open the game and take at least one action. The track never resets, and after step 7 it loops back to step 1.
  - 1: ₹300
  - 2: food tin
  - 3: ₹600
  - 4: Red Tiger Lotus
  - 5: 5 Pearls
  - 6: ₹1,200
  - 7: a rare-morph fry (a random unlocked breedable species, homozygous for its rarest colour)
- **Streak counter** (consecutive days, used by achievements): one free freeze per ISO week automatically covers a single missed day. A second missed day in the same week resets the counter to 0, but reward-track progress is kept.

### Achievements

14 families × bronze/silver/gold = 42 achievements, paying 2 / 5 / 10 Pearls.

| Family | Bronze | Silver | Gold |
|---|---|---|---|
| Shopkeeper — fish sold | 10 | 100 | 1,000 |
| Rare Breeder — fry born with a colour ×4 or more | 1 | 10 | 50 |
| Green Thumb — cuttings trimmed | 10 | 50 | 200 |
| Clean Freak — water changes | 10 | 50 | 200 |
| Globetrotter — fish imported | 1 | 10 | 50 |
| Collector — Aquadex % | 25 | 50 | 100 |
| Order Up — orders completed | 5 | 25 | 100 |
| Tycoon — net worth ₹ | 10k | 100k | 1M |
| Five Star — tanks at 5★ at once | 1 | 5 | 10 |
| Devoted — streak counter days | 7 | 30 | 100 |
| Big Fish — own a | discus | flowerhorn | arowana |
| Fry Nanny — fry raised to adult | 100 | 1,000 | 10,000 |
| Safe Hands — game days without a death | 10 | 50 | 200 |
| Festival Fan — event goals completed | 5 | 20 | 50 |

### Stars

- **Tank stars:** `★ = clamp(round(5 × (0.4 × WQ + 0.3 × Beauty + 0.3 × H) / 100), 1, 5)`. Empty tanks don't count.
  - Worked example: WQ 80, Beauty 50, H 85 → 3.625 → 4★.
- **Shop stars:** the mean of display-tank stars, to one decimal.
- **starMult:** 0.65 at 1★, 0.95 at 3★, 1.25 at 5★. A 5★ shop draws 1.92× the walk-ins of a 1★ shop.

### Pearls

Pearls are a soft currency earned only by playing.

- **Sources:** daily goals, achievements, streak step 5, festival events.
- **Target:** 8–12 Pearls per real day over a daily player's first 14 days (tune).
- **Sinks:**
  - Decor, 5–20 Pearls. Each item adds +5 happiness (max 3 count) and +10 Beauty (max 4 count).
  - Tank backgrounds, 10.
  - Shop themes, 30.
  - Timer skips, 5 per 24 h.

### Aquadex

- One entry per species × phenotype combination: 11 breedable species × 6, plus 2 arowana variants = 68 entries. Event morphs get a separate Event row.
- An entry is discovered by owning a fish with that phenotype (bred, bought, imported or rewarded). Undiscovered entries show as silhouettes.
- Each species page shows 2–3 real care facts, stored in content with `verified: false` until a human checks them. Never invent facts.
- A complete species page gives +5% value to that species permanently.

### Festival events (real dates)

- Diwali, Holi, Christmas and Monsoon. Dates are maintained by hand in `src/content/events.json` for each year; never compute festival dates.
- Each runs for 7 real days with 10 event goals that earn Festival Tokens. Tokens buy exclusive decor and an event fish.
- **Event fish:** for example, the Diwali Gold guppy carries a new colour allele `Gold` (×5), recessive to all others, that breeds true.
- **Demand modifiers:** for example, during Diwali goldfish demand weight is ×2 and their price ×1.3.

### Juice

- Every sale: coin burst and a count-up.
- Level-up: a 1.5 s fanfare, skippable.
- Goal complete: a chime.
- SHINY birth: confetti, a haptic pattern, a "SHINY!" banner and an auto-zoom to the fry.
- **Net-catch minigame** (optional, toggle in Settings): when serving, a 3 s mini-game where you tap as the net overlaps the fish. A perfect catch earns a 10% tip. A miss is still a normal sale, so you never lose one.
- **Haptics:** `navigator.vibrate` on the web where supported; the Capacitor Haptics plugin on Android.

---

## 13. UI and screens

**Layout rules:** portrait, minimum viewport 360×640, tap targets ≥ 48 px, primary actions in the bottom half, nothing hover-only.

**Bottom tabs:** Shop · Tank · Market · Breeding · Upgrades. Goals and Aquadex open from top-bar icons once M3/M4 add them.

- **Top bar:** ₹, Pearls, level/XP ring, game day and clock, speed control.
- **Shop:** a grid of tank cards (thumbnail, ★, mini WQ/hunger meters, alert badges) plus a row of customer bubbles.
- **Tank:**
  - Full-screen canvas with a meters bar (Hunger, WQ, Temp, Algae).
  - Actions: Feed · Water change · Scrub · Trim · Move fish.
  - Tapping a fish opens a sheet with species, morph, sex, stage, HP and value, plus genotype once the Lab is unlocked.
- **Market:** Wholesaler · Imports · Orders · Prices (price multipliers).
- **Breeding:** breeding-tank pair picker (with odds once the Lab is unlocked), timers, Nursery.
- **Upgrades:** equipment per tank, new tanks and slots, staff, decor.
- **Toasts:** hunger > 60, WQ < 50, HP < 40, customer waiting, order expiring, birth.
- **Settings:** sound, haptics, net-catch toggle, export/import save, reset.

---

## 14. Rendering

- Canvas 2D with `devicePixelRatio` capped at 2. Only the open tank animates; shop thumbnails redraw every 2 s.
- **Procedural fish:**
  - Body ellipse plus a tail shape from the tail/fin phenotype.
  - Colours come from the species palette per phenotype.
  - Albino: a pale body and red eye.
- **Motion:** wander steering with wall avoidance and light schooling for `school` species. Sick fish swim slower and lower.
- **Plants:** procedural stems and leaves scaled by mass. Algae is a green overlay with `alpha = A / 150`.
- **Budget:** 40 fish at 60 fps on a mid-range Android phone, with no per-frame allocations in the render loop.
- **Safeguard:** if a tank holds more than 60 fish, draw the 60 most valuable and show a "+N" badge.

---

## 15. Saves

- One JSON save with a `version` field and a migration chain (`migrate_vN_to_vN+1`). Old saves always load.
- **Autosave:** every 10 real seconds and on `visibilitychange` (hidden) / `pagehide`.
  - Writes rotate across 3 slots.
  - Load takes the newest slot that parses and validates (zod).
- **Export/import:** a base64 string; import validates and migrates it.
- **Android (M5):** the storage adapter writes the same JSON to app storage, and Android Auto Backup includes it.

---

## 16. Android and launch

- **M5:**
  - Capacitor wraps the same web build and targets API 36 (required for new Play apps and updates since 31 Aug 2026).
  - Adapters for storage, haptics, local notifications, lifecycle (pause on background) and the Android back button.
  - Portrait lock and safe-area handling: edge-to-edge can't be opted out of at API 36.
  - Notifications are opt-in, asked after the first real day, max 2 per day. No exact-alarm permission.
  - GitHub Actions builds a debug APK on every push and a signed AAB on `v*` tags.
- **M8:** Play Games Services (sign-in, achievements, 3 leaderboards) via a thin custom Capacitor plugin; PWA for the web build; store listing; production release after the 14-day closed test.

---

## 17. Pacing targets (checked by `npm run sim`)

Active play at 1×, bot policy, median over seeds 1–20 unless stated.

1. Lv2 ≤ 10 real min.
2. Lv4 in 45–75 real min.
3. Lv10 in 8–12 real hours.
4. First albino guppy born ≤ 15 real min, in ≥ 90% of seeds.
5. Basic-care policy (feed daily, water change when WQ < 60): zero deaths over 30 game days.
6. Idle policy (no care at all): first death no sooner than 8 real min (2 game days).
7. Basic-care policy (never sells): no tank's adult-size count exceeds 2 × capacity, because happiness and crowding throttle breeding, and there are zero deaths.
8. Daily-player bot (M4+, fake clock): 8–12 Pearls per real day over the first 14 days.
9. The bot never gets stuck without money: the rescue rule fires at most once per real day and the bot recovers.
