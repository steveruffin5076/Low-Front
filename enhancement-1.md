# enhancement-1.md — Low Front Improvement Plan

**Type:** design + production plan (proposal).
**Baseline:** `main` after PR #6; plan.md phases 0–8 complete, phase 9 (polish/perf) and 10 (builds) pending.
**Companion docs:** `weapon_improvement.md` (roster, gunsmith, weapon XP). This file covers everything else.
**Scope:** gameplay, graphics, models/art, map, game settings/modes, and a full scripted campaign.
**Effort key:** S ≈ 1–2 days · M ≈ ~1 week · L ≈ 2–4 weeks · XL ≈ 1–3 months.

Decisions this plan is built on (from the design discussion):

1. **All three tracks, sequenced** — ship-quality polish → content depth → campaign.
2. **Full scripted campaign** — 8 missions, story, characters, VO/text, cutscenes.
3. **Keep the bright low-poly style**, add **time-of-day and weather** for variety.
4. **Online multiplayer is "maybe later"** — so every decision below must be online-proof without being built for online now.

---

## 0. Executive summary

Low Front already has the hard parts: a working 60 Hz fixed-step simulation, a procedural low-poly city, 31 bots with perception/cover/nav, a full Conquest loop, first-person weapon animation, and 212 unit tests plus a headless full-match harness. What it does **not** have is *variety* — one map, one mode, one time of day, no grenades/melee/vault, three settings in the options menu, and no narrative.

This plan adds variety in the cheapest possible order:

| Milestone | Theme | What it unlocks for the player | Effort |
|---|---|---|---|
| **M1** | Ship quality | Runs well, looks good, configurable, installable | 4–6 wk |
| **M2** | Combat texture | Smoke, knife, vault, suppression, better spawns, match setup | 5–6 wk |
| **M3** | World variety | Dawn/dusk/night/rain, wind, decals, interiors, ambience | 4–6 wk |
| **M4** | Campaign foundation | Missions, triggers, checkpoints, cinematics, ally orders | 6–8 wk |
| **M5** | Campaign content | 8 missions, story, characters, VO, set pieces | 10–14 wk |
| **M6** | Breadth | Second map, TDM/Rush, contracts, career | 8–12 wk |

**Total: 37–52 weeks.** Each milestone ends in a shippable state and has an explicit *cut line* (§3), so stopping after any milestone still leaves a coherent game.

**If you only do three things:** M1's graphics/options pass, M2's smoke + spawn fixes, and M3's time-of-day presets. Those three change how the game *feels* more than any single new feature.

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

### 1.2 Missing / weak (the actual opportunity)

| Area | Gap | Player-visible symptom |
|---|---|---|
| Gameplay | No grenades, melee, vault, slide, suppression, resupply, squad spawn | Fights are "aim duel, reload, repeat"; cover is only for peeking |
| AI | 31 solo duellists, no fireteams, no reaction to smoke/suppression, difficulty not exposed | Bots feel samey; no difficulty choice for new players |
| Modes | Conquest only | Nothing to do after the first 10 matches |
| Settings | Sensitivity, FOV, volume only (`SettingsStore`) | Cannot rebind keys, cannot run on weak hardware, no colourblind support |
| Graphics | No tone mapping, no bloom, no AO, no decals, one lighting preset, no wind | Flat, static, "prototype" look; screenshots do not sell the game |
| Audio | Procedural SFX only, no music, no ambience by zone, no VO | Silence between fights; world feels empty |
| Models | One soldier silhouette, blocky hands, no first-person body, few prop variants | 31 clones; screenshots look repetitive |
| Map | One map, no underground, limited rooftop loops, mirrored halves | Predictable after a few hours |
| Campaign | None | No reason to play alone |
| Modes/meta | No match setup, no hardcore, no contracts, no career page | No sense of progression outside weapon XP |

### 1.3 The three constraints every suggestion must respect

1. **Everything is procedural.** No external model/audio files today; keep new content buildable from code, or introduce a clear, small asset pipeline (see §6.6 for textures via canvas).
2. **One artist-programmer.** Any content system must multiply existing work, not add a second workflow. This is why time-of-day presets, map variants and platform conversions rank above new maps.
3. **60 FPS with 32 soldiers on modest hardware.** New features must ship with a measured cost; §5.5 sets the budget.

---

## 2. Online-later guardrails (do these now, they are nearly free)

You may never build multiplayer — but four habits keep the door open without slowing you down:

| Rule | Why | Current state |
|---|---|---|
| **No gameplay logic in `ui/` or `anim/`** | A server must run combat without a DOM or three.js | Already true; keep it that way |
| **Input becomes command objects** (`{move, look, fire, reload}`) rather than reading `Input` inside systems | Commands can arrive from a network later | Partially true (`WeaponInput`); formalise for movement |
| **All randomness seeded per event** (spread, recoil jitter, bot decisions) | Server and client must agree; replays become possible | `BotManager` uses `rand()`; move to a seeded RNG service |
| **Versioned save schema + pure data tables** | Server-side progression and content updates | `lowfront.profile.v1` → add `schema` field now (weapon doc already proposes v2) |

Two existing assets are effectively free multiplayer groundwork: `tests/sim/botMatch.ts` is a **headless match harness** (a dedicated-server skeleton), and bullets already carry their shooter identity. Do not build netcode, lobbies, or interpolation — just do not break these properties.

**Explicit non-goals:** no client-authoritative shooting, no in-match attachment swapping, no host migration, no matchmaking. If online ever happens, it will be a separate project phase.

