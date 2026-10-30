# Weapon Roster, Gunsmith & Progression — Improvement Proposal

**Status:** proposal only. No game code, data, tests or docs were modified while writing this.
**Written against commit:** `153c6d2` (`main`), branch `arena/8760a2db-low-front`.
**Scope of this document:** (1) which weapons to add, (2) how weapon customisation should work, (3) how unlocks and levels should work. It is written to be implementable inside the existing architecture (`WeaponDef`, `ModelKit`, `ViewmodelDef`, `PlayerWeapons`, `ProfileStore`), not as a generic design doc.

---

## 0. TL;DR — the 10 recommendations

1. **The current roster has one role.** M4A1, AK47 and M1911 are all "medium-range, 0.20–0.30 s TTK, 30-round automatic". Every fight resolves the same way. Add **role coverage** first, not more assault rifles.
2. **Add 6 weapons in 2 waves (9 total):** MP5 (SMG), M870 (shotgun), M24 (bolt sniper) first; then M249 (LMG), Mk14 (DMR), G17 (high-cap pistol). Optional wave 3: .357 revolver, knife.
3. **Do not add launchers, grenades, thermal optics, akimbo or vehicles.** No vehicles and no explosive damage model exist; a rocket is a one-shot kill with no counterplay on a 360 m map.
4. **Five attachment slots** (Optic, Muzzle, Underbarrel, Magazine, Stock), Modern Warfare-style, with **Delta Force-style part availability per receiver** and **Battlefield-style trade-offs**: every attachment has at least one real downside.
5. **Attachments are pure data + a resolver function**, `resolveWeapon(def, attachmentIds): WeaponDef`. Do not mutate `WEAPONS`; resolve once at spawn and pass the resolved def into `WeaponState`. It stays unit-testable, which matches this repo's style (212 tests).
6. **The existing model attachment points are the whole visual system.** `muzzle`, `sightAnchor`, `magWell`, `leftHandGrip` already exist on all three guns — optics/muzzle/magazine/underbarrel parts just parent to them. No new rigging concept is needed.
7. **Use the AI hearing system as the suppressor's downside.** Bots already hear gunshots within 60 m (`Perception`). A suppressor dropping that to ~22 m is a real, verifiable gameplay lever — far better than a generic "-damage" nerf.
8. **Two progression layers:** account rank (1–55, unlocks weapons & slots) + per-weapon level (1–30, unlocks attachments, all attachments by level 20). No currency, no loot boxes, no store — this is an offline bot game.
9. **Tune progression to ~15 h to rank 55 and ~10 h to max one weapon.** Concretely: rank step `300 + 30 × (rank−1)` XP (≈59 k total), weapon step `150 + 40 × (level−1)` XP (≈21.7 k total).
10. **Do not ship a 6th weapon before fixing the data-driven gaps**: 5 hard-coded `def.id === …` checks in `fpClips.ts`, `STAT_BARS` scales that clamp at 50 damage / 100 m, and the "every weapon is 600–1,500 tris" test that a knife or a sniper would fail.

**Smallest valuable slice (~10–12 dev-days):** data-driven refactor → MP5 + M24 → Optic/Muzzle/Magazine slots (9–10 parts) → per-weapon XP and a post-match unlock screen. That alone changes how the game plays more than doubling the rifle count would.

---

## 1. Current state — what exists, and what it costs to extend

### 1.1 The roster today

| | M4A1 | AK47 | M1911 |
|---|---|---|---|
| Slot | Primary | Primary | Secondary |
| Role played | Mid AR | Mid AR (harder hitting) | Backup |
| RPM | 750 | 600 | 400 |
| Damage near → far | 30 → 22 | 36 → 26 | 40 → 28 |
| Falloff | 30 → 75 m | 25 → 70 m | 15 → 40 m |
| Shots to kill (torso, near) | 4 | 3 | 3 |
| TTK near | 0.24 s | 0.20 s | 0.30 s |
| Magazine | 30 + 1 | 30 + 1 | 7 + 1 |
| ADS | 0.25 s | 0.28 s | 0.18 s |
| Move | 0.95 | 0.93 | 1.00 |
| Model (FP) | 1,424 tris / 10 meshes | 820 tris / 7 meshes | 828 tris / 8 meshes |
| Model (TP) | 196 tris | 192 tris | 108 tris |

Coverage: **assault rifle ×2, pistol ×1, everything else ×0.** No CQB-dominant weapon, no one-shot-range weapon, no suppression weapon, no close-range burst damage, no high-capacity sidearm.

### 1.2 Why "just add more ARs" is the wrong first move

The three guns already overlap: inside 30 m the M4A1 and AK47 differ by 0.04 s TTK and a recoil pattern. A fourth 5.56 rifle would be a stat-bar reskin and would make the loadout screen noisier without changing a single engagement. Modern shooters stay interesting because weapons differ in **engagement geometry** (where on the map you are strong), not in ±5 damage:

| Archetype | Strong zone | Weak zone | What it changes for the player |
|---|---|---|---|
| SMG | 0–20 m, indoors | 40 m+ | Forces flanking and building play |
| Shotgun | 0–10 m | 15 m+ | Makes interiors genuinely dangerous |
| AR | 10–50 m | — | Baseline |
| DMR | 40–100 m | <15 m | Rewards holding sightlines |
| Sniper | 70 m+ | <30 m | Creates fear of open ground |
| LMG | 20–80 m, static | while moving | Suppression and holding a lane |

### 1.3 The real cost of one new weapon in this codebase

Everything below is a `Record<WeaponId, …>` or an id check, so TypeScript will force you to touch it — good, but budget for it:

| # | File | What must be added | Forced by tsc? |
|---|---|---|---|
| 1 | `src/data/weapons.ts` | `WeaponId` union + `WEAPONS` entry; the `STAT_BARS` scales will need widening (see §1.4) | Yes |
| 2 | `src/weapons/models/<Gun>Model.ts` | New procedural model, `fp` + `tp` | — |
| 3 | `src/weapons/models/weaponModels.ts` | `BUILDERS`, `REQUIRED_NODES`, `OVERALL_LENGTH` | Yes |
| 4 | `src/data/viewmodel.ts` | hip/sprint/reload poses, `adsFov`, `leftHand`, `kick`, `cycleTravel`, `magAxis`, `selector` | Yes |
| 5 | `src/anim/fpClips.ts` | `cycleNode()`, lock-back rule, trigger/hammer branches, reload clip | No (silent bug risk) |
| 6 | `src/data/audio.ts` | `shots` entry (crack + body + gain) | Yes |
| 7 | `src/weapons/Effects.ts` | `SHELL_SIZE` + `geometries` record (brass size and shape) | Yes |
| 8 | `src/entities/soldier/SoldierModel.ts` | `FAR_WEAPON` box for the distance LOD | Yes |
| 9 | `src/game/BotManager.ts` | Nothing (filters `WEAPON_IDS` by slot) — but bot *behaviour* needs per-role tuning | No |
| 10 | `src/ui/profile/LoadoutPanel.ts` | Nothing (filters by slot) — list may need scrolling | No |
| 11 | `src/debug/WeaponViewer.ts` | Nothing (iterates `WEAPON_IDS`) | No |
| 12 | `src/debug/SoldierViewer.ts` | Hard-coded M4A1/AK47 choices at lines 217–218 | No |
| 13 | `tests/WeaponModels.test.ts` etc. | Automatic via `WEAPON_IDS`, **but** tri budget (600–1500) and length ±5% will reject a knife, a short conversion, or a very simple design | No |

