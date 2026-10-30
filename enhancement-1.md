# enhancement-1.md — Low Front Improvement Plan

**Type:** design + production plan (proposal).
**Baseline:** `main` after PR #6; plan.md phases 0–8 complete, phase 9 (polish/perf) and 10 (builds) pending.
**Scope:** weapons, gameplay, graphics, models/art, map, game settings/modes, progression and a full scripted campaign.
**Consolidates:** the former `weapon_improvement.md` (now §5 and §11 of this document).
**Effort key:** S ≈ 1–2 days · M ≈ ~1 week · L ≈ 2–4 weeks · XL ≈ 1–3 months.

Decisions this plan is built on (from the design discussion):

1. **All three tracks, sequenced** — ship-quality polish → content depth → campaign.
2. **Full scripted campaign** — 8 missions, story, characters, VO/text, cutscenes.
3. **Keep the bright low-poly style**, add **time-of-day and weather** for variety.
4. **Online multiplayer is "maybe later"** — so every decision below must be online-proof without being built for online now.
5. **Weapons get role coverage and a gunsmith**, not more assault rifles.

---

## 0. Executive summary

Low Front already has the hard parts: a working 60 Hz fixed-step simulation, a procedural low-poly city, 31 bots with perception/cover/nav, a full Conquest loop, first-person weapon animation, and 212 unit tests plus a headless full-match harness. What it does **not** have is *variety* — three weapons that all fill the same role, one map, one mode, one time of day, no grenades/melee/vault, three settings in the options menu, and no narrative.

This plan adds variety in the cheapest possible order:

| Milestone | Theme | What it unlocks for the player | Effort |
|---|---|---|---|
| **M1** | Ship quality | Runs well, looks good, configurable, installable; weapons refactored to data | 5–7 wk |
| **M2** | Combat texture | Smoke, knife, vault, suppression, better spawns, match setup, **MP5 + M870 + M24** | 6–8 wk |
| **M3** | World variety | Dawn/dusk/night/rain, wind, decals, interiors, ambience, **five-slot gunsmith** | 6–9 wk |
| **M4** | Campaign foundation | Missions, triggers, checkpoints, cinematics, ally orders, **XP and unlocks** | 7–9 wk |
| **M5** | Campaign content | 8 missions, story, characters, VO, set pieces | 10–14 wk |
| **M6** | Breadth | Second map, TDM/Rush, contracts, career, **M249/Mk14/G17 + camos** | 9–14 wk |

**Total: ~43–61 weeks.** Each milestone ends in a shippable state and has an explicit *cut line* (§3.1), so stopping after any milestone still leaves a coherent game.

**The ten recommendations**

1. **Add role coverage, not more rifles.** M4A1, AK47 and M1911 all sit in the same "medium range, 0.20–0.30 s TTK" slot.
2. **Add six weapons in two waves:** MP5A3 (SMG), M870 (shotgun), M24 (sniper) first; then M249 (LMG), Mk14 (DMR), G17 (high-cap pistol). Optional wave 3: .357, knife.
3. **Five attachment slots** (Optic, Muzzle, Underbarrel, Magazine, Stock) with per-class part fits and a real downside on every part.
4. **Attachments are data + a pure resolver** — `resolveWeapon(def, ids)`, never mutating `WEAPONS`.
5. **The suppressor's downside is the AI's hearing radius** (60 m → 22 m), not a generic damage nerf.
6. **Two progression layers:** account rank 1–55 (weapons) and weapon level 1–30 (attachments, all by 20).
7. **Add gameplay texture before content:** smoke, knife, vault, suppression, spawn safety, match setup.
8. **Build time-of-day and weather presets before a second map** — five looks from one map, and the campaign's "locations" become free.
9. **Campaign foundation before campaign content** — triggers, objectives, checkpoints and ally orders first, then eight missions on the existing geometry.
10. **Fix the data-driven blockers before a fourth weapon** — 5 hard-coded `def.id ===` checks, clamped stat-bar scales, fixed triangle budgets.

**If you only do three things:** M1's graphics/options pass, M2's smoke + spawn fixes, and M3's time-of-day presets. Those change how the game *feels* more than any single new feature.

**Minimum weapon slice (~10–12 dev-days):** data-driven refactor → MP5 + M24 → Optic/Muzzle/Magazine slots (9–10 parts) → per-weapon XP and a post-match unlock screen. That alone changes how the game plays more than doubling the rifle count would.

---

## 1. Baseline audit — what exists, what is missing

### 1.1 Working today

| System | State |
|---|---|
| Simulation | Fixed 60 Hz step, variable render with interpolation (`GameLoop`, `Time`) |
| Movement | Walk 4.5 / sprint 6.5 (6 s stamina) / crouch 2.5 / ADS 2.8 m/s, 0.6 m jump, 0.35 m steps, 45° slopes, lean Q/E 15° + 0.35 m |
| Combat | Projectile bullets, falloff damage, head ×2 / limb ×0.75, health 100, 8 s regen delay, fall damage, no friendly fire |
| Weapons | M4A1, AK47, M1911 — full FP animation families, moving parts, procedural audio |
| Bots | 31 bots, 110° view, 90 m sight, 60 m hearing, reaction 0.3–0.6 s, bursts, cover, objectives, path queue |
| Match | Conquest, 400 tickets, 5 flags, 12 m capture radius, 25 min, 10 s respawn, bleed |
| HUD | Tickets/timer/flag strip, minimap (75 m), large map, scoreboard, kill feed, hit markers, damage direction |
| World | 360×360 m city, 8 enterable floor plans, props, streets, plazas, 1 shadow-casting sun, gradient sky, fog |
| Perf (headless) | 131–163 draw calls, ~247 k triangles with 31 bots, ~1.9 ms bot work per fixed step |
| Tests | 212 unit tests + `npm run test:match` full headless match |

### 1.2 Weapons today

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

The three guns also overlap: inside 30 m the M4A1 and AK47 differ by 0.04 s TTK and a recoil pattern. A fourth 5.56 rifle would be a stat-bar reskin. Modern shooters stay interesting because weapons differ in **engagement geometry** (where on the map you are strong), not in ±5 damage:

| Archetype | Strong zone | Weak zone | What it changes for the player |
|---|---|---|---|
| SMG | 0–20 m, indoors | 40 m+ | Forces flanking and building play |
| Shotgun | 0–10 m | 15 m+ | Makes interiors genuinely dangerous |
| AR | 10–50 m | — | Baseline |
| DMR | 40–100 m | <15 m | Rewards holding sightlines |
| Sniper | 70 m+ | <30 m | Creates fear of open ground |
| LMG | 20–80 m, static | while moving | Suppression and holding a lane |

### 1.3 Missing / weak (the actual opportunity)

| Area | Gap | Player-visible symptom |
|---|---|---|
| Weapons | Three overlapping guns, no attachments, no weapon progression | Every match plays the same; no reason to try another gun |
| Gameplay | No grenades, melee, vault, slide, suppression, resupply, squad spawn | Fights are "aim duel, reload, repeat"; cover is only for peeking |
| AI | 31 solo duellists, no fireteams, no reaction to smoke/suppression, difficulty not exposed | Bots feel samey; no difficulty choice for new players |
| Modes | Conquest only | Nothing to do after the first 10 matches |
| Settings | Sensitivity, FOV, volume only (`SettingsStore`) | Cannot rebind keys, cannot run on weak hardware, no colourblind support |
| Graphics | No tone mapping, no bloom, no AO, no decals, one lighting preset, no wind | Flat, static, "prototype" look; screenshots do not sell the game |
| Audio | Procedural SFX only, no music, no ambience by zone, no VO | Silence between fights; world feels empty |
| Models | One soldier silhouette, blocky hands, no first-person body, few prop variants | 31 clones; screenshots look repetitive |
| Map | One map, no underground, limited rooftop loops, mirrored halves | Predictable after a few hours |
| Campaign | None | No reason to play alone |
| Meta | No match setup, no hardcore, no contracts, no career page | No sense of progression outside kills |

### 1.4 The real cost of one new weapon in this codebase

Everything below is a `Record<WeaponId, …>` or an id check, so TypeScript will force you to touch it — good, but budget for it:

| # | File | What must be added | Forced by tsc? |
|---|---|---|---|
| 1 | `src/data/weapons.ts` | `WeaponId` union + `WEAPONS` entry; `STAT_BARS` scales need widening (§1.5) | Yes |
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
| 13 | `tests/WeaponModels.test.ts` etc. | Automatic via `WEAPON_IDS`, **but** tri budget (600–1500) and length ±5% reject a knife, a short conversion or a very simple design | No |

**Estimate:** ±2–4 dev-days per new primary (model ~1–1.5 d, viewmodel/animation ~0.5–1 d, audio/VFX/tests ~0.5 d, tuning 0.5 d). A pistol is cheaper (~1.5–2 d).

### 1.5 Data-driven blockers to fix first

| Blocker | Where | Why it matters | Fix |
|---|---|---|---|
| Hard-coded weapon identity | `fpClips.ts:32,45,61,154,161` — `def.id === 'm4a1' / 'ak47' / 'm1911'` | A 4th weapon silently gets M1911-style animation rules (the `else` branch) | Add `cycleNode`, `locksOnEmpty`, `triggerIsPositioned`, `reloadMode` fields and branch on data |
| Stat-bar scales clamp | `STAT_BARS = { damageMax: 50, rangeMax: 100, fireRateMax: 900 }` | A sniper (88 dmg, 160 m) or revolver (62) pins at 1.0; the M4A1's Range bar *drops* when a sniper is added | Per-class scales, or raw numbers + bars (§5.11) |
| Accuracy formula punishes the wrong thing | `WeaponStats.statBars()` uses hip spread + recoil only | A scoped sniper with 6° hip spread shows worse accuracy than an SMG, which is false in play | Weight by ADS spread × zoom, or split into "Range / Control / Handling" |
| One-size model budgets | `tests/WeaponModels.test.ts` asserts 600–1500 tris and length ±5% for every weapon | Blocks knives, under-300-tri secondaries, short-barrel conversions | Per-weapon budget table (`WEAPON_BUDGET: Record<WeaponId, [min,max]>`), conversions inherit base length ± barrel delta |
| Bullet pool too small | `BALLISTICS.maxBullets = 128` | Nine-pellet shotgun blasts exhaust it with several bots firing | Raise to ~384 or cap pellets per shot |
| Magazine assumptions | `chamber` / `startingReserve` assume box magazines | A belt-fed LMG and a revolver have no +1 round | `chamber: 0` plus a `reloadMode` field |