---

## 3. Roadmap M1–M6 (with cut lines)

### M1 — Ship quality (4–6 weeks)

| Work | Items | Effort |
|---|---|---|
| Performance pass (plan Phase 9) | Prop/vegetation instancing, static merge audit, shadow extent tuning, LOD distances, draw-call budget test in CI | 1–2 wk |
| Rendering baseline | ACES tone mapping + exposure, SMAA/FXAA, bloom, subtle vignette, muzzle-flash light, shadow quality | 1–2 wk |
| Settings layer | Keybinds, graphics presets, resolution scale, audio buses, ADS sensitivity, toggle/hold, invert Y | 1–2 wk |
| Builds (plan Phase 10) | Web production build, Electron wrapper, installer, save paths | 1 wk |

**Gate:** stable 60 FPS in a full 32-soldier match on target hardware; every option persists; clean install → match → quit.
**Cut line:** if short on time, ship tone mapping + keybinds + graphics presets; defer bloom/AO.

### M2 — Combat texture (5–6 weeks)

Smoke grenade, frag grenade, quick knife, vault, crouch-slide, suppression, resupply crates, squad spawn, spawn protection, death-cam + spectate, match-setup screen, hardcore modifier, bot fireteams, spotting, training challenges. (Details §4.)
**Gate:** each feature has a unit or integration test; bot match still ends correctly; no regression in the 5-minute "new player" flow.
**Cut line:** smoke, knife, vault, spawn safety, match setup are the five that matter most.

### M3 — World variety (4–6 weeks)

Time-of-day presets, weather (rain/overcast/dust), wind sway, decals, interior lighting, ambient particles and zone audio, map variants, minimap upgrades. (Details §5, §7.)
**Gate:** each preset at 60 FPS; rain does not tank frame time; campaign can select preset + weather per mission.
**Cut line:** dawn + night + rain presets, wind, decals. Defer overcast/dust.

### M4 — Campaign foundation (6–8 weeks)

Mission data format, trigger volumes, objective state machine, wave director, checkpoint saves, cinematic camera, subtitle/dialogue system, ally squad orders, mission select UI, difficulty presets. (Details §9.4.)
**Gate:** one grey-box mission playable end-to-end with checkpoints and a briefing.
**Cut line:** cut cinematics to letterboxed in-engine camera moves + briefing cards; keep checkpoints.

### M5 — Campaign content (10–14 weeks)

Story bible, 8 missions, 3–5 set pieces, characters, ~150 VO lines (or text-only), difficulty tuning, credits, unlockable mission select. (Details §9.)
**Gate:** full campaign playable in one sitting, no soft locks, save/restore at every checkpoint.
**Cut line:** 8 missions → 5 (First Light, High Ground, Blackout, Tide Line, Last Light).

### M6 — Breadth (8–12 weeks)

Second map (shipyard or desert town), TDM + Rush modes, contracts/daily challenges, career page, local leaderboards, photo mode polish.
**Gate:** two maps and three modes with no mode-specific bugs; load times acceptable.
**Cut line:** ship TDM only, defer the second map.

### Sequencing rationale