**Estimate:** ±2–4 dev-days per new primary (model ~1–1.5 d, viewmodel/animation ~0.5–1 d, audio/VFX/tests ~0.5 d, tuning 0.5 d). A pistol is cheaper (~1.5–2 d).

### 1.4 Four specific blockers found while reading the code

| Blocker | Where | Why it matters | Suggested fix |
|---|---|---|---|
| Hard-coded weapon identity | `fpClips.ts:32,45,61,154,161` — `def.id === 'm4a1' / 'ak47' / 'm1911'` | A 4th weapon silently gets M1911-style animation rules (the `else` branch) | Add `cycleNode`, `locksOnEmpty`, `triggerIsPositioned`, `reloadKind` fields to `WeaponDef` and branch on data |
| Stat-bar scales clamp | `STAT_BARS = { damageMax: 50, rangeMax: 100, fireRateMax: 900 }` | A sniper (88 dmg, 160 m) or a revolver (62) pins at 1.0; the M4A1's Range bar *drops* when a sniper is added — cards become unreadable | Per-class scales, or raw numbers + bars (see §3.7) |
| Accuracy formula punishes the wrong thing | `WeaponStats.statBars()` uses hip spread + recoil only | A scoped sniper with 6° hip spread would show worse accuracy than an SMG, which is false in play | Weight by ADS spread × zoom, or split into MW-style "Range / Control / Handling" |
| One-hit-kill geometry assumptions | `tests/WeaponModels.test.ts` asserts 600–1500 tris and length within ±5% for every weapon | Blocks knives, under-300-tri secondaries, short-barrel conversions | Per-weapon budget table (`WEAPON_BUDGET: Record<WeaponId, [min,max]>`), conversions inherit the base length ± their barrel delta |

Two smaller ones: `BALLISTICS.maxBullets = 128` is a pooled cap that 9-pellet shotgun blasts will exhaust with several bots firing; and `STARTING_RESERVE`/`chamber` assume box magazines (a belt-fed LMG and a revolver have no +1).

---

## 2. Weapon additions

### 2.1 How modern shooters split the roster

Reference set: Call of Duty (MW2019 → MWIII), Battlefield (3/4/2042), Delta Force, CS2, Valorant, Apex, XDefiant, Rainbow Six Siege, Insurgency: Sandstorm, Squad, Tarkov, BattleBit. Any given title ships a subset, but the archetype list is stable:

| Archetype | Shipped by (examples) | Typical role | Add to Low Front? |
|---|---|---|---|
| Assault rifle | all of the above | baseline 10–50 m | Already have 2 |
| SMG | all | 0–20 m, fast handling | **Yes — missing** |
| Shotgun | CoD, BF, CS2, XDefiant, Siege, Insurgency, Tarkov | 0–10 m, interior denial | **Yes — missing** |
| LMG | CoD, BF, CS2, Insurgency, Squad, Tarkov | suppression, 20–80 m | **Yes — missing** |
| DMR / marksman | CoD, BF, Delta Force, Tarkov, Insurgency | 40–100 m, semi-auto | **Yes — missing** |
| Bolt sniper | all | 70 m+, one-shot head | **Yes — missing** |
| High-cap pistol | CoD, BF, CS2, Valorant | backup with 15+ rounds | **Yes — missing** |
| Revolver / hand cannon | CoD, BF, CS2, Valorant, Siege | 2-shot, skill sidearm | Later (cheap, same rig) |
| Melee / knife | all | finisher | Later (v1 explicitly excludes melee) |
| Launcher / RPG | CoD, BF, CS2, Insurgency | anti-vehicle / splash | **No** — no vehicles, no splash damage model |
| Grenades | all | area denial | **No** — needs a new slot, AI reactions, damage-over-time |
| Akimbo | CoD | novelty | **No** — breaks the two-hand IK and accuracy model |

### 2.2 Recommended roster (9 weapons)

| Wave | Weapon | Class | Real reference | Why it earns a slot | Ship name (if you commercialise) |
|---|---|---|---|---|---|
| now | M4A1 | AR | M4A1 | baseline | — |
| now | AK47 | AR | AK-47 | baseline, high damage | — |
| now | M1911 | Pistol | M1911 | baseline | — |
| **1** | **MP5A3** | SMG | HK MP5 | Fastest handling, 0–20 m king, teaches flanking | "MP5" |
| **1** | **M870** | Shotgun | Remington 870 | Makes interiors and flag buildings lethal | "M870" / "Breacher" |
| **1** | **M24** | Bolt sniper | M24 SWS | Gives the 360 m map its long lanes and open-street fear | "M24" / "SWS" |
| **2** | **M249 SAW** | LMG | M249 / Minimi | Suppression, defends a lane, punishes run-and-gun | "M249" / "SAW" |
| **2** | **Mk14 EBR** | DMR | Mk14 / M14 | Mid-range semi-auto, rewards trigger discipline | "Mk14" / "EBR" |
| **2** | **G17** | Pistol | Glock 17 | 17 rounds, fast ADS, better backup than the 1911 | "G17" / "Sidearm 9" |
| 3 (opt.) | .357 | Revolver | Colt Python | 2-shot body, 1-shot head, high skill | "Python" |
| 3 (opt.) | Knife | Melee | — | Finisher only, needs melee damage + animation | "Combat knife" |

**Why stop at 9:** each primary is a hand-built procedural model with 5 moving parts, a viewmodel pose set and a full animation family. Nine weapons × 2 LODs is already ~11 k triangles of authored geometry and 9 sound signatures; past that the loadout screen stops being a choice and the balance/testing surface explodes. Modern Warfare ships 30+ guns because it has a studio and asset pipelines; this project builds every screw from `boxFromTo()`.

**Why the M24 before the M14, and the M870 before the M249:** the map is 360 m square with buildings, rooftops and 90 m bot sightlines. A bolt action immediately creates "do not cross the street" tension, while an LMG only amplifies existing AR play. The shotgun is the cheapest new mechanic that changes flag-building fights.

### 2.3 Full stat table for the new weapons

Values use the existing `WeaponDef` fields and units (damage per bullet, metres, seconds, degrees). Torso shots, 100 HP.