### 1.6 The three constraints every suggestion must respect

1. **Everything is procedural.** No external model/audio files today; keep new content buildable from code, or introduce a small, clear asset pipeline (§7.5 for canvas textures).
2. **One artist-programmer.** Any content system must multiply existing work, not add a second workflow. This is why time-of-day presets, map variants and platform conversions rank above new maps.
3. **60 FPS with 32 soldiers on modest hardware.** New features must ship with a measured cost; §6.5 sets the budget.

---

## 2. Online-later guardrails (do these now, they are nearly free)

You may never build multiplayer — but four habits keep the door open without slowing you down:

| Rule | Why | Current state |
|---|---|---|
| **No gameplay logic in `ui/` or `anim/`** | A server must run combat without a DOM or three.js | Already true; keep it that way |
| **Input becomes command objects** (`{move, look, fire, reload}`) rather than reading `Input` inside systems | Commands can arrive from a network later | Partially true (`WeaponInput`); formalise for movement |
| **All randomness seeded per event** (spread, recoil jitter, bot decisions) | Server and client must agree; replays become possible | `BotManager` uses `rand()`; move to a seeded RNG service |
| **Versioned save schema + pure data tables** | Server-side progression and content updates | `lowfront.profile.v1` → `schema: 2` in §11.7 |

Two existing assets are effectively free multiplayer groundwork: `tests/sim/botMatch.ts` is a **headless match harness** (a dedicated-server skeleton), and bullets already carry their shooter identity. Do not build netcode, lobbies, or interpolation — just do not break these properties.

**Explicit non-goals:** no client-authoritative shooting, no in-match attachment swapping, no host migration, no matchmaking. If online ever happens, it will be a separate project phase.

---

## 3. Roadmap

### 3.1 Milestones M1–M6 (with cut lines)

#### M1 — Ship quality (5–7 weeks)

| Work | Items | Effort |
|---|---|---|
| Performance pass (plan Phase 9) | Prop/vegetation instancing, static merge audit, shadow extent tuning, LOD distances, draw-call budget test in CI | 1–2 wk |
| Rendering baseline | ACES tone mapping + exposure, SMAA/FXAA, bloom, subtle vignette, muzzle-flash light, shadow quality | 1–2 wk |
| Settings layer | Keybinds, graphics presets, resolution scale, audio buses, ADS sensitivity, toggle/hold, invert Y | 1–2 wk |
| Builds (plan Phase 10) | Web production build, Electron wrapper, installer, save paths | 1 wk |
| **Weapon refactor (W0)** | Remove 5 id checks, data fields, per-weapon budgets, stat-bar rescale (§3.2) | 2–3 d |

**Gate:** stable 60 FPS in a full 32-soldier match; every option persists; clean install → match → quit; the three existing weapons behave identically.
**Cut line:** ship tone mapping + keybinds + graphics presets; defer bloom/AO.

#### M2 — Combat texture (6–8 weeks)

Smoke grenade, frag grenade, quick knife, vault, crouch-slide, suppression, resupply crates, squad spawn, spawn protection, death-cam + spectate, match-setup screen, hardcore modifier, bot fireteams, spotting, training challenges (§4), **plus wave 1 weapons: MP5A3, M870, M24** (§5.2, W1).

**Gate:** each feature has a unit or integration test; bot match still ends correctly; no regression in the 5-minute "new player" flow; six weapons in the viewer with the TTK table reproduced in the range.
**Cut line:** smoke, knife, vault, spawn safety, match setup, MP5 + M870.

#### M3 — World variety (6–9 weeks)

Time-of-day presets, weather (rain/overcast/dust), wind sway, decals, interior lighting, ambient particles and zone audio, map variants, minimap upgrades (§6, §8), **plus the gunsmith: data, resolver, UI and attachment models** (§5.7–§5.12, W2–W3).

**Gate:** each preset at 60 FPS; rain does not tank frame time; every attachment equips/removes; illegal sets rejected; caps enforced by tests; a fully kitted gun stays under ~14 meshes.
**Cut line:** dawn + night + rain presets, wind, decals, Optic/Muzzle/Magazine slots only.

#### M4 — Campaign foundation (7–9 weeks)

Mission data format, trigger volumes, objective state machine, wave director, checkpoint saves, cinematic camera, subtitle/dialogue system, ally squad orders, mission select UI, difficulty presets (§10.4), **plus XP, unlocks and profile v2** (§11, W4).

**Gate:** one grey-box mission playable end-to-end with checkpoints and a briefing; save/reload round-trip; migration from a real v1 save.
**Cut line:** replace cinematics with letterboxed camera moves + briefing cards; keep triggers, objectives, checkpoints and XP.

#### M5 — Campaign content (10–14 weeks)

Story bible, 8 missions, 3–5 set pieces, characters, ~150 VO lines (or text-only), difficulty tuning, credits, unlockable mission select (§10.5).
**Gate:** full campaign playable in one sitting, no soft locks, save/restore at every checkpoint.
**Cut line:** 8 missions → 5 (First Light, High Ground, Blackout, Rain Check, Last Light).

#### M6 — Breadth (9–14 weeks)

Second map (shipyard or desert town), TDM + Rush modes, contracts/daily challenges, career page, local leaderboards, photo mode polish (§4.5, §8.4, §9.3), **plus wave 2 weapons (M249, Mk14, G17), platform conversions and camo challenges** (§5.2, §5.10, §11.6, W5–W6).

**Gate:** two maps and three modes with no mode-specific bugs; nine weapons and four conversions with bot matches still stable; no must-pick attachment.
**Cut line:** ship TDM only, defer the second map; ship three weapons of wave 2.

### 3.2 Weapon track (W0–W6) inside the milestones

| Phase | Work | Milestone | Effort | Exit check |
|---|---|---|---|---|
| **W0 — Data-driven refactor** | Remove 5 `def.id ===` checks; add `class`, `cycleNode`, `locksOnEmpty`, `hearingRadius`, `pellets`, `reloadMode`; per-weapon tri budget; segment `STAT_BARS`; pool size config | M1 | 2–3 d | Existing 3 weapons unchanged in play; 212 tests pass |
| **W1 — Wave 1 weapons** | MP5A3, M870, M24: models (fp/tp), viewmodel poses, audio, shells, new clips (pump, bolt, shell reload), scope overlay, pellet ballistics | M2 | 6–9 d | 6 weapons in viewer; TTK table §5.4 reproduced in the range |
| **W2 — Gunsmith data + UI** | `attachments.ts`, resolver + caps, ~20 parts, loadout schema, Gunsmith screen, delta bars, locked states | M3 | 5–7 d | Every part equips/removes; illegal sets rejected |
| **W3 — Attachment models + hooks** | Procedural parts, anchors `underbarrel`/`stockRear`, suppressor sound + hearing change, optic FOV, bipod condition, laser beam | M3 | 4–6 d | Kitted gun ≤14 meshes; suppressor measurably changes bot behaviour |
| **W4 — Progression + persistence** | XP events, curves, profile v2 + migration, unlock gates, post-match UI, career page | M4 | 4–6 d | Save/reload round-trip; unlock toast |
| **W5 — Wave 2 weapons + platforms** | M249, Mk14, G17, barrel slot, MK18/M16A4/AKS-74U/RPK conversions, burst fire | M6 | 6–9 d | 9 weapons, 4 conversions; bot matches stable |
| **W6 — Camos, challenges, polish** | 4 camo tiers + mastery, challenge tracking, sound mix, final balance pass | M6 | 3–5 d | Full match at 60 FPS; no must-pick attachment |

**Weapon total:** ~30–45 dev-days. **Minimum slice:** W0 + one weapon from W1 + Optic/Muzzle/Magazine from W2–W3 + weapon XP only ≈ **10–12 d**, delivering most of the perceived depth.

Player-visible value per day: gunsmith slots > MP5 (new playstyle) > suppressor (new tactics) > M24 (new map tension) > rank curve > camos.

### 3.3 Sequencing rationale