M1 before everything (options and performance are prerequisites for a public build). M2 before M3 (smoke/vault change level design needs, which M3's map variants then absorb). M3 before M4 (campaign "locations" are lighting presets + blocked districts, so campaigns become cheap once presets exist). M4/M5 before M6 (a finished campaign is a stronger differentiator than a second map). M6 last because a second map is the most expensive single item and benefits from every system above.

---

## 4. Gameplay systems

### 4.1 Combat additions

| # | Feature | Design | Effort | Implementation hooks |
|---|---|---|---|---|
| 4.1.1 | **Smoke grenade** | Thrown 20 m, blooms in 1.2 s, 8 m radius, 12 s life. Blocks line of sight both ways; bullets pass through. Two per life, 25 s resupply at flags | M | Smoke volumes registered as LOS blockers in `Perception`; radial particle billboards; minimap shows the cloud |
| 4.1.2 | **Frag grenade** | 3.5 s fuse, 6 m lethal / 12 m falloff, bounces off geometry, damages bots and player, cracks the camera | M–L | Rapier dynamic body + sphere cast; reuse falloff math from `Damage.ts`; suppression near-miss rule |
| 4.1.3 | **Quick knife** | 1.6 m reach, 55 damage, 110 from behind, 0.55 s animation, no ammo | S | Raycast on press, new FP clip, kill feed entry |
| 4.1.4 | **Suppression** | Bullets passing within 2 m of a soldier: camera shake + slight desaturation for the player; bots lose 25% aim accuracy and prefer cover for 1.5 s | S–M | Near-miss detection in `Ballistics`; debuff in `BotAim` |
| 4.1.5 | **Ragdoll-lite** | 4-body physics tumble on death (hips, chest, head), settle in 2 s, fade as today | M | Replace scripted fall in `SoldierAnimator`; reuse `PhysicsWorld` |
| 4.1.6 | **Resupply crates** | Ammo + grenades + health at owned flags, 20 s cooldown per crate | S | Zone ownership already tracked in `CaptureZone` |
| 4.1.7 | **Incendiary / flash** (optional) | Area denial and a breaching tool | M each | Same throw path as frag; flash uses a screen-white + bot blindness timer |

**Arc:** smoke first (most tactical value, no damage model needed), then frag, then knife. Do not add both grenade types in the same milestone.

### 4.2 Movement

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.2.1 | **Vault / mantle** | Press jump against an obstacle 0.35–1.2 m high → animated 0.5 s climb using `CharacterMotor` step logic; blocked above 1.2 m | S–M |
| 4.2.2 | **Crouch-slide** | Sprint + crouch → 1.2 s slide, 1.4× sprint speed decaying, camera drops, weapon lowered, 3 s cooldown; cancels reload | S–M |
| 4.2.3 | **Sprint-to-fire penalty** | 0.15 s "settle" before accurate fire after sprinting, shown by the crosshair | S |
| 4.2.4 | **Ladder** (optional) | Only if rooftop connectivity needs it; otherwise ramps/stairs only | M |
| 4.2.5 | **Prone** | **Not recommended.** It breaks the crouch/bipod model, needs new hitboxes, and bots have no prone logic | — |

### 4.3 Teamplay, spawns and flow

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.3.1 | **Spawn safety** | 2 s invulnerability + no firing during it; if an enemy is within 15 m of the spawn point, that point is disabled; "enemy near spawn" warning on the deploy screen | S |
| 4.3.2 | **Squad spawn** | Spawn on any living teammate not in combat for 3 s, 10 m behind them; cuts 20–30 s of running per death | S–M |
| 4.3.3 | **Spawn rooms** | Every flag/HQ spawn gets 2–3 exits so one grenade cannot cover all of them | S (map edit) |
| 4.3.4 | **Spotting (Q)** | Marks the enemy under the crosshair for 6 s to bots and on the minimap; 3 s cooldown | M |
| 4.3.5 | **Timed supply drop** | At 2/3 of the match, a crate spawns at C: ammo, grenades, a temporary weapon. Announced in HUD | S–M |
| 4.3.6 | **Death-cam + spectate** | 1.5 s camera fly to the killer, then deploy screen; optional free spectate of teammates | S–M |

### 4.4 Bots and AI

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.4.1 | **Difficulty exposed in UI** | Easy / Normal / Hard from `data/bots.ts`, plus bot count 8/16/31 and match length 10/25 min | S |
| 4.4.2 | **Fireteams** | Group bots into 3–4 person squads that share last-known enemy positions and move as a unit; 2 fireteams attack, 1 defends, 1 flexes | M |
| 4.4.3 | **Flanking** | When a teammate is already engaging frontally, route around cover to a side angle | M |
| 4.4.4 | **Grenade use** | Bots throw frags at known campers behind cover, with a 15 s cooldown and a shout warning | M |
| 4.4.5 | **Smoke reaction** | Bots do not shoot through smoke; they push or reposition; defenders fall back from a smoked flag | M |
| 4.4.6 | **Suppression reaction** | Under suppression, bots take cover, stop peeking, and call it out | S–M |
| 4.4.7 | **Barks** | Short procedural/textured voice barks ("contact", "reloading", "grenade") with distance falloff — becomes the VO pipeline for the campaign | M |
| 4.4.8 | **Bot loadouts by role** | Shotguns near C, DMRs at range, snipers rare; never give bots snipers until 4.4.9 exists | S |
| 4.4.9 | **Bot sniper cadence** | Bolt-action bots need longer aim settle and a visible glint before firing (readable counterplay) | M |

### 4.5 Modes

| # | Mode | Rules | Reuse | Effort |
|---|---|---|---|---|
| 4.5.1 | **Conquest** (existing) | 5 flags, tickets, bleed | — | done |
| 4.5.2 | **Team Deathmatch** | 75 kills or 10 min, no flags, HQs only | Bot objectives simplify to "hunt" | M |
| 4.5.3 | **Domination** | 3 flags, faster captures, 15 min | `CONQUEST.capture` with different table | S–M |
| 4.5.4 | **Rush** | Two MCOM stations per sector, 3 sectors; attackers have 75 tickets per sector | New destructible objective entity | M |
| 4.5.5 | **Frontline** | Single moving objective; capture pushes the line | Small | M–L |
| 4.5.6 | **Gun Game** | Every 2 kills → next weapon (the 9-weapon roster from the weapon doc) | Weapon switching system | S–M |
| 4.5.7 | **Hardcore** | 2-shot kills, no HUD/regen/minimap/crosshair, 1.5× damage | Settings + damage scale | S |
| 4.5.8 | **Custom match** | Map, mode, bot count, difficulty, length, friendly fire, time of day | New setup screen | S–M |

Ship in M6 order: Hardcore (S) → TDM (M) → Gun Game (S–M) → Domination (S–M) → Rush (M) → Frontline (M–L).

### 4.6 Training and onboarding

| # | Feature | Design | Effort |
|---|---|---|---|
| 4.6.1 | **First-run tutorial** | 6-step scripted range: look, move, sprint/crouch, shoot dummies, reload, capture a zone. Skippable, re-runnable | M |
| 4.6.2 | **Range challenges** | Recoil control drill, 50 m snap shots, timed course, grenade toss; personal bests in localStorage | M |
| 4.6.3 | **Weapon/attachment try-out** | Range allows every weapon and attachment regardless of unlocks | S |
| 4.6.4 | **Loading tips** | Rotating tips with real mechanics ("Smoke blocks bot vision, not bullets") | S |

---

## 5. Visuals and audio

### 5.1 Rendering baseline (M1)

| # | Change | Detail | Effort |
|---|---|---|---|
| 5.1.1 | **ACES tone mapping + exposure** | `gl.toneMapping = ACESFilmicToneMapping`, exposure ~1.0; retune the palette slightly (the current flat look is partly unmanaged colour) | S |
| 5.1.2 | **Anti-aliasing quality** | Keep MSAA on high; add FXAA/SMAA as the "medium" preset so weak GPUs scale | S |
| 5.1.3 | **Bloom + vignette** | Subtle bloom for muzzle flash, sun, tracers; optional vignette; no motion blur by default | S–M |
| 5.1.4 | **Muzzle-flash light** | 40 ms point light at the muzzle (FP and TP), intensity scaled by flash hider/suppressor | S |
| 5.1.5 | **Vertex AO on buildings** | Precompute corner/edge darkening into vertex colours — reads as depth on flat-shaded geometry at zero per-frame cost | M |
| 5.1.6 | **Shadow tuning** | Two cascades (0–20 m sharp, 20–80 m soft) or tighter near extent; keep one sun | M |
| 5.1.7 | **Decal system** | Pooled quads: bullet holes, blood, scorch, footprints. Canvas-generated atlas, per-surface tint | M |
| 5.1.8 | **Instancing** | Cars, buses, containers, trees, barriers, planters as `InstancedMesh`; cut draw calls before adding lights | M |
| 5.1.9 | **Quality presets** | Low / Medium / High / Ultra controlling pixel ratio, shadows, AA, bloom, decal count, view distance | S–M |

### 5.2 Time of day and weather (M3)

One `LIGHTING_PRESETS` table drives sun, hemisphere, sky, fog, ambient audio, interior emissives and gameplay modifiers. That is the single highest-value visual change available, because the same 360 m map becomes five different places.

| Preset | Sun | Sky / fog | Gameplay effect | Use |
|---|---|---|---|---|
| **Dawn** | Low warm, long shadows | Peach → pale blue, thin fog | +10 m bot sight | Campaign opener, map variant |
| **Noon** (current) | High, hard | Blue gradient, minimal fog | Baseline | Default |
| **Dusk** | Orange, low, 8° | Orange/purple gradient, haze | −10 m sight, warm interiors | Map variant |
| **Night** | Moon only, cool | Deep blue, dark fog | −30 m sight, muzzle flash lights the room, tracers prominent | Map variant, campaign |
| **Overcast** | Soft, shadowless | Grey, flat | No shadows (perf win), muffled audio | Map variant |
| **Rain** | Diffuse | Grey + rain streaks | Wet roughness, puddle quads, −20 m sight, louder footsteps | Map variant, campaign |

Weather implementation:

| # | Feature | Detail | Effort |
|---|---|---|---|
| 5.2.1 | **Preset data** | `src/data/lighting.ts` → `PRESETS: Record<PresetId, LightingDef>`; `Lighting` and `Sky` read the active one | S–M |
| 5.2.2 | **Rain** | GPU particle streaks around the camera (10 k points, one draw call), splash sprites on the ground, wet asphalt via roughness map (canvas noise), puddle quads with fake reflection (mirrored sky colour), rain audio bed | M–L |
| 5.2.3 | **Night lighting** | Street lamps + window emissives (instanced planes), a few real point lights near the player only; cheap transparent light cones | M |
| 5.2.4 | **Interior lights** | Enterable plans get emissive ceiling panels; the 8 plans are already data-driven (`plans.ts`) | M |
| 5.2.5 | **Wind** | Vertex shader wobble on trees, banners, tarps, flag cloth; strength per weather preset | S |
| 5.2.6 | **Ambient particles** | Dust motes in sunbeams, birds (simple billboards), distant smoke plumes, rain splash | S–M |

### 5.3 Combat VFX

| # | Feature | Detail | Effort |
|---|---|---|---|
| 5.3.1 | **Muzzle flash upgrade** | Per-weapon flash mesh scale, suppressor removes it, flash lights interiors at night | S |
| 5.3.2 | **Impact upgrades** | Add surface-specific decals + small debris chunks; spark colour by material | S–M |
| 5.3.3 | **Tracer styles** | Bright for ARs, dim for pistol/SMG, none for suppressed | S |
| 5.3.4 | **Shell casing persistence** | Shells stay 10 s in the world (TP) and react to ground material audio | S |
| 5.3.5 | **Blood** | Low-key red puff + decal; toggle in settings for gore level | S |
| 5.3.6 | **Explosion VFX** | Fireball, dust ring, screen shake, debris, smoke column (for frag/set pieces) | M |

### 5.4 Audio

Currently: procedural gunshots, impacts, footsteps, landings, hit ticks, positional bot shots. No music, no ambience, no VO.

| # | Feature | Detail | Effort |
|---|---|---|---|
| 5.4.1 | **Buses** | master → music / SFX / voice / ambience sliders (SettingsStore v2) | S–M |
| 5.4.2 | **Zone ambience** | Loops by area: depot hum + seagulls, plaza crowd murmur, construction clatter, rain on metal. Crossfade on zone change | M |
| 5.4.3 | **Music** | Menu theme, deploy tension loop, last-2-minutes layer, victory/defeat stingers — 5 short loops, procedural or licensed | M |
| 5.4.4 | **Combat mix** | Duck music under gunfire, add a low "suppression" layer, distant battle bed | S–M |
| 5.4.5 | **VO pipeline** | Radio-filtered commander + squadmate lines; subtitles; 150 lines covers campaign + barks | M (system) |
| 5.4.6 | **Audio occlusion** | Simple low-pass when a shooter is behind a wall (raycast + filter), existing distant filter extended | M |

### 5.5 Performance budget

| Metric | Current | M1 target | M3 target |
|---|---|---|---|
| Draw calls (32 bots) | 131–163 | ≤ 140 | ≤ 160 |
| Triangles | ~247 k | ~250 k | ~300 k |
| Frame time (fixed step) | ~1.9 ms bots | < 2.5 ms | < 3 ms |
| GPU frame | software-rendered (unmeasured) | 60 FPS on a GTX 1050-class GPU | 60 FPS with rain/night |
| Particles | minimal | ≤ 2 k | ≤ 12 k (rain) |

Add an automated perf check to the headless harness: run 30 s of a 32-bot match and assert draw calls/triangles under the budget — the repo already has the harness to do it.

---

## 6. Models and art production

### 6.1 Soldiers (biggest visual credibility win)

| # | Feature | Detail | Effort |
|---|---|---|---|
| 6.1.1 | **Cosmetic variety** | 3 body builds × 4 helmet shapes × 3 vest types × 2 backpack types × 4 skin tones; seeded per bot so squads look mixed | M |
| 6.1.2 | **Team identity** | Blue: cool accents + blue helmet band; Red: warm accents + scarf/shemag. Readable at 90 m | S–M |
| 6.1.3 | **Hands and gloves** | Shaped mitts with knuckle blocks and a thumb; 3 glove colours | S–M |
| 6.1.4 | **First-person body** | Torso + legs visible when looking down; sleeves match team colour; legs animate with walk/sprint/crouch/slide | M |
| 6.1.5 | **Gear jiggle** | Vest pouches, backpack and sling sway slightly with acceleration (2-bone spring, reuses `Spring`) | S |
| 6.1.6 | **Death** | Ragdoll-lite (4.1.5) + helmet falls off with physics | M |
| 6.1.7 | **Wounded states** | Limp at low health, arm clutch; cheap animator blend | S–M |

### 6.2 Weapons

Covered in `weapon_improvement.md` (roster, procedural parts, gunsmith). This plan adds:

| # | Feature | Effort |
|---|---|---|
| 6.2.1 | Slings and sling swivels on all primaries | S |
| 6.2.2 | Attachment-ready rails, optic mounts, suppressor collars | S–M |
| 6.2.3 | Camos as material overrides (from the weapon doc) | S |
| 6.2.4 | World-model weapon drops on death (pickup) | S–M |
| 6.2.5 | Unique "campaign" weapon with a worn finish for mission rewards | S |

### 6.3 Props and set dressing

| # | Feature | Detail | Effort |
|---|---|---|---|
| 6.3.1 | **Palette variants** | Every car/bus/container gets 3–4 colourways; the same geometry reads as many objects | S |
| 6.3.2 | **Signage** | Canvas-drawn storefront signs, posters, road signs, graffiti decals — the single cheapest way to make the city feel authored | S–M |
| 6.3.3 | **Vertical clutter** | AC units, cable runs, satellite dishes, water tanks, laundry lines, fire escapes | M |
| 6.3.4 | **Destructibles** | Crates shatter into chunks, sandbags degrade, barrels explode, glass breaks | M–L |
| 6.3.5 | **Pickups** | Ammo box, medkit, grenade, weapon — small readable low-poly models with a slow bob and glow | S–M |
| 6.3.6 | **Set pieces** | Wrecked APC, static helicopter, artillery piece, checkpoint barriers, evacuation tents | M |
| 6.3.7 | **Street life** | Abandoned cars with open doors, scattered luggage, market stalls, cafe chairs | S–M |

### 6.4 Interiors

| # | Feature | Detail | Effort |
|---|---|---|---|
| 6.4.1 | **Per-plan furnishing** | Each of the 8 plans gets a furniture kit: desks, shelves, sofas, counters, filing cabinets, ceiling panels | M–L |
| 6.4.2 | **Interior cover** | Furnished interiors create real cover and sightline breaks — gameplay, not decoration | (part of 6.4.1) |
| 6.4.3 | **Vertical interiors** | Mezzanines/balconies in city hall and the depot hall | M |

### 6.5 Art production rules

- **Silhouette first:** every new model must be identifiable in black at 50 m.
- **One material per object family** where possible; bake colour into vertex colours (the soldier already does this) to keep one draw call.
- **Budget:** soldier ≤ 900 tris near / ≤ 250 far; props ≤ 400 tris; pickup ≤ 80 tris; weapon per `weapon_improvement.md`.
- **No new texture files** until §6.6; use vertex colour + canvas textures.

### 6.6 Small asset pipeline (optional but recommended)

A single `assets/` folder of **generated** canvas textures (signs, posters, graffiti, decal atlas, muzzle flash, rain streak) keeps the "no external models" promise while lifting visual fidelity far more than extra geometry would. Generate at build time or on first run; cache in memory.

---

## 7. Map expansion

### 7.1 The existing map's weaknesses

- Two-dimensional: almost all fights happen at street level.
- Mirrored halves (A↔E, B↔D) are fair but predictable.
- Long straight streets with few breaks — fine for ARs, hostile to snipers and shotguns.
- Interiors are shells: 8 floor plans, little furniture.
- No underground, no rooftop route loop, no chokepoint variety between flags.

### 7.2 Additions (ordered by value per week)

| # | Feature | Detail | Effort |
|---|---|---|---|
| 7.2.1 | **Cover pass** | Break every sightline over 90 m with waist-high cover, planters, vehicles, jersey barriers; add "60 m" mid-lanes | S–M |
| 7.2.2 | **Spawn rooms** | 2–3 exits per spawn, protected by geometry | S |
| 7.2.3 | **Central landmark** | Plaza statue/fountain/clocktower with cover at its base; orientation for new players | S–M |
| 7.2.4 | **Signage & wayfinding** | Colour-coded districts (depot = yellow, apartments = teal…), street names on the minimap | S |
| 7.2.5 | **Rooftop loop** | Stairs to 2–3 connected roofs, drop-downs, one zipline from the office tower to the plaza | M–L |
| 7.2.6 | **Basement / tunnel under C** | 4 m wide service tunnel linking C to A and E, one collapsed section (cover), dim lighting | L |
| 7.2.7 | **More enterable buildings** | 8 → 12 plans (add a clinic, a garage, a corner cafe, a metro entrance) | L |
| 7.2.8 | **Ziplines** | Spline movement, 8 m/s, jump-off allowed; huge fun per line of code | S–M |
| 7.2.9 | **Minimap upgrades** | Last-seen enemies, elevation arrows, north indicator, zoom, building outlines for interiors | S |
| 7.2.10 | **Zone ambience map** | Audio zones matching districts (see 5.4.2) | S–M |

### 7.3 Map variants (cheap content, M3)

| Variant | Change | Effort |
|---|---|---|
| **Dusk patrol** | Dusk preset + 3 blocked routes + different flag start ownership | S |
| **Rain sweep** | Rain preset + puddles + 1 closed street | S–M |
| **Blackout** | Night preset, street lamps off in two districts, muzzle flash becomes a giveaway | S–M |
| **Overcast** | Flat light, no shadows, better perf; good for low-end machines | S |

Variants reuse the entire map; they are the main reason to build lighting presets before a second map.

### 7.4 Second map (M6, XL)

**Shipyard / container port** is the recommended second map: it is built almost entirely from boxes and cylinders (cheap procedural art), it has natural verticality (cranes, stacked containers, ship hulls), and it plays completely differently from the city (long sightlines, narrow corridors between containers, water hazards). Target 280×280 m, 5 flags, 6 enterable structures, one crane you can climb.

---

## 8. Settings, UX and accessibility

### 8.1 Settings expansion

| Group | Settings | Effort |
|---|---|---|
| **Graphics** | Preset (Low/Med/High/Ultra), resolution scale 50–100%, shadow quality, AA mode, bloom toggle, decal density, view distance, FPS cap, VSync | M |
| **Audio** | Master / SFX / music / voice / ambience sliders, hit-marker volume | S–M |
| **Controls** | Full key rebinding, mouse sensitivity, ADS sensitivity multiplier, invert Y, toggle vs hold for ADS/sprint/crouch, slide key | M |
| **Interface** | Crosshair style/colour/size/gap, hit-marker style, HUD scale, minimap size/position, damage numbers on/off | S–M |
| **Gameplay** | Gore level, camera shake amount, auto-reload, auto-sprint, grenade indicator | S–M |

Implementation note: `SettingsStore` currently stores three numbers; expand the interface with per-group objects and migrate `lowfront.settings.v1` → `v2` the same defensive way `ProfileStore` handles profiles.

### 8.2 Accessibility

| # | Feature | Why | Effort |
|---|---|---|---|
| 8.2.1 | **Colourblind team palettes** | Blue/red on bright sand is a known failure case | S–M |
| 8.2.2 | **High-contrast enemy outlines** (optional toggle) | Helps low-vision players and readability at night | S–M |
| 8.2.3 | **Reduced camera shake / flash intensity** | Photosensitivity and motion sickness | S |
| 8.2.4 | **Subtitle size/background + full VO captions** | Needed anyway for the campaign | S–M |
| 8.2.5 | **Toggle instead of hold** for ADS/sprint/crouch | Motor accessibility | S |
| 8.2.6 | **Text scaling and UI contrast** | Readability on 1080p TVs | S |

### 8.3 Meta and UX

| # | Feature | Detail | Effort |
|---|---|---|---|
| 8.3.1 | **Match setup screen** | Mode, map, variant, bot count/difficulty, length, friendly fire | S–M |
| 8.3.2 | **Career page** | Rank, per-weapon levels, KD, accuracy, captures, favourite weapon/map, medals | M |
| 8.3.3 | **Contracts** | 3 date-seeded objectives ("20 headshots", "capture 10 flags"), reward XP + camo | M |
| 8.3.4 | **Multiple profiles + export/import** | Local JSON, shareable | S |
| 8.3.5 | **Local leaderboards** | Per mode/map best score, fastest capture, best KD | S |
| 8.3.6 | **Photo mode** | Pause + free camera + hide HUD + FOV + filters + PNG export | S–M |
| 8.3.7 | **Deploy screen improvements** | Route preview, last death location, "safe spawn" indicator, kit summary | S–M |
| 8.3.8 | **Loading screen** | Map flyover + tip + progress; currently minimal | S |
| 8.3.9 | **Pause menu** | Resume, options, career, controls, quit with confirm | exists; extend |
| 8.3.10 | **Localisation framework** | i18n keys from day one; cheap now, expensive after 500 strings | M |

---

## 9. Campaign (full scripted)

### 9.1 Premise and tone

**Setting:** the fictional Adriatic port city of **Vardan**, 2031. A blockade has cut the city off; the Vardan Civil Council (Blue) holds the port districts, the **Iron Tide** militia (Red) holds the north and the station. A small multinational task force — call sign **Low Front** — is holding the line while civilians evacuate.

**Tone:** grounded, dry, human. No politics, no real nations, no named real conflicts. Radio chatter carries the story; the player is a sergeant, not a superhero.

**Themes:** holding a line you cannot win, the cost of a city, small-unit loyalty.

### 9.2 Story bible (short)

| Element | Detail |
|---|---|
| **Player** | Sgt. Elias "Rook" Vance, 3rd Battalion, Low Front task force. Silent protagonist; speaks only in mission-end lines |
| **Commander** | Lt. Mara Voss — radio voice, calm, increasingly strained as evacuation slips |
| **Squad** | Cpl. "Patch" Okoye (medic, dry humour), Sgt. "Hatch" Rivera (breacher, loud), Pvt. "Sparrow" Lin (rookie, the emotional barometer) |
| **Antagonist** | Colonel Sava "Anvil" Dren, Iron Tide — methodical, patient, wants the port intact |
| **Antagonist 2** | "Moth" — Iron Tide sniper, recurring threat across three missions, resolved in mission 7 |
| **Civilians** | Evacuation convoy, a clinic, a station full of people — the stakes, not a mechanic |
| **Arc** | Hold (1–3) → strike back (4–5) → lose ground (6) → hold the line for evacuation (7) → extraction at dawn (8) |

### 9.3 Mission list (8 missions, ~20–30 min each)

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

**Mission progression:** each mission unlocks the next; all are replayable from a mission-select screen with medals (Bronze/Silver/Gold for time/accuracy/no-death). Campaign progress is separate from multiplayer progression but grants account XP on first completion.

### 9.4 Campaign systems (M4 — build these before content)

| # | System | Design | Effort |
|---|---|---|---|
| 9.4.1 | **Mission data** | `MissionDef` per mission: preset, weather, spawns, loadout whitelist, objective list, trigger list, dialogue, fail conditions | S–M |
| 9.4.2 | **Trigger volumes** | Box/sphere volumes with `onEnter`, `onExit`, `once`; fire dialogue, objectives, spawns, set pieces | M |
| 9.4.3 | **Objective state machine** | Types: `reach`, `clear`, `capture`, `defend(timer)`, `plant`, `escort`, `survive`, `extract`, `kill(target)`. Ordered with optional side objectives | M–L |
| 9.4.4 | **Wave director** | Spawn budget, escalation curve, spawn points out of view, cap on live enemies | M |
| 9.4.5 | **Checkpoints** | Auto-save at objective transitions and key triggers; store mission id, checkpoint, player state, ally state; separate `lowfront.campaign.v1` | M |
| 9.4.6 | **Cinematic camera** | Keyframed camera paths (reuse `Timeline` + `Easing`), letterbox, skip, "hold to skip" | M–L |
| 9.4.7 | **Dialogue system** | Line queue, speaker, subtitle, radio filter, optional VO file, priority/interrupt rules | M |
| 9.4.8 | **Ally squad orders** | 3 allies that follow, hold, assault a marked point; self-heal after 10 s out of combat (no revive) | M–L |
| 9.4.9 | **Scripted events** | Explosions, airdrops, gate breaches, convoy movement, artillery — a small event bus with delays | M |
| 9.4.10 | **Mission UI** | Objectives panel, waypoint markers, "mission failed" reasons, briefing/debriefing cards | M |
| 9.4.11 | **Difficulty** | Recruit / Regular / Veteran: bot accuracy, reaction, health, checkpoint density | S–M |
| 9.4.12 | **Stealth state** | Alarm level per district; suppressed kills do not raise it; detection cones | M–L |

**Build order inside M4:** 9.4.1 → 9.4.2 → 9.4.3 → 9.4.5 → 9.4.10 (grey-box mission 1 playable) → 9.4.7 → 9.4.4 → 9.4.6 → 9.4.8 → 9.4.12 → 9.4.11.

### 9.5 Content production (M5)

| Work | Detail | Effort |
|---|---|---|
| Story bible + scripts | 8 mission scripts, ~60 lines each (~480 total, of which ~150 voiced) | 2–3 wk |
| Mission assembly | Block districts, place triggers, waves, checkpoints, test loops | 5–7 wk |
| Set pieces | 3–5 bespoke moments: convoy ambush, tower collapse, tunnel fight, evacuation | 2–3 wk |
| VO | 2 main voices (Voss, Patch) + 3 minor; ~150 lines; radio-filtered; or text-only fallback | 1–2 wk |
| Difficulty + balance | 3 difficulties, bot tuning per mission | 1–2 wk |
| Polish + QA | Soft-lock hunt, checkpoint validity, audio mix | 2 wk |

### 9.6 Campaign risks and mitigations

| Risk | Mitigation |
|---|---|
| Mission scripting becomes an engine project | Timebox M4 systems to 6–8 weeks; if over, cut cinematics and ally orders, keep triggers/objectives/checkpoints |
| Story scope creep | No cutscene animation beyond camera moves; no facial animation; radio + subtitles only |
| VO cost | Text-first; VO optional and layered in later |
| Same-map fatigue | Lighting/weather presets per mission + blocked districts + interiors; M3 pays for this |
| Difficulty spikes | Playtest each mission on Regular with a stopwatch; target 60–70% completion first try |
| Save corruption | Checkpoint save is atomic and versioned; corrupt → restart mission, never the campaign |

### 9.7 Campaign content reuse matrix

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

Only two new geometry areas (tunnel, rooftop routes) are needed for all eight missions — that is the payoff of building the campaign on the existing map.

---

## 10. Ties to progression (see `weapon_improvement.md`)

- Account rank unlocks weapons and modes; weapon level unlocks attachments.
- Campaign completion grants account XP once per mission plus cosmetic unlocks (a worn-finish weapon and a "Vardan" camo set).
- Contracts provide short-session goals; no currency, no store, no loot boxes.
- Photo mode and camos are the "show off" layer; local leaderboards and medals are the "prove it" layer.

---

## 11. QA and test matrix

| Area | Test | Type |
|---|---|---|
| Movement | Vault heights 0.3 / 0.9 / 1.3 m; slide cancels reload; no clipping through 1.2 m walls | Unit + manual |
| Grenades | Fuse timing, bounce, damage falloff, self-damage, smoke LOS blocking | Unit |
| Suppression | Debuff applies near misses only, expires, does not stack infinitely | Unit |
| Spawns | Never spawn within 15 m of an enemy; protection blocks damage both ways | Integration |
| Bots | Smoke/suppression reactions; fireteam objectives; no stuck > 5 s in a full match | `test:match` |
| Modes | Ticket/score/bleed rules per mode; win conditions; no soft lock at 0 tickets | Unit |
| Lighting | Each preset boots, no NaN fog, night does not break minimap colours | Manual + screenshot |
| Perf | 32 bots, rain, night: draw calls/triangles under budget; frame time budget | Automated harness |
| Campaign | Each mission start→end; every checkpoint restores; no missing dialogue; skip cinematics | Scripted playthrough |
| Saves | v1 → v2 profile/settings migration; corrupt JSON → defaults; campaign checkpoint corruption | Unit |
| Accessibility | Colourblind palettes legible; shake reduction removes flash | Manual |
| Builds | Web + Electron install, quit flow, save paths | Manual |

---

## 12. Effort summary and dependencies

| Milestone | Effort | Depends on | Ships |
|---|---|---|---|
| M1 Ship quality | 4–6 wk | — | Public-ready build |
| M2 Combat texture | 5–6 wk | M1 (options for bindings) | Better fights |
| M3 World variety | 4–6 wk | M2 (map needs after vault/smoke) | 5 looks from 1 map |
| M4 Campaign foundation | 6–8 wk | M3 (presets, interiors) | One grey-box mission |
| M5 Campaign content | 10–14 wk | M4 | 8-mission campaign |
| M6 Breadth | 8–12 wk | M1–M2 | 2 maps, 3+ modes |
| **Total** | **37–52 wk** | | |

Critical path: M1 → M3 → M4 → M5. M2 and M6 can run in parallel with campaign content if you have help, but a solo developer should not parallelise.

---

## 13. Open decisions

1. **Campaign length:** 8 missions (~4–6 h) as proposed, or 5 missions (~2.5 h) to reduce risk?
2. **VO:** text-only first (recommended), or record/generate ~150 lines up front?
3. **Stealth mission:** keep the alarm/stealth system (mission 5) or convert Blackout to a straight night assault?
4. **Second map:** shipyard as proposed, or a desert town (more contrast from the city)?
5. **Modes priority:** TDM first (safe) or Rush first (more distinctive)?
6. **Online:** confirm "maybe later" stays a non-goal — it changes nothing above, but it decides whether to keep the command-object refactor in M1.
7. **Art:** no outlines/toon shading (confirmed keep-style) — revisit only if screenshots underwhelm after M3.

---

## Appendix A — File map (where each system lands)

| System | New / existing files |
|---|---|
| Lighting presets, weather | `src/data/lighting.ts`, `src/render/Lighting.ts`, `src/render/Sky.ts`, new `src/render/Weather.ts` |
| Post-processing | new `src/render/Post.ts`, `Renderer.ts` |
| Decals / VFX | `src/weapons/Effects.ts`, `src/weapons/Impacts.ts`, new `src/render/Decals.ts` |
| Grenades | new `src/weapons/Grenades.ts`, `src/weapons/PlayerWeapons.ts`, `src/data/weapons.ts` |
| Smoke / LOS | new `src/world/Smoke.ts`, `src/ai/Perception.ts`, `src/game/Combat.ts` |
| Vault / slide | `src/entities/PlayerMovement.ts`, `src/physics/CharacterMotor.ts`, `src/anim/fpClips.ts` |
| Match setup / modes | `src/scenes/*`, new `src/data/modes.ts`, `src/game/Scoring.ts` |
| Settings | `src/save/SettingsStore.ts`, `src/data/settings.ts`, `src/ui/match/PauseMenu.ts` |
| Campaign data | new `src/campaign/missions/*.ts`, new `src/campaign/types.ts` |
| Triggers/objectives | new `src/campaign/Triggers.ts`, new `src/campaign/Objectives.ts` |
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

## Appendix C — Cut list (if time runs out)

| Priority | Keep | Defer | Drop |
|---|---|---|---|
| 1 | Dusk + night presets, wind, muzzle light, decals | Overcast, dust | Photo mode |
| 2 | Smoke, knife, vault, spawn safety, match setup, hardcore | Frag, slide, spotting | Resupply crates |
| 3 | Triggers, objectives, checkpoints, 5 missions | Cinematics, ally orders, stealth | Full VO, 8th mission |
| 4 | TDM, career page | Rush, contracts | Second map |

## Appendix D — One-page "if you do nothing else"

1. **M1:** ACES tone mapping + muzzle light + keybinds + graphics presets + performance pass.
2. **M2:** smoke grenade + vault + spawn protection + match setup.
3. **M3:** dusk and night presets + wind + decals.
4. **M4/M5:** 5-mission contract-style campaign with checkpoints on the existing map.

That sequence costs roughly 20–24 weeks and turns Low Front from a solid prototype into a game people will finish and recommend.