| Field | MP5A3 | M870 | M24 | M249 | Mk14 | G17 | .357 |
|---|---|---|---|---|---|---|---|
| Slot | Primary | Primary | Primary | Primary | Primary | Secondary | Secondary |
| Fire modes | auto, semi | pump | bolt | auto | semi | semi | semi |
| RPM | 800 | 70 | 45 | 750 | 400 (semi cap) | 450 | 180 |
| Damage near → far | 24 → 16 | 12 → 4 **× 9 pellets** | 88 → 70 | 29 → 20 | 50 → 34 | 26 → 18 | 62 → 44 |
| Falloff start → end | 12 → 35 m | 8 → 22 m | 60 → 160 m | 35 → 90 m | 45 → 110 m | 12 → 30 m | 20 → 55 m |
| Headshot × | 2.0 | 1.5 | 2.0 | 1.75 | 2.0 | 2.0 | 2.0 |
| Limb × | 0.75 | 0.9 | 0.8 | 0.75 | 0.75 | 0.75 | 0.8 |
| Magazine (+chamber) | 30 + 1 | 6 + 1 | 5 + 1 | 100 belt (no +1) | 10 + 1 | 17 + 1 | 6 (no +1) |
| Starting reserve | 150 | 36 | 30 | 200 | 60 | 68 | 30 |
| Muzzle velocity | 400 | 380 | 820 | 900 | 850 | 350 | 430 |
| Reload tactical / empty | 2.0 / 2.6 | 0.55 s per shell / 4.4 | 3.4 / 4.3 | 6.2 / 7.2 | 2.6 / 3.4 | 1.7 / 2.1 | 2.6 / 2.6 |
| ADS time | 0.18 | 0.32 | 0.55 | 0.45 | 0.32 | 0.16 | 0.22 |
| Move speed modifier | 1.00 | 0.97 | 0.90 | 0.86 | 0.92 | 1.00 | 1.00 |
| Hip / ADS cone (°) | 1.9 / 0.16 | 3.4 / 2.2 | 6.0 / 0.02 | 4.2 / 0.40 | 3.2 / 0.08 | 2.0 / 0.25 | 2.6 / 0.30 |
| Recoil vertical / horizontal (°) | 0.28 / 0.10 | 2.6 / 0.6 | 2.4 / 0.35 | 0.50 / 0.42 | 1.0 / 0.22 | 0.8 / 0.18 | 2.8 / 0.30 |
| Recoil recovery delay / rate (°/s) | 0.10 / 12 | 1.20 / 6 | 0.25 / 8 | 0.18 / 7 | 0.14 / 9 | 0.06 / 16 | 0.20 / 14 |
| ADS FOV (viewmodel) | 60 | 70 | 18 (6×) | 58 | 38 (3×) | 65 | 65 |
| Cycle node | `chargingHandle` | `pump` (new) | `bolt` (new names) | `bolt`/feed | `bolt` | `slide` | `hammer`+`cylinder` |
| FP tri target | ~1,000 | ~1,100 | ~1,250 | ~1,400 | ~1,300 | ~750 | ~800 |
| TP tri target | ~210 | ~190 | ~230 | ~260 | ~240 | ~110 | ~120 |
| Overall length (m) | 0.68 | 1.05 | 1.09 | 1.04 | 1.12 | 0.20 | 0.29 |
| New mechanic needed | none | pellets + shell reload + pump | bolt cycle + scope overlay | belt + bipod | none | none | cylinder reload |

**Design notes on the numbers**

- **MP5 at 800 RPM / 24 damage** = 5 torso shots, 0.30 s TTK, 320 DPS — slower to kill than both ARs but it aims in 0.18 s and moves at 1.0. Its job is winning the first 0.3 s of a room fight.
- **M870, 9 pellets × 12** = 108 at contact (one-shot), 72 at 15 m, 46 at 20 m. That is deliberate: lethal indoors, harmless across a street.
- **M24, 88 body damage** = 2 body shots, 1 headshot (176). No chest zone exists in the hitbox model, so "one-shot upper torso" would need a new `chest` zone — not worth it; the 1.33 s bolt cycle already punishes a miss.
- **Mk14 at exactly 50 damage** = a headshot is exactly 100. That is a clean, teachable breakpoint, and body shots stay 2–3.
- **G17 vs M1911** is intentionally a trade, not an upgrade: 4 shots at 26 vs 3 at 40, but 17+1 rounds, 0.16 s ADS, and 2.0× faster follow-up.
- **M249 at 0.86 movement** and 6.2 s reload: the player is a turret, not a rifleman. Bipod (attachment) rewards crouch-holding a lane.
- **Suppressors shrink, do not silence**: 60 m → 22 m bot hearing (see §3.4).

### 2.4 TTK and engagement-zone check (100 HP, torso, no reload)

| Weapon | 10 m | 30 m | 60 m | 100 m | Strong zone |
|---|---|---|---|---|---|
| M4A1 | 0.24 s | 0.24 s | 0.32 s | 0.32 s | 10–50 m |
| AK47 | 0.20 s | 0.20 s | 0.30 s | 0.30 s | 10–45 m |
| MP5A3 | 0.30 s | 0.38 s | 0.45 s | 0.45 s | 0–20 m |
| M870 | **0.00 s** (contact) | 1.7 s | — | — | 0–10 m |
| M249 | 0.24 s | 0.24 s | 0.32 s | 0.32 s | 20–80 m, static |
| Mk14 | 0.15 s | 0.15 s | 0.30 s | 0.30 s | 40–100 m |
| M24 | 1.33 s | 1.33 s | 1.33 s | 1.33 s | 70 m+ |
| M1911 | 0.30 s | 0.45 s | — | — | backup |
| G17 | 0.40 s | 0.67 s | — | — | backup |
| .357 | 0.33 s | 0.33 s | 0.67 s | 0.67 s | backup, skill |

Sanity check: nothing beats the AK47's close-range TTK except a contact shotgun blast, the sniper is the worst weapon in the game inside 30 m, and the Mk14 is only oppressive if you stand in the open at 60 m — exactly where a DMR should win. **DPS** (damage × RPM / 60, ignoring reload): M4A1 375, AK47 360, M249 362, MP5 320, Mk14 333, M24 66, M870 126, M1911 267, G17 195, .357 186.

### 2.5 New mechanics each weapon forces (be honest about these)