M1 before everything (options and performance are prerequisites for a public build; the weapon refactor is cheap and unblocks everything after). M2 before M3 (smoke/vault change level-design needs, which M3's map variants absorb; the new weapons need the movement/combat texture to be worth using). M3 before M4 (campaign "locations" are lighting presets + blocked districts, so campaigns become cheap once presets exist). M4/M5 before M6 (a finished campaign differentiates more than a second map). M6 last because a second map is the most expensive single item and benefits from every system above.

---

## 4. Gameplay systems

### 4.1 Combat additions

| # | Feature | Design | Effort | Implementation hooks |
|---|---|---|---|---|
| 4.1.1 | **Smoke grenade** | Thrown 20 m, blooms in 1.2 s, 8 m radius, 12 s life. Blocks line of sight both ways; bullets pass through. Two per life, 25 s resupply at flags | M | Smoke volumes as LOS blockers in `Perception`; radial particle billboards; minimap shows the cloud |
| 4.1.2 | **Frag grenade** | 3.5 s fuse, 6 m lethal / 12 m falloff, bounces off geometry, damages bots and player, cracks the camera | M–L | Rapier dynamic body + sphere cast; reuse falloff math from `Damage.ts` |
| 4.1.3 | **Quick knife** | 1.6 m reach, 55 damage, 110 from behind, 0.55 s animation, no ammo slot | S | Raycast on press, new FP clip, kill feed entry |
| 4.1.4 | **Suppression** | Bullets passing within 2 m: camera shake + slight desaturation for the player; bots lose 25% aim accuracy and prefer cover for 1.5 s | S–M | Near-miss detection in `Ballistics`; debuff in `BotAim` |
| 4.1.5 | **Ragdoll-lite** | 4-body physics tumble on death (hips, chest, head), settle in 2 s, fade as today | M | Replace scripted fall in `SoldierAnimator`; reuse `PhysicsWorld` |
| 4.1.6 | **Resupply crates** | Ammo + grenades + health at owned flags, 20 s cooldown per crate | S | Zone ownership already tracked in `CaptureZone` |
| 4.1.7 | **Flash grenade** (optional) | Breaching tool; screen-white + bot blindness timer | M | Same throw path as frag |

**Arc:** smoke first (most tactical value, no damage model needed), then frag, then knife. Do not add both grenade types in the same milestone.

> **Scope note:** this section supersedes the old "no grenades" rule from the weapon proposal. Throwables are now in scope because they need no new weapon slot; what stays out is a **launcher/RPG** (no vehicles, no splash-damage counterplay) and **akimbo**.

### 4.2 Movement

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.2.1 | **Vault / mantle** | Press jump against an obstacle 0.35–1.2 m high → 0.5 s climb using `CharacterMotor` step logic; blocked above 1.2 m | S–M |
| 4.2.2 | **Crouch-slide** | Sprint + crouch → 1.2 s slide, 1.4× sprint speed decaying, camera drops, weapon lowered, 3 s cooldown; cancels reload | S–M |
| 4.2.3 | **Sprint-to-fire penalty** | 0.15 s settle before accurate fire after sprinting, shown by the crosshair | S |
| 4.2.4 | **Ladder** (optional) | Only if rooftop connectivity needs it; otherwise ramps/stairs only | M |
| 4.2.5 | **Prone** | **Not recommended.** Breaks the crouch/bipod model, needs new hitboxes, bots have no prone logic | — |

### 4.3 Teamplay, spawns and flow

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.3.1 | **Spawn safety** | 2 s invulnerability + no firing; a spawn point within 15 m of an enemy is disabled; "enemy near spawn" warning on deploy | S |
| 4.3.2 | **Squad spawn** | Spawn on any living teammate out of combat for 3 s, 10 m behind them; cuts 20–30 s of running per death | S–M |
| 4.3.3 | **Spawn rooms** | 2–3 exits per spawn so one grenade cannot cover all of them | S (map edit) |
| 4.3.4 | **Spotting (Q)** | Marks the enemy under the crosshair for 6 s to bots and on the minimap; 3 s cooldown | M |
| 4.3.5 | **Timed supply drop** | At 2/3 of the match a crate spawns at C: ammo, grenades, a temporary weapon | S–M |
| 4.3.6 | **Death-cam + spectate** | 1.5 s camera fly to the killer, then deploy; optional free spectate of teammates | S–M |

### 4.4 Bots and AI

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.4.1 | **Difficulty exposed in UI** | Easy / Normal / Hard from `data/bots.ts`, plus bot count 8/16/31 and match length 10/25 min | S |
| 4.4.2 | **Fireteams** | 3–4 person squads sharing last-known enemy positions; 2 attack, 1 defends, 1 flexes | M |
| 4.4.3 | **Flanking** | When a teammate engages frontally, route around cover to a side angle | M |
| 4.4.4 | **Grenade use** | Bots throw frags at known campers behind cover, 15 s cooldown, shout warning | M |
| 4.4.5 | **Smoke reaction** | Bots do not shoot through smoke; they push or reposition; defenders fall back from a smoked flag | M |
| 4.4.6 | **Suppression reaction** | Under suppression bots take cover, stop peeking and call it out | S–M |
| 4.4.7 | **Barks** | Short procedural/textured barks ("contact", "reloading", "grenade") with distance falloff — becomes the campaign VO pipeline | M |
| 4.4.8 | **Bot loadouts by role** | Shotguns near C, DMRs at range, snipers rare; no snipers until 4.4.9 exists | S |
| 4.4.9 | **Bot sniper cadence** | Bolt-action bots need longer aim settle and a visible glint before firing | M |

### 4.5 Modes

| # | Mode | Rules | Reuse | Effort |
|---|---|---|---|---|
| 4.5.1 | **Conquest** (existing) | 5 flags, tickets, bleed | — | done |
| 4.5.2 | **Team Deathmatch** | 75 kills or 10 min, no flags, HQs only | Bot objectives simplify to "hunt" | M |
| 4.5.3 | **Domination** | 3 flags, faster captures, 15 min | `CONQUEST.capture` with a different table | S–M |
| 4.5.4 | **Rush** | Two MCOM stations per sector, 3 sectors; 75 tickets per sector | New destructible objective entity | M |
| 4.5.5 | **Frontline** | Single moving objective; capture pushes the line | Small | M–L |
| 4.5.6 | **Gun Game** | Every 2 kills → next weapon (the nine-weapon roster in §5.2) | Weapon switching system | S–M |
| 4.5.7 | **Hardcore** | 2-shot kills, no HUD/regen/minimap/crosshair, 1.5× damage | Settings + damage scale | S |
| 4.5.8 | **Custom match** | Map, mode, bot count, difficulty, length, friendly fire, time of day | New setup screen | S–M |

Ship order: Hardcore (S) → TDM (M) → Gun Game (S–M) → Domination (S–M) → Rush (M) → Frontline (M–L).

### 4.6 Training and onboarding

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.6.1 | **First-run tutorial** | 6-step scripted range: look, move, sprint/crouch, shoot dummies, reload, capture a zone. Skippable, re-runnable | M |
| 4.6.2 | **Range challenges** | Recoil control drill, 50 m snap shots, timed course, grenade toss; personal bests in localStorage | M |
| 4.6.3 | **Weapon/attachment try-out** | Range allows every weapon and attachment regardless of unlocks | S |
| 4.6.4 | **Loading tips** | Rotating tips with real mechanics ("Smoke blocks bot vision, not bullets") | S |

---

## 5. Weapons

### 5.1 How modern shooters split the roster

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
| Melee | all | finisher | **Partly yes** — quick knife in §4.1.3; equipped knife weapon later |
| Throwables | all | area denial | **Yes** — §4.1.1/4.1.2 |
| Launcher / RPG | CoD, BF, CS2, Insurgency | anti-vehicle / splash | **No** — no vehicles, no splash counterplay |
| Akimbo | CoD | novelty | **No** — breaks the two-hand IK and accuracy model |

### 5.2 Recommended roster (9 weapons)

| Wave | Weapon | Class | Real reference | Why it earns a slot | Ship name (if you commercialise) |
|---|---|---|---|---|---|
| now | M4A1 | AR | M4A1 | baseline | — |
| now | AK47 | AR | AK-47 | baseline, high damage | — |
| now | M1911 | Pistol | M1911 | baseline | — |
| **1** | **MP5A3** | SMG | HK MP5 | Fastest handling, 0–20 m king, teaches flanking | "MP5" |
| **1** | **M870** | Shotgun | Remington 870 | Makes interiors and flag buildings lethal | "M870" / "Breacher" |
| **1** | **M24** | Bolt sniper | M24 SWS | Gives the 360 m map long lanes and open-street fear | "M24" / "SWS" |
| **2** | **M249 SAW** | LMG | M249 / Minimi | Suppression, defends a lane, punishes run-and-gun | "M249" / "SAW" |
| **2** | **Mk14 EBR** | DMR | Mk14 / M14 | Mid-range semi-auto, rewards trigger discipline | "Mk14" / "EBR" |
| **2** | **G17** | Pistol | Glock 17 | 17 rounds, fast ADS, better backup than the 1911 | "G17" / "Sidearm 9" |
| 3 (opt.) | .357 | Revolver | Colt Python | 2-shot body, 1-shot head, high skill | "Python" |
| 3 (opt.) | Knife | Melee | — | Equipped finisher; quick knife already in §4.1.3 | "Combat knife" |

**Why stop at 9:** each primary is a hand-built procedural model with 5 moving parts, a viewmodel pose set and a full animation family. Nine weapons × 2 LODs is already ~11 k triangles of authored geometry and 9 sound signatures; past that the loadout screen stops being a choice and the balance/testing surface explodes. Modern Warfare ships 30+ guns because it has a studio and asset pipelines; this project builds every screw from `boxFromTo()`.

**Why the M24 before the Mk14, and the M870 before the M249:** the map is 360 m square with buildings, rooftops and 90 m bot sightlines. A bolt action immediately creates "do not cross the street" tension, while an LMG only amplifies existing AR play. The shotgun is the cheapest new mechanic that changes flag-building fights.

### 5.3 Full stat table for the new weapons

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

- **MP5 at 800 RPM / 24 damage** = 5 torso shots, 0.30 s TTK, 320 DPS — slower to kill than both ARs, but it aims in 0.18 s and moves at 1.0. Its job is winning the first 0.3 s of a room fight.
- **M870, 9 pellets × 12** = 108 at contact (one-shot), 72 at 15 m, 46 at 20 m. Deliberate: lethal indoors, harmless across a street.
- **M24, 88 body damage** = 2 body shots, 1 headshot (176). No chest zone exists, so "one-shot upper torso" would need a new hitbox — not worth it; the 1.33 s bolt cycle already punishes a miss.
- **Mk14 at exactly 50 damage** = a headshot is exactly 100. A clean, teachable breakpoint; body shots stay 2–3.
- **G17 vs M1911** is a trade, not an upgrade: 4 shots at 26 vs 3 at 40, but 17+1 rounds, 0.16 s ADS and a faster follow-up.
- **M249 at 0.86 movement** and 6.2 s reload: the player is a turret, not a rifleman. The bipod rewards crouch-holding a lane.
- **Suppressors shrink, do not silence**: 60 m → 22 m bot hearing (§5.8).

### 5.4 TTK and engagement-zone check (100 HP, torso, no reload)

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

Sanity check: nothing beats the AK47's close-range TTK except a contact shotgun blast, the sniper is the worst weapon inside 30 m, and the Mk14 is only oppressive if you stand in the open at 60 m — exactly where a DMR should win. **DPS** (damage × RPM / 60, ignoring reload): M4A1 375, AK47 360, M249 362, MP5 320, Mk14 333, M24 66, M870 126, M1911 267, G17 195, .357 186.

### 5.5 New mechanics each weapon forces

| Mechanic | Needed by | Code impact | Tests to add |
|---|---|---|---|
| **Pellets** | M870 | `WeaponDef.pellets`; one trigger pull → N bullets inside the cone; `Ballistics` pool 128 → ~384; tracer every 3rd pellet (dim) | pellet count, pellet spread inside cone, one shell consumed |
| **Shell-by-shell reload** | M870 | `ReloadMode = 'magazine' \| 'shell' \| 'belt'`; `WeaponState.applyReload` becomes mode-aware; reload interruptible and keeps loaded shells; `fpClips` partial-load loop | interruption keeps shells, tactical vs empty, cancel rules |
| **Bolt cycle** | M24 | New FP clip (`cycleBolt`), `cycleTravel` 0.09, `locksOnEmpty` false, optional un-scope between shots | fire-rate gate, scope-in delay after cycling |
| **Scope overlay** | M24, 3×/6× optics | Full-screen scope treatment (black vignette + canvas reticle); ADS already changes FOV via `adsFov` | FOV transition, no overlay while hip-firing |
| **Belt feed / drum** | M249 | Visual `belt` node only (no simulation); `chamber: 0`; longer reload with a feed-tray clip | no +1 round, reload length |
| **Burst fire** | M16A4 conversion | `FireMode = 'burst'`, burst counter in `WeaponState`, cooldown between bursts | 3 rounds per press, no extra round on hold, mode cycle order |
| **Bipod** | M249, M24 | No prone → "crouched and stationary for 0.3 s"; modifies recoil/spread only | modifier applies only when crouched + still |
| **Melee weapon** (wave 3) | Knife | New damage path (no bullet), front/back multipliers, animation. The *quick* knife (§4.1.3) does not need this | range, backstab multiplier |

Everything else (MP5, Mk14, G17, .357) reuses the existing box-magazine + single-cycle path and is pure content.

### 5.6 Gunsmith: what the reference games actually do

| Game | Slots | Unlock rule | Standout idea worth copying | What not to copy |
|---|---|---|---|---|
| **Modern Warfare (2019–III)** | 5 attachments, plus receiver/platform conversions | Weapon level per gun; attachments every few levels | Gunsmith preview with a stat-delta panel; "aftermarket parts" that turn an AR into an SMG/LMG | 30+ guns and 1,000 camos — content volume you cannot author |
| **Battlefield 3/4** | 4 (optic, accessory, barrel, underbarrel) | Kills with that weapon | Small, readable attachment list; clear per-slot trade-offs | Nothing major |
| **Battlefield 2042** | 4 changeable in-match ("Plus") | Weapon XP | On-the-fly attachment swap | In-match swapping conflicts with a tactical, slow-TTK game and doubles UI work |
| **Delta Force** | ~5–7 receiver-specific parts (muzzle, barrel, optic, magazine, grip, stock, tactical) + ammo types | Weapon level; some parts rank-gated | Parts are *not* universal: each receiver has its own set | Ammo/armour penetration (no armour system here) |
| **Tarkov** | Dozens, full modularity | Found/bought | Physical honesty of parts | Complexity, economy, stash UI |
| **CS2 / Valorant** | None | — | Pure skill expression | — |
| **XDefiant** | 5 | Weapon level | Attachments unlocked by playing *that* gun | — |
| **Siege / Insurgency** | 2–4 with a supply cost | Per-round loadout points | Cost budget forces choices | Supply points need a whole economy layer |

### 5.7 Recommendation and data model

**MW structure, Delta Force part sets, Battlefield trade-offs:**

- **Five slots:** Optic, Muzzle, Underbarrel, Magazine, Stock.
- **Parts are per-weapon-class**, not universal: an optic fits anything with a rail, a bipod only LMG/sniper, a drum only the LMG, a short barrel only the M4 platform. This keeps the catalogue honest.
- **Every non-default part has a real downside**, expressed in the units `WeaponDef` already uses.
- **Five attachments max, one per slot.**
- **No in-match swapping** — this game's identity is committing to a loadout before deploying.

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

Rules:

1. Start from a structured clone of the base def.
2. Apply additive deltas, then multipliers, then clamps. Deterministic order — not slot order.
3. `mag` is additive, then clamped to 1.6× base; `chamber` is untouched except `chamber: 0` weapons.
4. Recompute derived values once (`shotInterval`, `statBars`) after resolution.
5. Cache by `weaponId + sorted(attachmentIds)`; the loadout screen resolves constantly.
6. Reject illegal combos (wrong slot, wrong class, duplicate slot) with a typed error — the save loader silently drops them, like `ProfileStore.weaponFor()` today.

**Runtime wiring:** `PlayerWeapons` takes `Loadout` today (`{ primary, secondary }`). Change it to:

```ts
export interface WeaponBuild { id: WeaponId; attachments: readonly AttachmentId[]; }
export interface Loadout { primary: WeaponBuild; secondary: WeaponBuild; }
```

Resolve in `Game`/spawn code and construct `new WeaponState(resolvedDef)`. `WEAPONS` stays the immutable base table; bots and the player share the same resolver output.

### 5.8 Attachment catalogue (concrete values)

Calibrated to existing units. `×` = multiplier, `+` = additive.

**Optic** (fits all with a rail; pistols get a slide-mounted micro dot)

| ID | Effect | Downside | Model | Unlock |
|---|---|---|---|---|
| Iron sights (default) | — | — | existing | 1 |
| Micro red dot | ADS FOV 62, sight picture open | ADS +0.02 s | 60 tris | 2 |
| Holographic | ADS FOV 58, better moving-target clarity | ADS +0.03 s | 90 tris | 6 |
| 3× prism | ADS FOV 38 | ADS +0.08 s, move −0.02, hip cone +10% | 150 tris | 13 |
| 6× scope | ADS FOV 18 (M24 default) | ADS +0.12 s, move −0.04, hip cone +25% | 220 tris + scope overlay | 18 |

**Muzzle**

| ID | Effect | Downside | Model | Unlock |
|---|---|---|---|---|
| Flash hider (default) | muzzle flash −40% | — | existing | 1 |
| Compensator | recoilV ×0.88 | recoilH ×1.10, hearing radius +10 m | 70 tris | 3 |
| Muzzle brake | recoilV ×0.80 | recoilH ×1.25, hearing +25 m, flash larger | 90 tris | 11 |
| Suppressor | **hearing radius 60 → 22 m**, no flash, distant shot muted | muzzleVelocity ×0.88, damage near ×0.95, ADS +0.03 s | 160 tris | 8 |

> The suppressor is the best-designed attachment here because the AI already supports it: `Perception` hears shots within 60 m and `AudioManager` has a distant low-pass above 40 m. Implementation is one resolved-def field read in the perception check, and the player can *feel* it — enemies stop converging on your position.

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

**Barrel** (wave 2, tied to the platform system in §5.10)

| ID | Effect | Downside |
|---|---|---|
| Short (MK18 / AKS-74U) | ADS −0.04 s, move +0.02 | falloffEnd ×0.85, muzzleVelocity ×0.90, hip cone ×1.25 |
| Long (M16A4 / RPK) | falloffEnd ×1.25, damage near +2 | ADS +0.05 s, move −0.02, hip cone ×1.15 |

### 5.9 Balance guardrails (write these as tests)

1. **No strictly-better attachment.** Every entry has at least one negative in a different axis. Unit test: each non-default attachment has ≥1 non-zero downside field.
2. **Caps** (`CAPS`): a five-part recoil stack cannot push vertical recoil below 0.6×, ADS below 0.12 s, or damage above +15%.
3. **No cross-slot overlap:** one part per slot; illegal sets rejected by the resolver and the save loader.
4. **Class purity:** a drum cannot fit an AR; a 6× cannot fit an MP5; a bipod cannot fit a pistol.
5. **Meta builds to test by hand** (use the range):
   - *M4A1 CQB*: micro dot + comp + vertical grip + fast mag + light stock → 0.17 s ADS, manageable recoil, 28 rounds.
   - *M4A1 support*: 3× + comp + vertical grip + extended + heavy → 40 rounds, ~0.32 s ADS, holds a lane.
   - *AK47 marksman*: 3× + muzzle brake + angled + extended + heavy → 1–2 tap at 60 m, 40 rounds, terrible hip-fire.
   - *MP5 entry*: micro dot + suppressor + laser + extended + light → silent flanker, 40 rounds.
   - *M24 overwatch*: 6× + suppressor + bipod + heavy → 5 rounds, 22 m hearing, one-shot head.

### 5.10 Model integration and platform conversions

`WeaponModel.ts` exposes `muzzle`, `ejectionPort`, `sightAnchor`, `rightHandGrip`, `leftHandGrip`, `magWell` on every weapon, and `ModelKit` builds geometry procedurally. Attachment visuals need **no new rigging concept**:

- **Optic** → parent to `sightAnchor` (already the ADS eye point), hide the iron sights.
- **Muzzle** → parent to `muzzle`, hide the default flash hider/brake.
- **Magazine** → parent to `magWell`, hide the default magazine mesh (keep the *moving* `magazine` node so reload animations still work — parent the new mag inside it).
- **Underbarrel/stock** → new anchor points `underbarrel` and `stockRear` added to `AttachmentName`; the handguard grip is `leftHandGrip`, so a vertical grip sits just behind it.

Budget and rendering rules:

- 40–260 tris per part, `fp` only (third-person soldiers keep the base `tp` model).
- Build once per `weaponId + partId + lod`, cache the `BufferGeometry`, share palette materials (`WM.metal()`, `WM.polymer()`, new `WM.glass()`, `WM.tan()`).
- Merge parts into the existing per-material merge, so a fully kitted M4A1 stays at ~12–14 meshes instead of 25.
- `WeaponCard` must preview the equipped build: `buildWeaponModel(weapon.id, 'fp')` → `buildWeaponModel(build, 'fp')` (optional third argument keeps existing tests green).
- `OVERALL_LENGTH` tests: a short barrel legitimately changes length by more than 5%. Assert `base.length ± 0.03 m` for conversions instead of a fixed ±5%.

**Platform conversions (wave 2 — content multiplication).** Because the base models are assembled from named parts, a conversion can change the barrel and stock and three or four stats:

M4A1 platform:
- **MK18** — short barrel + no stock, faster, worse at range (falloffEnd ×0.85).
- **M16A4** — 20" barrel + fixed stock + **burst fire**, +range, −handling.
- **9 mm conversion** — 32-round mag, damage ×0.80, recoil ×0.65, new sound; expensive (new mag model + shells + audio).

AK platform:
- **AKS-74U** — short barrel, folding stock.
- **RPK** — long barrel, 45-round mag, bipod; becomes a pseudo-LMG.

Cost: ~1–2 days per conversion *if* the attachment/model system exists; ~0 days of new animation. The cheapest way to make the armoury look deep.

### 5.11 Stat display (fix the scale problem)

The card shows five 0–1 bars from `STAT_BARS` (`damageMax: 50`, `rangeMax: 100`). With an 88-damage sniper and 160 m falloff, every bar clamps and the M4A1's Range bar visibly *falls* when the M24 is added.

Recommended: **per-class bars.** Range scaled to the class maximum (pistols 60 m, SMG 50 m, AR 100 m, DMR 120 m, sniper 180 m), Damage scaled to the class maximum, and split "Accuracy" into **Control** (recoil) and **Handling** (ADS + move). The gunsmith then shows **delta arrows** from `statBars(resolved) − statBars(base)` — this is what makes attachments feel meaningful, and it reuses `WeaponStats.statBars()` unchanged.

### 5.12 Gunsmith UI flow

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

Reuse: `LoadoutPanel` (add "Customize"), `WeaponCard` (preview + bars + delta), `PreviewRenderer`, `ConfirmDialog` (reset build), `MatchHud`/`MatchSummary` (post-match XP). A second entry point from the Deploy Screen (`plan.md` §11) keeps it consistent.

### 5.13 Risks

| Risk | Mitigation |
|---|---|
| Attachment power creep ("must-have" 5-part meta) | Guardrail tests, caps, per-slot trade-offs; re-tune with the five builds in §5.9 |
| Suppressor trivialises bot AI | Cap hearing at 22 m; make suppressors cost velocity and range; no night-only escape hatch |
| 6× scope on an AR = sniper rifle | 6× is sniper/DMR-only; ARs stop at 3× |
| Procedural parts explode draw calls | Cache merged geometry, reuse `Assembly`, ~14 meshes max per kitted gun |
| Save files reference parts that changed | Version the profile (§11.7), drop unknown ids on load, never throw |

---

## 6. Visuals and audio

### 6.1 Rendering baseline (M1)

| # | Change | Detail | Effort |
|---|---|---|---|
| 6.1.1 | **ACES tone mapping + exposure** | `gl.toneMapping = ACESFilmicToneMapping`, exposure ~1.0; retune the palette (the flat look is partly unmanaged colour) | S |
| 6.1.2 | **Anti-aliasing quality** | Keep MSAA on high; add FXAA/SMAA as the "medium" preset | S |
| 6.1.3 | **Bloom + vignette** | Subtle bloom for muzzle flash, sun and tracers; optional vignette; no motion blur by default | S–M |
| 6.1.4 | **Muzzle-flash light** | 40 ms point light at the muzzle (FP and TP), intensity scaled by flash hider/suppressor | S |
| 6.1.5 | **Vertex AO on buildings** | Precompute corner/edge darkening into vertex colours — depth on flat-shaded geometry at zero per-frame cost | M |
| 6.1.6 | **Shadow tuning** | Two cascades (0–20 m sharp, 20–80 m soft) or a tighter near extent | M |
| 6.1.7 | **Decal system** | Pooled quads: bullet holes, blood, scorch, footprints. Canvas atlas, per-surface tint | M |
| 6.1.8 | **Instancing** | Cars, buses, containers, trees, barriers, planters as `InstancedMesh`; cut draw calls before adding lights | M |
| 6.1.9 | **Quality presets** | Low / Medium / High / Ultra: pixel ratio, shadows, AA, bloom, decal count, view distance | S–M |

### 6.2 Time of day and weather (M3)

One `LIGHTING_PRESETS` table drives sun, hemisphere, sky, fog, ambient audio, interior emissives and gameplay modifiers. It is the highest-value visual change available: the same 360 m map becomes five different places.

| Preset | Sun | Sky / fog | Gameplay effect | Use |
|---|---|---|---|---|
| **Dawn** | Low warm, long shadows | Peach → pale blue, thin fog | +10 m bot sight | Campaign opener, map variant |
| **Noon** (current) | High, hard | Blue gradient, minimal fog | Baseline | Default |
| **Dusk** | Orange, low, 8° | Orange/purple gradient, haze | −10 m sight, warm interiors | Map variant |
| **Night** | Moon only, cool | Deep blue, dark fog | −30 m sight, muzzle flash lights the room, tracers prominent | Map variant, campaign |
| **Overcast** | Soft, shadowless | Grey, flat | No shadows (perf win), muffled audio | Map variant |
| **Rain** | Diffuse | Grey + rain streaks | Wet roughness, puddles, −20 m sight, louder footsteps | Map variant, campaign |

| # | Feature | Detail | Effort |
|---|---|---|---|
| 6.2.1 | **Preset data** | `src/data/lighting.ts` → `PRESETS: Record<PresetId, LightingDef>`; `Lighting` and `Sky` read the active one | S–M |
| 6.2.2 | **Rain** | GPU particle streaks around the camera (10 k points, one draw call), splash sprites, wet asphalt via canvas roughness, puddle quads with a fake mirrored-sky reflection, rain audio bed | M–L |
| 6.2.3 | **Night lighting** | Street lamps + window emissives (instanced planes), a few real point lights near the player, cheap transparent cones | M |
| 6.2.4 | **Interior lights** | Emissive ceiling panels per floor plan; the 8 plans are data-driven (`plans.ts`) | M |
| 6.2.5 | **Wind** | Vertex wobble on trees, banners, tarps, flag cloth; strength per preset | S |
| 6.2.6 | **Ambient particles** | Dust motes, birds, distant smoke plumes, rain splash | S–M |

### 6.3 Combat VFX

| # | Feature | Detail | Effort |
|---|---|---|---|
| 6.3.1 | **Muzzle flash upgrade** | Per-weapon flash scale; suppressor removes it; flash lights interiors at night | S |
| 6.3.2 | **Impact upgrades** | Surface decals + small debris chunks; spark colour by material | S–M |
| 6.3.3 | **Tracer styles** | Bright for ARs, dim for pistol/SMG, none suppressed | S |
| 6.3.4 | **Shell casing persistence** | Shells stay ~10 s in the world and react to ground material audio | S |
| 6.3.5 | **Blood** | Low-key red puff + decal; gore toggle in settings | S |
| 6.3.6 | **Explosion VFX** | Fireball, dust ring, screen shake, debris, smoke column (frag/set pieces) | M |

### 6.4 Audio

Currently: procedural gunshots, impacts, footsteps, landings, hit ticks, positional bot shots. No music, no ambience, no VO.

| # | Feature | Detail | Effort |
|---|---|---|---|
| 6.4.1 | **Buses** | master → music / SFX / voice / ambience sliders (SettingsStore v2) | S–M |
| 6.4.2 | **Zone ambience** | Loops by area: depot hum + seagulls, plaza murmur, construction clatter, rain on metal; crossfade on zone change | M |
| 6.4.3 | **Music** | Menu theme, deploy tension loop, last-two-minutes layer, victory/defeat stingers — 5 short loops | M |
| 6.4.4 | **Combat mix** | Duck music under gunfire, add a low suppression layer, distant battle bed | S–M |
| 6.4.5 | **VO pipeline** | Radio-filtered commander + squadmate lines; subtitles; ~150 lines covers campaign + barks | M (system) |
| 6.4.6 | **Audio occlusion** | Low-pass when a shooter is behind a wall (raycast + filter), extending the existing distant filter | M |
| 6.4.7 | **Per-weapon shots** | Every new weapon needs a `shots` entry in `src/data/audio.ts` (crack + body + gain) | per weapon |

### 6.5 Performance budget

| Metric | Current | M1 target | M3 target |
|---|---|---|---|
| Draw calls (32 bots) | 131–163 | ≤ 140 | ≤ 160 |
| Triangles | ~247 k | ~250 k | ~300 k |
| Frame time (fixed step) | ~1.9 ms bots | < 2.5 ms | < 3 ms |
| GPU frame | software-rendered (unmeasured) | 60 FPS on a GTX 1050-class GPU | 60 FPS with rain/night |
| Particles | minimal | ≤ 2 k | ≤ 12 k (rain) |

Add an automated perf check to the headless harness: run 30 s of a 32-bot match and assert draw calls/triangles under budget — the harness already exists.

---

## 7. Models and art production

### 7.1 Soldiers (biggest visual credibility win)

| # | Feature | Detail | Effort |
|---|---|---|---|
| 7.1.1 | **Cosmetic variety** | 3 body builds × 4 helmet shapes × 3 vest types × 2 backpacks × 4 skin tones; seeded per bot so squads look mixed | M |
| 7.1.2 | **Team identity** | Blue: cool accents + helmet band; Red: warm accents + scarf/shemag; readable at 90 m | S–M |
| 7.1.3 | **Hands and gloves** | Shaped mitts with knuckle blocks and a thumb; 3 glove colours | S–M |
| 7.1.4 | **First-person body** | Torso + legs visible when looking down; sleeves match team colour; legs animate with walk/sprint/crouch/slide | M |
| 7.1.5 | **Gear jiggle** | Vest pouches, backpack and sling sway with acceleration (reuses `Spring`) | S |
| 7.1.6 | **Death** | Ragdoll-lite (§4.1.5) + helmet falls off with physics | M |
| 7.1.7 | **Wounded states** | Limp at low health, arm clutch; cheap animator blend | S–M |

### 7.2 Props and set dressing

| # | Feature | Detail | Effort |
|---|---|---|---|
| 7.2.1 | **Palette variants** | Every car/bus/container gets 3–4 colourways | S |
| 7.2.2 | **Signage** | Canvas-drawn storefront signs, posters, road signs, graffiti decals | S–M |
| 7.2.3 | **Vertical clutter** | AC units, cable runs, satellite dishes, water tanks, laundry lines, fire escapes | M |
| 7.2.4 | **Destructibles** | Crates shatter, sandbags degrade, barrels explode, glass breaks | M–L |
| 7.2.5 | **Pickups** | Ammo box, medkit, grenade, weapon — small readable models with a slow bob and glow | S–M |
| 7.2.6 | **Set pieces** | Wrecked APC, static helicopter, artillery piece, checkpoint barriers, evacuation tents | M |
| 7.2.7 | **Street life** | Abandoned cars with open doors, scattered luggage, market stalls, cafe chairs | S–M |
| 7.2.8 | **Weapon props** | Slings, attachment-ready rails, optic mounts, suppressor collars; world-model weapon drops | S–M |

### 7.3 Interiors

| # | Feature | Detail | Effort |
|---|---|---|---|
| 7.3.1 | **Per-plan furnishing** | Each of the 8 plans gets a furniture kit: desks, shelves, sofas, counters, filing cabinets, ceiling panels | M–L |
| 7.3.2 | **Interior cover** | Furnishing creates real cover and sightline breaks — gameplay, not decoration | (part of 7.3.1) |
| 7.3.3 | **Vertical interiors** | Mezzanines/balconies in city hall and the depot hall | M |

### 7.4 Art production rules

- **Silhouette first:** every new model must be identifiable in black at 50 m.
- **One material per object family**; bake colour into vertex colours (the soldier already does this) to keep one draw call.
- **Budget:** soldier ≤ 900 tris near / ≤ 250 far; props ≤ 400; pickups ≤ 80; weapons per §5.3.
- **No new texture files** until §7.5; use vertex colour + canvas textures.

### 7.5 Small asset pipeline (recommended)

A single `assets/` folder of **generated** canvas textures (signs, posters, graffiti, decal atlas, muzzle flash, rain streak) keeps the "no external models" promise while lifting fidelity far more than extra geometry would. Generate at build time or on first run; cache in memory.

---

## 8. Map expansion

### 8.1 The existing map's weaknesses

- Two-dimensional: almost all fights happen at street level.
- Mirrored halves (A↔E, B↔D) are fair but predictable.
- Long straight streets with few breaks — fine for ARs, hostile to snipers and shotguns.
- Interiors are shells: 8 floor plans, little furniture.
- No underground, no rooftop route loop, no chokepoint variety between flags.

### 8.2 Additions (ordered by value per week)

| # | Feature | Detail | Effort |
|---|---|---|---|
| 8.2.1 | **Cover pass** | Break every sightline over 90 m with waist-high cover, planters, vehicles, barriers; add "60 m" mid-lanes | S–M |
| 8.2.2 | **Spawn rooms** | 2–3 exits per spawn, protected by geometry | S |
| 8.2.3 | **Central landmark** | Plaza statue/fountain/clocktower with cover at its base | S–M |
| 8.2.4 | **Signage & wayfinding** | Colour-coded districts, street names on the minimap | S |
| 8.2.5 | **Rooftop loop** | Stairs to 2–3 connected roofs, drop-downs, one zipline from the office tower to the plaza | M–L |
| 8.2.6 | **Basement / tunnel under C** | 4 m service tunnel linking C to A and E, one collapsed section, dim lighting | L |
| 8.2.7 | **More enterable buildings** | 8 → 12 plans (clinic, garage, corner cafe, metro entrance) | L |
| 8.2.8 | **Ziplines** | Spline movement, 8 m/s, jump-off allowed | S–M |
| 8.2.9 | **Minimap upgrades** | Last-seen enemies, elevation arrows, north indicator, zoom, interior outlines | S |
| 8.2.10 | **Zone ambience map** | Audio zones matching districts | S–M |

### 8.3 Map variants (cheap content, M3)

| Variant | Change | Effort |
|---|---|---|
| **Dusk patrol** | Dusk preset + 3 blocked routes + different flag ownership | S |
| **Rain sweep** | Rain preset + puddles + 1 closed street | S–M |
| **Blackout** | Night preset, street lamps off in two districts, muzzle flash becomes a giveaway | S–M |
| **Overcast** | Flat light, no shadows, better perf; good for low-end machines | S |

Variants reuse the entire map; they are the main reason to build lighting presets before a second map.

### 8.4 Second map (M6, XL)

**Shipyard / container port** is the recommended second map: built almost entirely from boxes and cylinders (cheap procedural art), with natural verticality (cranes, stacked containers, ship hulls) and completely different play from the city (long sightlines, container corridors, water hazards). Target 280×280 m, 5 flags, 6 enterable structures, one climbable crane.

---

## 9. Settings, UX and accessibility

### 9.1 Settings expansion

| Group | Settings | Effort |
|---|---|---|
| **Graphics** | Preset (Low/Med/High/Ultra), resolution scale 50–100%, shadow quality, AA mode, bloom toggle, decal density, view distance, FPS cap, VSync | M |
| **Audio** | Master / SFX / music / voice / ambience sliders, hit-marker volume | S–M |
| **Controls** | Full key rebinding, sensitivity, ADS sensitivity multiplier, invert Y, toggle vs hold for ADS/sprint/crouch, slide key | M |
| **Interface** | Crosshair style/colour/size/gap, hit-marker style, HUD scale, minimap size/position, damage numbers | S–M |
| **Gameplay** | Gore level, camera shake amount, auto-reload, auto-sprint, grenade indicator | S–M |

`SettingsStore` currently stores three numbers; expand it with per-group objects and migrate `lowfront.settings.v1` → `v2` defensively, like `ProfileStore` does.

### 9.2 Accessibility

| # | Feature | Why | Effort |
|---|---|---|---|
| 9.2.1 | **Colourblind team palettes** | Blue/red on bright sand is a known failure case | S–M |
| 9.2.2 | **High-contrast enemy outlines** (toggle) | Low vision and night readability | S–M |
| 9.2.3 | **Reduced camera shake / flash intensity** | Photosensitivity and motion sickness | S |
| 9.2.4 | **Subtitle size/background + VO captions** | Needed for the campaign anyway | S–M |
| 9.2.5 | **Toggle instead of hold** | Motor accessibility | S |
| 9.2.6 | **Text scaling and UI contrast** | Readability on 1080p TVs | S |

### 9.3 Meta and UX

| # | Feature | Detail | Effort |
|---|---|---|---|
| 9.3.1 | **Match setup screen** | Mode, map, variant, bot count/difficulty, length, friendly fire | S–M |
| 9.3.2 | **Career page** | Rank, per-weapon levels, KD, accuracy, captures, favourite weapon/map, medals | M |
| 9.3.3 | **Contracts** | 3 date-seeded objectives, reward XP + camo | M |
| 9.3.4 | **Multiple profiles + export/import** | Local JSON, shareable | S |
| 9.3.5 | **Local leaderboards** | Per mode/map best score, fastest capture, best KD | S |
| 9.3.6 | **Photo mode** | Pause + free camera + hide HUD + FOV + filters + PNG export | S–M |
| 9.3.7 | **Deploy screen improvements** | Route preview, last death location, safe-spawn indicator, kit summary | S–M |
| 9.3.8 | **Loading screen** | Map flyover + tip + progress | S |
| 9.3.9 | **Pause menu** | Resume, options, career, controls, quit with confirm | exists; extend |
| 9.3.10 | **Localisation framework** | i18n keys from day one; cheap now, expensive later | M |

---

## 10. Campaign (full scripted)

### 10.1 Premise and tone

**Setting:** the fictional Adriatic port city of **Vardan**, 2031. A blockade has cut the city off; the Vardan Civil Council (Blue) holds the port districts, the **Iron Tide** militia (Red) holds the north and the station. A small multinational task force — call sign **Low Front** — is holding the line while civilians evacuate.

**Tone:** grounded, dry, human. No politics, no real nations, no named real conflicts. Radio chatter carries the story; the player is a sergeant, not a superhero.

**Themes:** holding a line you cannot win, the cost of a city, small-unit loyalty.

### 10.2 Story bible (short)

| Element | Detail |
|---|---|
| **Player** | Sgt. Elias "Rook" Vance, 3rd Battalion, Low Front task force. Silent protagonist; speaks only in mission-end lines |
| **Commander** | Lt. Mara Voss — radio voice, calm, increasingly strained as evacuation slips |
| **Squad** | Cpl. "Patch" Okoye (medic, dry humour), Sgt. "Hatch" Rivera (breacher, loud), Pvt. "Sparrow" Lin (rookie, the emotional barometer) |
| **Antagonist** | Colonel Sava "Anvil" Dren, Iron Tide — methodical, patient, wants the port intact |
| **Antagonist 2** | "Moth" — Iron Tide sniper, recurring threat across three missions, resolved in mission 7 |
| **Civilians** | Evacuation convoy, a clinic, a station full of people — the stakes, not a mechanic |
| **Arc** | Hold (1–3) → strike back (4–5) → lose ground (6) → hold the line for evacuation (7) → extraction at dawn (8) |

### 10.3 Mission list (8 missions, ~20–30 min each)

| # | Mission | Time / weather | Location (existing geometry) | Objectives | New systems exercised |
|---|---|---|---|---|---|
| 1 | **First Light** | Dawn, clear | Bus depot (A) | Tutorialised assault: move, shoot, clear the hall, capture the yard | Tutorial prompts, checkpoints, ally squad |
| 2 | **High Ground** | Morning | Office tower + plaza | Clear 3 floors, then overwatch the plaza while allies cross | Vertical combat, scripted ally advance, sniper intro |
| 3 | **Civic Duty** | Noon | City hall | Defend the hall for 6 minutes against 3 waves | Wave director, defend objective, resupply crates |
| 4 | **Short Fuse** | Afternoon, overcast | Construction site + station | Plant 3 charges, then exfiltrate under fire | Plant/hold objective, timer, scripted explosions |
| 5 | **Blackout** | Dusk → night | Apartment block | Stealth approach (alarms), then breach; suppressed weapons encouraged | Alarm/stealth state, night lighting |
| 6 | **Rain Check** | Night, rain | Depot → streets | Escort an engineer to restore power; convoy ambush | Escort objective, moving NPC, rain VFX |
| 7 | **A Long Shot** | Dawn, fog | Station + rooftops | Hunt "Moth" across rooftops; counter-sniper duel | Sniper duel scripting, fog preset, glint tell |
| 8 | **Last Light** | Night, rain clearing | Plaza + tunnel | Hold the plaza for the evacuation, then fight through the tunnel to extraction | Finale, all systems, "Anvil" heavy encounter |

**Mission progression:** each mission unlocks the next; all replayable from mission select with medals (Bronze/Silver/Gold for time/accuracy/no-death). Campaign progress is separate from multiplayer progression but grants account XP on first completion.

### 10.4 Campaign systems (M4 — build these before content)

| # | System | Design | Effort |
|---|---|---|---|
| 10.4.1 | **Mission data** | `MissionDef` per mission: preset, weather, spawns, loadout whitelist, objectives, triggers, dialogue, fail conditions | S–M |
| 10.4.2 | **Trigger volumes** | Box/sphere volumes with `onEnter`, `onExit`, `once`; fire dialogue, objectives, spawns, set pieces | M |
| 10.4.3 | **Objective state machine** | `reach`, `clear`, `capture`, `defend(timer)`, `plant`, `escort`, `survive`, `extract`, `kill(target)`; ordered, with optional side objectives | M–L |
| 10.4.4 | **Wave director** | Spawn budget, escalation curve, out-of-view spawn points, cap on live enemies | M |
| 10.4.5 | **Checkpoints** | Auto-save at objective transitions and key triggers; store mission, checkpoint, player and ally state; `lowfront.campaign.v1` | M |
| 10.4.6 | **Cinematic camera** | Keyframed paths (reuse `Timeline` + `Easing`), letterbox, skip, hold-to-skip | M–L |
| 10.4.7 | **Dialogue system** | Line queue, speaker, subtitle, radio filter, optional VO, priority/interrupt rules | M |
| 10.4.8 | **Ally squad orders** | 3 allies that follow, hold, assault a marked point; self-heal after 10 s out of combat | M–L |
| 10.4.9 | **Scripted events** | Explosions, airdrops, gate breaches, convoy movement, artillery — a small event bus with delays | M |
| 10.4.10 | **Mission UI** | Objectives panel, waypoint markers, failure reasons, briefing/debriefing cards | M |
| 10.4.11 | **Difficulty** | Recruit / Regular / Veteran: bot accuracy, reaction, health, checkpoint density | S–M |
| 10.4.12 | **Stealth state** | Alarm level per district; suppressed kills do not raise it; detection cones | M–L |

**Build order inside M4:** 10.4.1 → 10.4.2 → 10.4.3 → 10.4.5 → 10.4.10 (grey-box mission 1 playable) → 10.4.7 → 10.4.4 → 10.4.6 → 10.4.8 → 10.4.12 → 10.4.11.

### 10.5 Content production (M5)

| Work | Detail | Effort |
|---|---|---|
| Story bible + scripts | 8 mission scripts, ~60 lines each (~480 total, ~150 voiced) | 2–3 wk |
| Mission assembly | Block districts, place triggers, waves, checkpoints, test loops | 5–7 wk |
| Set pieces | 3–5 bespoke moments: convoy ambush, tower collapse, tunnel fight, evacuation | 2–3 wk |
| VO | 2 main voices (Voss, Patch) + 3 minor; ~150 lines; radio-filtered; text-only fallback | 1–2 wk |
| Difficulty + balance | 3 difficulties, bot tuning per mission | 1–2 wk |
| Polish + QA | Soft-lock hunt, checkpoint validity, audio mix | 2 wk |

### 10.6 Campaign risks and mitigations

| Risk | Mitigation |
|---|---|
| Mission scripting becomes an engine project | Timebox M4 to 6–8 weeks; if over, cut cinematics and ally orders, keep triggers/objectives/checkpoints |
| Story scope creep | No cutscene animation beyond camera moves; no facial animation; radio + subtitles only |
| VO cost | Text-first; VO optional and layered later |
| Same-map fatigue | Lighting/weather presets per mission + blocked districts + interiors; M3 pays for this |
| Difficulty spikes | Playtest each mission on Regular with a stopwatch; target 60–70% completion first try |
| Save corruption | Checkpoint save is atomic and versioned; corrupt → restart mission, never the campaign |

### 10.7 Campaign content reuse matrix

| Mission | Depot | Apartments | City hall | Office tower | Station | Construction | Tunnel (new) | Rooftops (new) |
|---|---|---|---|---|---|---|---|---|
| 1 First Light | ● | | | | | | | |
| 2 High Ground | | | | ● | | | | ● |
| 3 Civic Duty | | | ● | | | | | |
| 4 Short Fuse | | | | | ● | ● | | |
| 5 Blackout | | ● | | | | | | |
| 6 Rain Check | ● | | | | | | | |
| 7 A Long Shot | | | | | ● | | | ● |
| 8 Last Light | | | ● | | | | ● | |

Only two new geometry areas (tunnel, rooftop routes) are needed for all eight missions — the payoff of building the campaign on the existing map.

---

## 11. Progression and unlocks

### 11.1 Two layers (MW + Delta Force hybrid)

| Layer | Range | Earned by | Unlocks | Reset? |
|---|---|---|---|---|
| **Account rank** | 1–55 | Match XP (any weapon) | Weapons, attachment slots, cosmetic badges; rank 55 → optional prestige | No |
| **Weapon level** | 1–30 | XP with that weapon | That weapon's attachments (all by 20), camo tiers 21–30 | No |
| **Challenges** | per weapon / global | Specific feats | Camos only (no stat power) | No |

Why not Battlefield's "kills per weapon unlock attachments"? A bot-only game benefits from a visible, predictable bar. Why not currency? An offline game with 31 bots has no economy to balance, and currency invites grind padding.

### 11.2 XP sources

| Action | Account XP | Weapon XP |
|---|---|---|
| Kill | 50 | 30 |
| Headshot bonus | +15 | +10 |
| Assist (damage dealt, not the killer) | 20 | 10 |
| Capture a flag | 150 | 75 |
| Defend a flag (kill inside own zone) | 100 | 50 |
| Match win | 600 | 150 |
| Match loss | 200 | 50 |
| Match completion | — | 200 |

Typical 25-minute match: ~15 kills, 3 headshots, 1–2 captures, a win ≈ **1,500–1,900 account XP** and ~**900 weapon XP**.
No XP for: training range, self-damage, team damage, bots (they never earn), idle time. No multipliers for sale; an optional 2× weekend flag in `src/data/progression.ts` is fine.

### 11.3 Curves and totals

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

Keep all constants in one `src/data/progression.ts` and unit-test the cumulative tables — the kind of pure math the repo already tests.

### 11.4 Weapon unlock schedule (account rank)

| Rank | Unlock | Rationale |
|---|---|---|
| 1 | M4A1, M1911 | Default kit |
| 2 | M4A1 attachments (weapon level 2) | Teach the system immediately |
| 3 | **MP5A3** | First alternative; rewards aggression early |
| 6 | AK47 | Damage vs handling lesson |
| 10 | **M870** | Interior play opens |
| 14 | **M249** | Support role |
| 18 | **Mk14** | Rewards aim, prepares for the sniper |
| 22 | **M24** | Long-range payoff after ~8 h |
| 26 | **G17** | Sidearm depth |
| 30 | M4A1 platform conversions (barrel slot) | Second wind for the starter gun |
| 35 | AK platform conversions | — |
| 40 | .357 | Flavour, not power |
| 45 | Knife (if the equipped melee ships) | Cosmetic/finisher |
| 55 | Prestige badge + a cosmetic camo set | End of the road |

Weapons are **never** removed or made obsolete by rank; nothing outclasses the M4A1 in its own zone (§5.4).

### 11.5 Attachment unlock schedule (per weapon, levels 1–20)

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

One unlock-order function and one table per class — not nine hand-written lists.

### 11.6 Challenges and camo (cosmetic only)

| Tier | Requirement (per weapon) | Reward |
|---|---|---|
| Woodland | 50 kills | Green camo |
| Desert | 150 kills + 25 headshots | Tan camo |
| Arctic | 300 kills + 1,000 damage at 40 m+ | White camo |
| Digital | 500 kills + 50 headshots | Grey-digital camo |
| **Mastery** | 750 kills + 100 headshots + 25 longshots | Gold + weapon nameplate |

Camos are a **material colour swap** per weapon instance (`WM` palette override + `flatShading`), not new models — a few hours of work for the most visible progression reward in the game. Global challenges ("10 kills with each class", "capture 50 flags") unlock badges.

### 11.7 Persistence (schema v2)

Follow the `ProfileStore` philosophy: JSON in localStorage, validate every field, fall back to defaults, never throw.

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
- v1 (`{name, stats, loadout:{primary,secondary}}`) → v2: wrap ids into `WeaponBuild`, derive rank from stats (`1 + floor(kills/25)`, capped 55) or start at 1, derive weapon levels from kills.
- Unknown weapon/attachment ids are dropped, not fatal (same as `weaponFor()` today).
- Rank/weapon XP clamped to the curve maximum; negative values rejected.
- "Reset progress" in the Pause Menu with a confirmation dialog.

### 11.8 UI touchpoints

| Screen | Change |
|---|---|
| Profile & Loadout (`LoadoutPanel`) | Locked cards (rank requirement, greyed), "Customize" button, equipped attachment count |
| Deploy Screen (`plan.md` §11) | Reuses `LoadoutPanel`; shows rank + weapon level |
| Gunsmith (§5.12) | Slots, parts, 3D preview, stat deltas, 5/5 counter |
| Post-match / End Screen (`MatchSummary`) | XP breakdown, animated rank bar, unlock list ("Suppressor unlocked for M4A1") |
| Pause Menu (`PauseMenu`) | "Career" page: rank, next unlock, per-weapon levels |
| HUD (`MatchHud`) | Optional small rank icon; kill feed already shows weapon names |
| Training range | **All weapons and attachments available** with a "not unlocked" watermark — the best onboarding tool you have, and it costs nothing |

### 11.9 Bots and balance in an offline game

- Bots never earn XP and never gate content.
- Bots currently pick a random primary from `PRIMARIES`. Extend to weighted picks by role and range (shotguns near C, DMRs at B, snipers rare) and give bots **default or optic-only** attachments, resolving once per archetype and sharing the `WeaponDef`.
- Do **not** give bots suppressors until the perception change is tuned; otherwise friendly bots feel blind.
- Bots must be excluded from sniper-only loadouts until `BotAim` handles bolt-action cadence (currently 3–6 round bursts, 12% headshot chance). A bot with a one-shot headshot sniper would be the least fun thing in the game.

### 11.10 Campaign tie-in

- Campaign completion grants account XP once per mission plus cosmetics: a worn-finish weapon and a "Vardan" camo set.
- Mission loadouts are whitelisted per mission (`MissionDef.loadout`), so the campaign can hand the player a suppressed MP5 for Blackout without touching progression.
- Contracts provide short-session goals; no currency, no store, no loot boxes.
- Photo mode and camos are the "show off" layer; leaderboards and medals are the "prove it" layer.

---

## 12. QA and test matrix

| Area | Test | Type |
|---|---|---|
| Movement | Vault heights 0.3 / 0.9 / 1.3 m; slide cancels reload; no clipping through 1.2 m walls | Unit + manual |
| Grenades | Fuse timing, bounce, damage falloff, self-damage, smoke LOS blocking | Unit |
| Suppression | Debuff applies to near misses only, expires, does not stack infinitely | Unit |
| Spawns | Never spawn within 15 m of an enemy; protection blocks damage both ways | Integration |
| Bots | Smoke/suppression reactions; fireteam objectives; no stuck > 5 s in a full match | `test:match` |
| Modes | Ticket/score/bleed rules per mode; win conditions; no soft lock at 0 tickets | Unit |
| Weapons | Every def has valid ranges; no weapon beats another in every bar of its class; TTK matches §5.4 | Unit |
| Attachments | Caps, clamps, slot uniqueness, `fits` matrix, every non-default part has a downside, resolver never mutates `WEAPONS` | Unit |
| Progression | Cumulative XP tables, no negative/overflow on load, monotonic unlock schedule, level 30 exactly at total | Unit |
| Saves | v1 → v2 profile/settings migration; unknown ids dropped; corrupt JSON → defaults; checkpoint corruption | Unit |
| Models | Per-weapon tri budgets, attachment parts within budget, right-hand grip at origin for kitted builds | Unit |
| Ballistics | Pellets per shot, pellet cone containment, pool never exhausted with 8 shotguns firing | Unit |
| Perception | Suppressor radius applies to gunshot hearing | Unit |
| Lighting | Each preset boots, no NaN fog, night does not break minimap colours | Manual + screenshot |
| Perf | 32 bots, rain, night: draw calls/triangles under budget; frame time budget | Automated harness |
| Campaign | Each mission start→end; every checkpoint restores; no missing dialogue; skip cinematics | Scripted playthrough |
| Accessibility | Colourblind palettes legible; shake reduction removes flash | Manual |
| Builds | Web + Electron install, quit flow, save paths | Manual |

---

## 13. Effort summary and dependencies

| Milestone | Effort | Weapon work inside | Depends on | Ships |
|---|---|---|---|---|
| M1 Ship quality | 5–7 wk | W0 refactor (2–3 d) | — | Public-ready build |
| M2 Combat texture | 6–8 wk | W1 wave 1 (6–9 d) | M1 | Better fights, 6 weapons |
| M3 World variety | 6–9 wk | W2–W3 gunsmith (9–13 d) | M2 | 5 looks, full gunsmith |
| M4 Campaign foundation | 7–9 wk | W4 progression (4–6 d) | M3 | Mission 1 grey-box, XP |
| M5 Campaign content | 10–14 wk | — | M4 | 8-mission campaign |
| M6 Breadth | 9–14 wk | W5–W6 (9–14 d) | M1–M2 | 2 maps, 3+ modes, 9 weapons |
| **Total** | **~43–61 wk** | **30–45 d** | | |

Critical path: M1 → M3 → M4 → M5. M2 and M6 can run in parallel with campaign content if you have help, but a solo developer should not parallelise.

---

## 14. Open decisions

**Campaign and content**

1. **Campaign length:** 8 missions (~4–6 h) as proposed, or 5 missions (~2.5 h) to reduce risk?
2. **VO:** text-only first (recommended), or record/generate ~150 lines up front?
3. **Stealth mission:** keep the alarm/stealth system (mission 5) or convert Blackout to a straight night assault?
4. **Second map:** shipyard as proposed, or a desert town (more contrast from the city)?
5. **Modes priority:** TDM first (safe) or Rush first (more distinctive)?

**Weapons**

6. **Roster size:** six new weapons (nine total) as proposed, or trim to three (MP5, M870, M24) for a tighter first pass?
7. **Attachments:** the full five-slot catalogue, or start with Optic + Muzzle + Magazine (clearest feel, lowest model cost)?
8. **Platform conversions** (MK18/M16A4/AKS-74U/RPK): in scope? The cheapest content, but they need burst fire and a barrel slot.
9. **Names:** real firearm names (consistent with M4A1/AK47/M1911) or fictional aliases for a possible commercial release?
10. **Progression pace:** is ~15 h to rank 55 and ~9.5 h per weapon right for a bot-only game, or should ranks 1–10 be faster (×0.6 XP) to hook players?
11. **Bots with attachments:** default/optic only (recommended) or full random builds?

**Cross-cutting**

12. **Online:** confirm "maybe later" stays a non-goal — it changes nothing above, but decides whether to keep the command-object refactor in M1.
13. **Art:** no outlines/toon shading (confirmed keep-style) — revisit only if screenshots underwhelm after M3.

---

## Appendix A — File map (where each system lands)

| System | New / existing files |
|---|---|
| Weapon data, attachments | `src/data/weapons.ts`, new `src/data/attachments.ts`, new `src/weapons/attachments.ts` |
| Weapon models | `src/weapons/models/*`, `weaponModels.ts`, `ModelKit.ts` |
| Viewmodel / animations | `src/data/viewmodel.ts`, `src/anim/fpClips.ts`, `src/anim/WeaponVisual.ts` |
| Progression | new `src/data/progression.ts`, `src/save/ProfileStore.ts`, `src/ui/match/PauseMenu.ts`, `MatchSummary` |
| Gunsmith UI | new `src/ui/profile/Gunsmith.ts`, `LoadoutPanel.ts`, `WeaponCard.ts` |
| Lighting presets, weather | `src/data/lighting.ts`, `src/render/Lighting.ts`, `src/render/Sky.ts`, new `src/render/Weather.ts` |
| Post-processing | new `src/render/Post.ts`, `Renderer.ts` |
| Decals / VFX | `src/weapons/Effects.ts`, `src/weapons/Impacts.ts`, new `src/render/Decals.ts` |
| Grenades | new `src/weapons/Grenades.ts`, `PlayerWeapons.ts`, `src/data/weapons.ts` |
| Smoke / LOS | new `src/world/Smoke.ts`, `src/ai/Perception.ts`, `src/game/Combat.ts` |
| Vault / slide | `src/entities/PlayerMovement.ts`, `src/physics/CharacterMotor.ts`, `src/anim/fpClips.ts` |
| Modes / match setup | `src/scenes/*`, new `src/data/modes.ts`, `src/game/Scoring.ts` |
| Settings | `src/save/SettingsStore.ts`, `src/data/settings.ts`, `src/ui/match/PauseMenu.ts` |
| Campaign data | new `src/campaign/missions/*.ts`, new `src/campaign/types.ts` |
| Triggers / objectives | new `src/campaign/Triggers.ts`, new `src/campaign/Objectives.ts` |
| Checkpoints | new `src/campaign/CampaignStore.ts` |
| Dialogue | new `src/campaign/Dialogue.ts`, `src/audio/AudioManager.ts` |
| Cinematics | `src/anim/Timeline.ts`, new `src/campaign/CinematicCamera.ts` |
| Ally squad | `src/ai/BotBrain.ts`, new `src/campaign/AllySquad.ts` |
| Map additions | `src/data/map/plans.ts`, `src/data/map/areas.ts`, `src/world/*` |
| Second map | new `src/data/map2/*`, `src/world/MapBuilder.ts` |

## Appendix B — Mission data sketch

```ts
export interface MissionDef {
  id: string;
  name: string;
  preset: LightingPresetId;      // dawn | noon | dusk | night | overcast | rain
  weather: WeatherId;            // clear | rain | fog | dust
  districtBlocks: string[];      // areas sealed for this mission
  spawn: SpawnDef;
  loadout: { primary: WeaponId[]; secondary: WeaponId[] };
  objectives: ObjectiveDef[];    // ordered, with optional side objectives
  triggers: TriggerDef[];
  dialogue: DialogueLine[];
  fail: FailCondition[];
  difficulty: Record<Difficulty, { botSkill: number; checkpoints: number }>;
}
```

## Appendix C — Weapon model build notes (procedural)

| Weapon | Key parts to build (all `ModelKit`) | New nodes | Watch out for |
|---|---|---|---|
| MP5A3 | Stamped receiver, cocking tube + charging handle at the front left, slim handguard, hooded front sight, drum rear sight, curved 30-rd mag, retractable stock | `chargingHandle`, `magazine`, `trigger`, `selector` | Charging handle is *forward* on the left, unlike the AK — the rack pose must move |
| M870 | Receiver, 6-shell tube + spring, ribbed pump forearm, 20" barrel, bead front sight, wooden stock/forearm, shell lifter | `pump` (forearm), shell visual | Shell-by-shell animation: left hand goes to the pouch, pushes each hull; empty reload is *not* a mag swap |
| M24 | 24" tapered barrel, Mauser-style bolt with handle, HS-precision stock, 10× scope on a rail, bipod stub | `bolt`, `boltHandle`, `trigger` | Scope overlay + very long ADS; hip-fire cone must feel terrible |
| M249 | Stamped box, feed tray, 200-rd box, heat shield, carry handle, bipod, long barrel | `bolt` (feed), `chargingHandle`, `cover` (feed cover) | Belt box must not read as a giant magazine; reload clip needs the feed cover |
| Mk14 | M14 receiver, 22" barrel, scope rail, 10-rd box, walnut/E2 stock, muzzle stabiliser | `bolt`, `magazine`, `trigger` | Wood palette already exists (`PALETTE.akWood`, `m1911GripWood`) |
| G17 | Polymer frame, slide with serrations, 17-rd mag, three-dot sights | `slide`, `magazine`, `trigger` | Pistol tri budget is ~750 — do not detail the frame like the 1911 |
| .357 | Frame, fluted cylinder (rotating node), swing-out crane, 6 chambers, wood grip | `cylinder`, `hammer`, `trigger` | Cylinder rotation and per-chamber reload |

## Appendix D — Naming and licensing note

The project already ships real designations (M4A1, AK47, M1911), normal for hobby builds and matching how Battlefield licenses names. Firearm names are trademarks of their manufacturers in several jurisdictions; if this is ever sold, either license or use the aliases in §5.2 (Call of Duty's approach: "M4", "Kastov 762"). A legal footnote, not a design blocker — but decide it **before** writing nine names into save files, kill feeds and audio tables.

## Appendix E — Cut list (if time runs out)

| Priority | Keep | Defer | Drop |
|---|---|---|---|
| 1 | Dusk + night presets, wind, muzzle light, decals | Overcast, dust | Photo mode |
| 2 | Smoke, knife, vault, spawn safety, match setup, hardcore, MP5 + M870 | Frag, slide, spotting, M24 | Resupply crates |
| 3 | Triggers, objectives, checkpoints, 5 missions | Cinematics, ally orders, stealth | Full VO, 8th mission |
| 4 | Three gunsmith slots, TDM, career page | Rush, contracts, wave 2 weapons | Second map, camos |

## Appendix F — One-page summary

**Weapons**
- Add: MP5A3, M870, M24 (wave 1); M249, Mk14, G17 (wave 2); .357 and knife (optional).
- Don't add: launchers, akimbo, thermal/NV, in-match attachment swapping.
- Customise: 5 slots, ~20 parts, per-class fits, every part has a downside, resolver is pure and capped.
- Unlock: account rank 1–55 (weapons) + weapon level 1–30 (attachments, all by 20); ~15 h / ~9.5 h; camos are colour swaps.
- Fix first: 5 hard-coded id checks, stat-bar scales, tri/length tests, bullet pool.

**Game**
- Gameplay: smoke, frag, knife, vault, slide, suppression, spawn safety, squad spawn, match setup, hardcore, bot fireteams.
- Visuals: tone mapping, muzzle light, bloom, decals, AO, instancing, six lighting presets, rain, wind, ambience.
- Map: cover pass, rooftop loop, tunnel under C, landmark, signage, variants, shipyard second map.
- Campaign: 8 missions on the existing map, story bible included, checkpoints and ally orders first.
- Settings: keybinds, graphics/audio/controls, accessibility, contracts, career, photo mode.

**Sequence if you do nothing else:** tone mapping + options + perf (M1) → smoke + spawn + MP5/M870 (M2) → dusk/night + gunsmith (M3) → five-mission campaign + XP (M4/M5). Roughly 22–28 weeks to a game people finish and recommend.