| Mechanic | Needed by | Code impact | Tests to add |
|---|---|---|---|
| **Pellets** | M870 | `WeaponDef.pellets`, one trigger pull → N bullets inside the cone; `Ballistics` pool 128 → ~384 or per-shot cap; tracer every 3rd **pellet** (dim tracers for pellets) | pellet count, pellet spread inside cone, one shell consumed |
| **Shell-by-shell reload** | M870 | `ReloadMode = 'magazine' \| 'shell' \| 'belt'`; `WeaponState.applyReload` becomes mode-aware; reload can be interrupted and keeps loaded shells; `fpClips` partial-load loop | reload interruption keeps shells, tactical vs empty, cancel rules |
| **Bolt cycle** | M24 | New FP clip (`cycleBolt`), `cycleTravel` 0.09, `locksOnEmpty` false, un-scope between shots optionally | fire-rate gate, scope-in delay after cycling |
| **Scope overlay** | M24, 3×/6× optics | A full-screen scope treatment (black vignette + reticle drawn on a canvas texture); ADS already changes FOV via `adsFov` | FOV transition, no overlay while hip-firing |
| **Belt feed / drum** | M249 | Visual `belt` node only (no simulation); `chamber: 0`; longer reload with a "feed tray" clip | no +1 round, reload length |
| **Burst fire** | M16A4 conversion (platform) | `FireMode = 'burst'`, burst counter in `WeaponState`, cooldown between bursts | 3 rounds per press, no extra round on hold, mode cycle order |
| **Bipod** | M249, M24 | No prone in game → "crouched and stationary for 0.3 s" condition; modifies recoil/spread only | modifier applies only when crouched + still |
| **Melee** (wave 3) | Knife | New damage path (no bullet), front/back multipliers, animation | range, backstab multiplier |

Everything else (MP5, Mk14, G17, .357) reuses the existing box-magazine + single-cycle path and is pure content.

---

## 3. Weapon customisation ("Gunsmith")

### 3.1 What the reference games actually do

| Game | Slots | Unlock rule | Standout idea worth copying | What not to copy |
|---|---|---|---|---|
| **Modern Warfare (2019–III)** | 5 attachments, plus receiver/platform conversions | Weapon level per gun; attachments every few levels | Gunsmith preview with a stat-delta panel; "aftermarket parts" that turn an AR into an SMG/LMG | 30+ guns and 1,000 camos — content volume you cannot author |
| **Battlefield 3/4** | 4 (optic, accessory, barrel, underbarrel) | Kills with that weapon | Small, readable attachment list; clear per-slot trade-offs | Nothing major |
| **Battlefield 2042** | 4 changeable in-match ("Plus") | Weapon XP | On-the-fly attachment swap for a range problem | In-match swapping conflicts with a tactical, slow TTK game and doubles UI work |
| **Delta Force** | ~5–7 receiver-specific parts (muzzle, barrel, optic, magazine, grip, stock, tactical) + ammo types | Weapon level; some parts rank-gated | Parts are *not* universal: each receiver has its own set; ammo choice matters | Ammo/armour penetration (no armour system here) |
| **Tarkov** | Dozens, full modularity | Found/bought | Physical honesty of parts | Complexity, economy, stash UI |
| **CS2 / Valorant** | None | — | Pure skill expression | — |
| **XDefiant** | 5 | Weapon level | Attachments unlocked by playing *that* gun | — |
| **Siege / Insurgency** | 2–4 with a supply cost | Per-round loadout points | Cost budget forces choices | Supply points need a whole economy layer |

### 3.2 Recommendation: MW structure, Delta Force part sets, BF trade-offs

- **Five slots:** Optic, Muzzle, Underbarrel, Magazine, Stock.
- **Parts are per-weapon-class**, not universal: an optic fits everything with a rail, a bipod only fits LMG/sniper, a drum only fits the LMG, a short barrel only exists for the M4 platform. This is exactly how Delta Force gates parts per receiver, and it keeps the catalogue honest.
- **Every non-default part has a real downside** (Battlefield's discipline), expressed in the same units the `WeaponDef` already uses.
- **Five attachments max, one per slot.** No stacking two muzzles, no "best-in-slot everywhere".
- **No in-match swapping** (unlike BF2042): this game's identity is committing to a loadout before deploying.

### 3.3 Data model (proposal — not applied)

New file `src/data/attachments.ts`:

```ts
export type AttachmentSlot = 'optic' | 'muzzle' | 'underbarrel' | 'magazine' | 'stock';

/** All deltas are in the native units of WeaponDef. Multipliers are named `x…`. */
export interface WeaponMods {
  damageNear?: number;
  damageFar?: number;
  falloffStart?: number;
  falloffEnd?: number;
  adsTime?: number;          // seconds, additive
  mag?: number;              // rounds, additive
  reload?: number;           // seconds, additive
  hipSpread?: number;        // degrees, additive
  adsSpread?: number;        // degrees, additive
  recoilV?: number;          // multiplier (1 = unchanged)
  recoilH?: number;          // multiplier
  moveSpeed?: number;        // additive to moveSpeedModifier
  muzzleVelocity?: number;   // multiplier
  adsFov?: number;           // absolute override (zoom)
  hearingRadius?: number;    // absolute override, metres (bots)
}

export interface AttachmentDef {
  id: AttachmentId;
  name: string;
  slot: AttachmentSlot;
  /** Weapon classes or exact ids this part fits. */
  fits: 'rifle' | 'smg' | 'shotgun' | 'lmg' | 'dmr' | 'sniper' | 'pistol' | readonly WeaponId[];
  /** Weapon level that unlocks it (Delta Force / MW style). */
  unlockLevel: number;
  mods: WeaponMods;
  /** Procedural part: parent point on the model + builder + tri budget. */
  model?:
    | { attach: 'muzzle'; build: (lod: WeaponLod) => THREE.BufferGeometry[]; tris: number }
    | { attach: 'sightAnchor'; build: (lod: WeaponLod) => THREE.BufferGeometry[]; tris: number }
    | { attach: 'magWell'; build: (lod: WeaponLod) => THREE.BufferGeometry[]; tris: number }
    | { attach: 'leftHandGrip'; build: (lod: WeaponLod) => THREE.BufferGeometry[]; tris: number };
  /** Optional overrides of shared systems. */
  sound?: 'suppressed' | 'loud' | 'default';
  hideDefault?: 'ironSights' | 'flashHider' | 'magazine' | 'grip';
}
```

Resolver, pure and testable (`src/weapons/attachments.ts`):

```ts
const CAPS = {
  adsTime: [0.12, 0.70], magFactor: [0.5, 1.6], damage: [-0.15, +0.15],
  recoil: [0.6, 1.5], moveSpeed: [0.80, 1.05], muzzleVelocity: [0.7, 1.1],
} as const;

/** Returns a NEW WeaponDef. Never mutates WEAPONS. */
export function resolveWeapon(def: WeaponDef, chosen: readonly AttachmentId[]): WeaponDef;
```

Implementation rules:

1. Start from a structured clone of the base def.
2. Apply additive deltas, then multipliers, then clamps. Deterministic order — do not depend on slot order.
3. `mag` is additive and then clamped to 1.6× base; `chamber` is untouched except `chamber: 0` weapons.
4. Recompute derived values once (`shotInterval`, `statBars`) after resolution.
5. Cache by `weaponId + sorted(attachmentIds)`; the loadout screen resolves constantly.
6. Reject illegal combos (wrong slot, not fitting the class, duplicate slot) with a typed error — the save loader must silently drop them, exactly like `ProfileStore.weaponFor()` does today.

**Runtime wiring:** `PlayerWeapons` takes `Loadout` today (`{ primary, secondary }`). Change it to:

```ts
export interface WeaponBuild { id: WeaponId; attachments: readonly AttachmentId[]; }
export interface Loadout { primary: WeaponBuild; secondary: WeaponBuild; }
```

Resolve in `Game`/spawn code and construct `new WeaponState(resolvedDef)`. `WEAPONS` stays the immutable base table; bots and the player can share the same resolver output.

### 3.4 Attachment catalogue (concrete values)

Calibrated to the existing units. `×` = multiplier, `+` = additive.

**Optic** (fits all with a rail; pistols get a slide-mounted micro dot)

| ID | Effect | Downside | Model | Unlock |
|---|---|---|---|---|
| Iron sights (default) | — | — | existing | 1 |
| Micro red dot | ADS FOV 62, sight picture open | ADS +0.02 s | 60 tris | 2 |
| Holographic | ADS FOV 58, better moving-target clarity | ADS +0.03 s | 90 tris | 6 |
| 3× prism | ADS FOV 38 | ADS +0.08 s, move −0.02, hip cone +10% | 150 tris | 13 |
| 6× scope | ADS FOV 18 (M24 default is this) | ADS +0.12 s, move −0.04, hip cone +25% | 220 tris + scope overlay | 18 |

**Muzzle**

| ID | Effect | Downside | Model | Unlock |
|---|---|---|---|---|
| Flash hider (default) | muzzle flash −40% | — | existing | 1 |
| Compensator | recoilV ×0.88 | recoilH ×1.10, hearing radius +10 m | 70 tris | 3 |
| Muzzle brake | recoilV ×0.80 | recoilH ×1.25, hearing +25 m, flash larger | 90 tris | 11 |
| Suppressor | **hearing radius 60 → 22 m**, no flash, distant shot muted | muzzleVelocity ×0.88, damage near ×0.95, ADS +0.03 s | 160 tris | 8 |

> The suppressor is the best-designed attachment in the proposal because the AI already supports it: `Perception` hears shots within 60 m and `AudioManager` already has a distant low-pass above 40 m. Implementing it is one resolved-def field read in the perception check, and the player can *feel* it — enemies stop converging on your position.

**Underbarrel**

| ID | Effect | Downside | Model | Unlock |
|---|---|---|---|---|
| Vertical grip | recoilH ×0.82 | ADS +0.03 s, move −0.01 | 80 tris | 5 |
| Angled grip | recoil recovery delay −20%, bloom recovery +20% | ADS +0.02 s | 70 tris | 14 |
| Laser | hip cone ×0.75 | visible beam to enemies | 40 tris (line) | 10 |
| Bipod | recoil ×0.55 and cone ×0.60 while crouched + still | move −0.02, ADS +0.04, LMG/sniper only | 110 tris | 16 |

**Magazine**

| ID | Effect | Downside | Model | Unlock |
|---|---|---|---|---|
| Standard (default) | — | — | existing | 1 |
| Extended | mag +10 (rifles/SMG), +5 (DMR), +12 (pistol) | reload +0.25 s, move −0.01 | 120 tris | 4 |
| Fast | reload ×0.80 | mag −2 | 90 tris | 9 |
| Drum (LMG only) | mag +50 | reload +1.5 s, move −0.03 | 260 tris | 15 |

**Stock**

| ID | Effect | Downside | Model | Unlock |
|---|---|---|---|---|
| Standard (default) | — | — | existing | 1 |
| Heavy | recoilV ×0.82 | ADS +0.05 s, move −0.02 | 60 tris | 12 |
| Light | ADS −0.04 s, move +0.01 | recoilV ×1.15 | 50 tris | 7 |
| No stock | ADS −0.06 s, move +0.02 | recoilV ×1.35, recoilH ×1.2 | replaces stock | 17 (M4 platform) |

**Barrel** (wave 2, tied to the platform system in §3.9)

| ID | Effect | Downside |
|---|---|---|
| Short (MK18 / AKS-74U) | ADS −0.04 s, move +0.02 | falloffEnd ×0.85, muzzleVelocity ×0.90, hip cone ×1.25 |
| Long (M16A4 / RPK) | falloffEnd ×1.25, damage near +2 | ADS +0.05 s, move −0.02, hip cone ×1.15 |

### 3.5 Balance guardrails (write these as tests)

1. **No strictly-better attachment.** Every entry above has at least one negative in a different axis. Add a unit test that asserts each non-default attachment in `ATTACHMENTS` has ≥1 non-zero downside field.
2. **Caps** (see `CAPS`): resolving a 5-part "recoil stack" cannot push vertical recoil below 0.6×, ADS below 0.12 s, or damage above +15%.
3. **No cross-slot overlap:** one part per slot; illegal sets are rejected by the resolver and by the save loader.
4. **Class purity:** a drum cannot fit an AR; a 6× cannot fit an MP5; a bipod cannot fit a pistol. Enforced by `fits` and covered by a table test.
5. **Published meta builds to test by hand** (use the test range):
   - *M4A1 CQB*: micro dot + comp + vertical grip + fast mag + light stock → 0.17 s ADS, manageable recoil, 28 rounds.
   - *M4A1 support*: 3× + comp + vertical grip + extended + heavy → 40 rounds, ~0.32 s ADS, holds a lane.
   - *AK47 marksman*: 3× + muzzle brake + angled + extended + heavy → 1–2 tap at 60 m, 40 rounds, terrible hip-fire.
   - *MP5 entry*: micro dot + suppressor + laser + extended + light → silent flanker, 40 rounds.
   - *M24 overwatch*: 6× + suppressor + bipod + extended? (no) + heavy → 5 rounds, 22 m hearing, one-shot head.

### 3.6 Model integration — this is where the codebase already helps

`WeaponModel.ts` exposes `muzzle`, `ejectionPort`, `sightAnchor`, `rightHandGrip`, `leftHandGrip`, `magWell` on every weapon, and `ModelKit` builds geometry procedurally. Attachment visuals therefore need **no new rigging concept**:

- **Optic** → parent to `sightAnchor` (which is already the ADS eye point), hide the iron sight meshes.
- **Muzzle** → parent to `muzzle`, hide the default flash hider/brake.
- **Magazine** → parent to `magWell`, hide the default magazine node (keep the *moving* `magazine` node so reload animations still work — parent the new mag *inside* the existing node).
- **Underbarrel/stock** → new anchor points `underbarrel` and `stockRear` added to `AttachmentName`; handguard grip is `leftHandGrip`, so a vertical grip should sit just behind it.

Budget and rendering rules:

- 40–260 tris per part, `fp` only (third-person soldiers keep the base `tp` model — do not spend triangles on 31 bots).
- Build once per `weaponId + partId + lod`, cache the `BufferGeometry`, share the existing palette materials (`WM.metal()`, `WM.polymer()`, plus a new `WM.glass()` and `WM.tan()`).
- Merge parts into the same per-material merge the `Assembly` already does, so a fully kitted M4A1 stays at ~12–14 meshes instead of 25.
- The `WeaponCard` preview must render the equipped build, not the base gun: change `buildWeaponModel(weapon.id, 'fp')` → `buildWeaponModel(build, 'fp')` (signature extension with an optional third argument keeps existing tests green).
- `OVERALL_LENGTH` tests: a short barrel legitimately changes length by more than 5%. Make the assertion `base.length ± 0.03 m` for conversions rather than a fixed ±5%.

### 3.7 Stat display (fix the scale problem while you are in there)

The current card shows five 0–1 bars computed from `STAT_BARS` (`damageMax: 50`, `rangeMax: 100`). With an 88-damage sniper and a 160 m falloff, every bar clamps and the M4A1's Range bar visibly *falls* when the M24 is added — confusing and demoralising.

Recommended: **MWIII-style five bars, computed per class.** Range bar scaled to the class maximum (pistols 60 m, SMG 50 m, AR 100 m, DMR 120 m, sniper 180 m), Damage bar scaled to the class maximum, and split the current "Accuracy" into **Control** (recoil) and **Handling** (ADS + move). Then the gunsmith panel can show **delta arrows** next to each bar from `statBars(resolved) − statBars(base)` — this is what makes attachments feel meaningful, and it reuses `WeaponStats.statBars()` unchanged.

### 3.8 UI flow

```
Main Menu → Play vs Bots → Profile & Loadout
    Primary / Secondary slot
        ├─ weapon list (cards, locked ones show rank + silhouette)
        │      └─ [Customize] → GUNSMITH (new screen)
        │             left:   rotating 3D preview with parts attached
        │             middle: 5 slot buttons → part list (locked = weapon level)
        │             right:  stat bars with +/− deltas, 5/5 counter
        └─ Deploy → match
```

Reuse: `LoadoutPanel` (add "Customize"), `WeaponCard` (preview + bars + delta), `PreviewRenderer` (already used by the weapon cards), `ConfirmDialog` (reset build), `MatchHud`/`MatchSummary` (post-match XP). A second entry point from the Deploy Screen (§11 of `plan.md`) keeps it consistent.

### 3.9 Platform conversions (wave 2 — content multiplication)

Modern Warfare's receiver/"aftermarket parts" idea gives breadth without new models. Because the base models are assembled from named parts, a conversion can shorten the barrel, swap the stock and change three or four stats:

M4A1 platform:
- **MK18** — short barrel + no stock, faster, worse at range (falloffEnd ×0.85).
- **M16A4** — 20" barrel + fixed stock + **burst fire** (needs `FireMode = 'burst'`), +range, −handling.
- **9 mm conversion** — 32-round mag, damage ×0.80, recoil ×0.65, new sound; expensive (new mag model + shells + audio).

AK platform:
- **AKS-74U** — short barrel, folding stock.
- **RPK** — long barrel, 45-round mag, bipod; becomes a pseudo-LMG.

Cost: ~1–2 days per conversion *if* the attachment/model system already exists; ~0 days of new animation. It is the cheapest way to make the armoury look deep.

### 3.10 Risks

| Risk | Mitigation |
|---|---|
| Attachment power creep ("must-have" 5-part meta) | Guardrail test #1, caps, and per-slot trade-offs; re-tune by playing the five builds in §3.5 |
| Suppressor trivialises bot AI | Cap hearing reduction at 22 m, keep muzzle flash visible at night? (no night map) — instead make suppressors cost velocity and range |
| 6× scope on an AR = sniper rifle | 6× is sniper-only; ARs stop at 3× |
| Procedural part count explodes draw calls | Cache merged geometry, reuse `Assembly`, ~14 meshes max per kitted gun |
| Save files reference parts that changed | Version the profile (`lowfront.profile.v2`), drop unknown ids on load, never throw |

---

## 4. Progression & unlocks

### 4.1 Two layers (MW + Delta Force hybrid)

| Layer | Range | Earned by | Unlocks | Reset? |
|---|---|---|---|---|
| **Account rank** | 1–55 | Match XP (any weapon) | Weapons, attachment *slots* awareness, cosmetic badges; rank 55 → optional prestige | No |
| **Weapon level** | 1–30 | XP with that weapon | That weapon's attachments (all by level 20), camo tiers 21–30 | No |
| **Challenges** | per weapon / global | Specific feats | Camos only (no stat power) | No |

Why not Battlefield's "kills per weapon unlock attachments"? Because a bot-only game benefits from a visible, predictable bar. Why not currency? Because an offline game with 31 bots has no economy to balance, and currency invites grind padding.

### 4.2 XP sources

| Action | Account XP | Weapon XP |
|---|---|---|
| Kill | 50 | 30 |
| Headshot bonus | +15 | +10 |
| Assist (damage dealt, not the killer) | 20 | 10 |
| Capture a flag (per capture) | 150 | 75 |
| Defend a flag (kill inside own zone) | 100 | 50 |
| Match win | 600 | 150 |
| Match loss | 200 | 50 |
| Match completion | — | 200 |

Typical 25-minute match: ~15 kills, 3 headshots, 1–2 captures, a win ≈ **1,500–1,900 account XP** and ~**900 weapon XP**.
No XP for: training range, self-damage, team damage, bots (they never earn), idle time. No multipliers for sale; an optional 2× weekend flag in `src/data/progression.ts` is fine.

### 4.3 Curves and totals

```
accountXpToNext(rank) = 300 + 30 × (rank − 1)      // ranks 1..55
weaponXpToNext(level) = 150 + 40 × (level − 1)     // levels 1..30
```

| Milestone | Cumulative XP | ≈ Matches | ≈ Time |
|---|---|---|---|
| Rank 10 | 3,780 | 2–3 | 1 h |
| Rank 20 | 10,830 | 6–7 | 2.7 h |
| Rank 30 | 20,880 | 12–13 | 5.2 h |
| Rank 40 | 33,930 | 20 | 8.5 h |
| Rank 50 | 49,980 | 30 | 12.5 h |
| **Rank 55** | **59,130** | **36** | **~15 h** |
| Weapon level 10 | 3,000 | 3–4 | 1.5 h |
| Weapon level 20 (all attachments) | 9,500 | 10 | 4.2 h |
| **Weapon level 30** | **21,750** | **23** | **~9.5 h** |

Keep all constants in one `src/data/progression.ts` and unit-test the cumulative tables — this is the kind of pure math the repo already tests (`WeaponState`, `WeaponStats`).

### 4.4 Weapon unlock schedule (account rank)

| Rank | Unlock | Rationale |
|---|---|---|
| 1 | M4A1, M1911 | Default kit |
| 2 | Weapon slot: attachments for M4A1 (level 2) | Teach the system immediately |
| 3 | **MP5A3** | First alternative; rewards aggression early |
| 6 | AK47 | Damage vs handling lesson |
| 10 | **M870** | Interior play opens |
| 14 | **M249** | Support role |
| 18 | **Mk14** | Rewards aim, prepares for the sniper |
| 22 | **M24** | Long-range payoff after 8 h of play |
| 26 | **G17** | Sidearm depth |
| 30 | M4A1 platform conversions (barrel slot) | Second wind for the starter gun |
| 35 | AK platform conversions | — |
| 40 | .357 | Flavour, not power |
| 45 | Knife (if melee exists) | Cosmetic/finisher |
| 55 | Prestige badge + a cosmetic camo set | End of the road |

Weapons are **never** removed or made obsolete by rank; nothing here outclasses the M4A1 in its own zone (see §2.4).

### 4.5 Attachment unlock schedule (per weapon, levels 1–20)

| Level | Unlock |
|---|---|
| 1 | Defaults only |
| 2 | Micro red dot |
| 3 | Compensator |
| 4 | Extended mag |
| 5 | Vertical grip |
| 6 | Holographic |
| 7 | Light stock |
| 8 | Suppressor |
| 9 | Fast mag |
| 10 | Laser |
| 11 | Muzzle brake |
| 12 | Heavy stock |
| 13 | 3× prism |
| 14 | Angled grip |
| 15 | Drum (LMG only) |
| 16 | Bipod (LMG/sniper) |
| 17 | No stock (M4 platform) |
| 18 | 6× scope (sniper/DMR) |
| 19–20 | Weapon-specific part (barrel, wave 2) |

Each weapon gets the same skeleton with class-appropriate substitutions, so there is one unlock-order function and one table per class — not 9 hand-written lists.

### 4.6 Challenges and camo (cosmetic only)

| Tier | Requirement (per weapon) | Reward |
|---|---|---|
| Woodland | 50 kills | Green camo |
| Desert | 150 kills + 25 headshots | Tan camo |
| Arctic | 300 kills + 1,000 damage at 40 m+ | White camo |
| Digital | 500 kills + 50 headshots | Grey-digital camo |
| **Mastery** | 750 kills + 100 headshots + 25 longshots | Gold + weapon nameplate |

Camos are a **material colour swap** per weapon instance (`WM` palette override + `flatShading`), not new models — a few hours of work for the most visible progression reward in the game. Global challenges (e.g. "10 kills with each class", "capture 50 flags") can unlock profile badges.

### 4.7 Persistence (schema v2)

Follow the existing `ProfileStore` philosophy: JSON in localStorage, validate every field, fall back to defaults, never throw. Example shape:

```json
{
  "schema": 2,
  "name": "Player",
  "stats": { "matchesPlayed": 12, "wins": 7, "losses": 4, "kills": 186, "deaths": 92, "headshots": 31 },
  "rank": { "level": 18, "xp": 640 },
  "loadout": {
    "primary":   { "id": "m4a1", "attachments": ["red_dot", "compensator", "vertical_grip", "extended_mag", "heavy_stock"] },
    "secondary": { "id": "m1911", "attachments": [] }
  },
  "weapons": {
    "m4a1": { "level": 12, "xp": 410, "kills": 121, "headshots": 24, "camo": "desert", "challenges": { "longshots": 9 } },
    "mp5":  { "level": 4,  "xp": 88,  "kills": 22,  "headshots": 3,  "camo": "none" }
  },
  "unlockedCamos": ["m4a1.desert"]
}
```

Migration rules:
- v1 (`{name, stats, loadout:{primary,secondary}}`) → v2: wrap ids into `WeaponBuild`, rank = derived from stats (`1 + floor(kills/25)`, capped 55) or simply 1, weapon levels from kills.
- Unknown weapon/attachment ids are dropped, not fatal (same as `weaponFor()` today).
- Rank/weapon XP clamped to the curve maximum; negative values rejected.
- Add a "Reset progress" action in the Pause Menu with a confirmation dialog.

### 4.8 UI touchpoints (existing screens)

| Screen | Change |
|---|---|
| Profile & Loadout (`LoadoutPanel`) | Locked cards (rank requirement, greyed), "Customize" button, equipped attachment count |
| Deploy Screen (`plan.md` §11) | Reuses `LoadoutPanel`; show rank + weapon level |
| Gunsmith (new) | Slots, parts, 3D preview, stat deltas, 5/5 counter |
| Post-match / End Screen (`MatchSummary`) | XP breakdown, animated rank bar, unlock list ("Suppressor unlocked for M4A1") |
| Pause Menu (`PauseMenu`) | "Career" page: rank, next unlock, per-weapon levels |
| HUD (`MatchHud`) | Optional small rank icon; kill feed already shows weapon names |
| Training range | **All weapons and all attachments available** with a "not unlocked" watermark — the best onboarding tool you have, and it costs nothing |

### 4.9 Bots and balance in an offline game

- Bots never earn XP and never gate content.
- Bots currently pick a random primary from `PRIMARIES`. Extend to weighted picks by role and range (shotguns near C, DMRs at B, snipers rarely) and give bots **default or optic-only** attachments so 31 soldiers don't each resolve a 5-part build every spawn (resolve once per bot archetype and share the `WeaponDef`).
- Do **not** give bots suppressors until the perception change is tuned; otherwise friendly bots will feel blind.
- Bots must be excluded from sniper-only loadouts at spawn until `BotAim` handles bolt-action cadence (currently 3–6 round bursts, 12% headshot chance). A bot with a one-shot headshot sniper would be the least fun thing in the game.

---

## 5. Implementation roadmap

Effort assumes one experienced developer familiar with the codebase. Each phase ends with a testable build, following the repo's phase-and-review rhythm.

| Phase | Work | Key files | Effort | Exit check |
|---|---|---|---|---|
| **W0 — Data-driven refactor** | Remove 5 `def.id ===` checks; add `class`, `cycleNode`, `locksOnEmpty`, `hearingRadius`, `pellets`, `reloadMode`; per-weapon tri budget; widen/segment `STAT_BARS`; pool size config | `weapons.ts`, `fpClips.ts`, `WeaponStats.ts`, `ballistics.ts`, tests | 2–3 d | Existing 3 weapons unchanged in play; 212 tests pass |
| **W1 — Wave 1 weapons** | MP5A3, M870, M24: models (fp/tp), viewmodel poses, audio, shells, new clips (pump, bolt, shell reload), scope overlay, pellet ballistics | `models/*`, `viewmodel.ts`, `fpClips.ts`, `audio.ts`, `Effects.ts`, `Ballistics.ts` | 6–9 d | 6 weapons in viewer; TTK table §2.4 reproduced in the range |
| **W2 — Gunsmith data + UI** | `attachments.ts`, resolver + caps, 20 parts, loadout schema, Gunsmith screen, delta bars, locked states | new `attachments.ts`, `LoadoutPanel`, `WeaponCard`, new screen | 5–7 d | Every part equips/removes; illegal sets rejected; caps enforced by tests |
| **W3 — Attachment models + hooks** | Procedural parts, anchors `underbarrel`/`stockRear`, suppressor sound + hearing change, optic FOV, bipod condition, laser beam | `ModelKit`, `weaponModels.ts`, `Perception.ts`, `AudioManager.ts` | 4–6 d | Kitted gun ≤14 meshes; suppressor measurably changes bot behaviour |
| **W4 — Progression + persistence** | XP events, curves, profile v2 + migration, unlock gates, post-match UI, career page | `progression.ts`, `ProfileStore.ts`, `MatchSummary`, `PauseMenu` | 4–6 d | Save/reload round-trip; migration from a real v1 save; unlock toast |
| **W5 — Wave 2 weapons + platforms** | M249, Mk14, G17, barrel slot, MK18/M16A4/AKS-74U/RPK conversions, burst fire | models, `WeaponState`, `fpClips` | 6–9 d | 9 weapons, 4 conversions; bot matches still stable |
| **W6 — Camos, challenges, polish, balance** | 4 camo tiers + mastery, challenge tracking, sound mix, final balance pass | materials, `ProfileStore`, `progression.ts` | 3–5 d | Full match at 60 FPS; no must-pick attachment |

**Total:** ~30–45 dev-days for the full proposal. **Minimum slice:** W0 + one weapon from W1 + Optic/Muzzle/Magazine from W2–W3 + weapon XP only from W4 ≈ **10–12 d** and delivers most of the perceived depth.

Suggested order of player-visible value per day: gunsmith slots (cheap, deep) > MP5 (new playstyle) > suppressor (new tactics) > M24 (new map tension) > rank curve > camos.

### 5.1 Tests to add (matching the repo's culture)

- `weapons.test.ts`: every def has valid ranges, no weapon beats another in every bar of its own class, TTK table matches the design sheet.
- `attachments.test.ts`: caps, clamps, slot uniqueness, `fits` matrix, every non-default part has a downside, resolver does not mutate `WEAPONS`, cache hits return equal defs.
- `progression.test.ts`: cumulative XP tables, no negative/overflow on load, unlock schedule monotonic, level 30 exactly at total.
- `ProfileStore.test.ts`: v1 → v2 migration, unknown ids dropped, corrupt JSON → defaults, attachments preserved.
- `WeaponModels.test.ts`: per-weapon tri budgets, attachment parts within budget, right-hand grip at origin for kitted builds.
- `Ballistics.test.ts`: pellets per shot, pellet cone containment, pool never exhausted with 8 shotguns firing.
- `BotPerception.test.ts`: suppressor radius applies to gunshot hearing.

### 5.2 Decisions I need from you

1. **Roster size:** 6 new weapons (9 total) as proposed, or trim to 3 (MP5, M870, M24) for a tighter first pass?
2. **Attachments:** the full 5-slot catalogue, or start with Optic + Muzzle + Magazine (the three with the clearest feel and the lowest model cost)?
3. **Platform conversions** (MK18/M16A4/AKS-74U/RPK): in scope? They are the cheapest content, but they need burst fire and a barrel slot.
4. **Names:** real firearm names (consistent with M4A1/AK47/M1911) or fictional aliases for a possible commercial release?
5. **Progression pace:** is ~15 h to rank 55 and ~9.5 h per weapon acceptable for a bot-only game, or should the first 10 ranks be faster (e.g. ×0.6 XP for ranks 1–10) to hook players?
6. **Bots with attachments:** default/optic only (recommended) or full random builds?
7. **Melee and grenades:** stay out of scope, or plan a "v2.1 combat" pass after this?

---

## Appendix A — Weapon model build notes (procedural)

| Weapon | Key parts to build (all `ModelKit`) | New nodes | New points | Watch out for |
|---|---|---|---|---|
| MP5A3 | Stamped receiver, cocking tube + charging handle at the front left, slim handguard, hooded front sight, drum rear sight, curved 30-rd mag, retractable stock | `chargingHandle`, `magazine`, `trigger`, `selector` | standard | Charging handle is *forward* on the left, unlike the AK — the rack pose must move |
| M870 | Receiver, 6-shell tube + spring, ribbed pump forearm, 20" barrel, bead front sight, wooden stock/forearm, shell lifter | `pump` (forearm), `magazine`? no — shells load into the tube; keep a `shell` visual | standard | Shell-by-shell animation: left hand goes to the pouch, pushes each hull; empty reload is *not* a mag swap |
| M24 | 24" tapered barrel, Mauser-style bolt with handle, HS-precision stock, 10× scope on a rail, bipod stub | `bolt`, `boltHandle`, `trigger` | `sightAnchor` = scope eye point | Scope overlay + very long ADS; hip-fire cone must feel terrible |
| M249 | Stamped box, feed tray, 200-rd box, heat shield, carry handle, bipod, long barrel | `bolt` (feed), `chargingHandle`, `cover` (feed cover) | standard | Belt box must not read as a giant magazine; reload clip needs the feed cover |
| Mk14 | M14 receiver, 22" barrel, scope rail, 10-rd box, walnut/E2 stock, muzzle stabiliser | `bolt`, `magazine`, `trigger` | standard | Wood palette already exists (`PALETTE.akWood`, `m1911GripWood`) |
| G17 | Polymer frame, slide with serrations, 17-rd mag, three-dot sights | `slide`, `magazine`, `trigger` | standard | Pistol tri budget is ~750 — do not detail the frame like the 1911 |
| .357 | Frame, fluted cylinder (rotating node), swing-out crane, 6 chambers, wood grip | `cylinder`, `hammer`, `trigger` | standard | Cylinder rotation and per-chamber reload |

## Appendix B — Naming and licensing note

The project already ships real designations (M4A1, AK47, M1911), which is normal for hobby builds and matches how Battlefield licenses names. Firearm names are trademarks of their manufacturers in several jurisdictions; if this is ever sold, either license or use the aliases in §2.2 (Call of Duty's approach: "M4", "Kastov 762"). This is a legal footnote, not a design blocker — but decide it **before** writing 9 names into save files, kill feeds and audio tables.

## Appendix C — One-page summary

- **Add**: MP5A3, M870, M24 (wave 1); M249, Mk14, G17 (wave 2); .357 and knife (optional).
- **Don't add**: launchers, grenades, akimbo, thermal/NV, in-match attachment swapping.
- **Customise**: 5 slots (Optic/Muzzle/Underbarrel/Magazine/Stock), ~20 parts, per-class fits, every part has a downside, resolver is pure and capped.
- **Unlock**: account rank 1–55 (weapons) + weapon level 1–30 (attachments, all by 20); ~15 h / ~9.5 h; camos are cosmetic colour swaps.
- **Fix first**: 5 hard-coded id checks, stat-bar scales, tri/length tests, bullet pool.
- **First slice**: refactor → MP5 → 3 slots → weapon XP. ~2 weeks for most of the value.
