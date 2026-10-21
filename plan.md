# plan.md — Tactical FPS (working title: "Low Front")

Development plan for Claude Code. Build in phases. Finish one phase, run its checks, then stop and wait for user review before the next phase.

---

## 1. Goal and Scope

A tactical first-person shooter in the style of POLYGON (Steam), with distinct, colorful low-poly graphics.

**Version 1 scope (this plan):**
- Main menu: "Play vs Bots", "Quit Game".
- Player profile and weapon selection screen.
- One large urban warfare map for 16 vs 16 (1 player + 31 bots, offline).
- Game mode: Conquest (capture and hold 5 objectives).
- Weapons: Primary M4A1 or AK47. Secondary M1911.
- Full first-person animations for all weapons. Third-person animations for all soldiers.
- All models (map, soldiers, weapons) are built in code from low-poly geometry. No external model files.

**Out of scope for v1:** online multiplayer, other game modes, attachments, grenades, vehicles, melee, unlocks, settings menu beyond the items listed in section 11.

---

## 2. Tech Stack

| Item | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Build tool | Vite |
| 3D rendering | Three.js |
| Physics, character controller, raycasts | Rapier (`@dimforge/rapier3d-compat`) |
| UI (menus, HUD) | HTML + CSS overlay on top of the canvas |
| Audio | Web Audio API (procedural placeholder sounds) |
| Unit tests | Vitest |
| PC build | Electron + electron-builder (Windows .exe), added in the last phase |
| Web build | Static build from `vite build` (Chrome, Edge, Firefox) |

**Performance target:** 60 FPS at 1920x1080 on a mid-range laptop GPU (RTX 3050 4 GB, 16 GB RAM) with 32 soldiers active.

---

## 3. Rules for Claude Code

1. Work on one phase at a time. Do not start the next phase until the user approves.
2. Do not add features that are not in this plan. Write ideas in `IDEAS.md` instead.
3. All tunable numbers (damage, speed, timings, colors, ticket counts) go in `src/data/` config files. No magic numbers in logic code.
4. Keep files under about 400 lines. Split by responsibility.
5. All 3D models are generated in code. Use flat shading and vertex colors or a shared palette material.
6. Keep game logic separate from rendering where possible, so logic can be unit tested.
7. After each phase, update `PROGRESS.md` with: what was done, how to test it, known issues.
8. Make one git commit per completed task with a clear message.
9. If a requirement is unclear, ask the user before building it.

---

## 4. Project Structure

```
/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ plan.md / PROGRESS.md / IDEAS.md
├─ electron/                  # added in Phase 10
└─ src/
   ├─ main.ts                 # entry, boots Game
   ├─ core/                   # Game, GameLoop, Input, Time, EventBus, StateMachine (screens)
   ├─ render/                 # Renderer, Palette, Materials, Lighting, Sky, PostFX
   ├─ physics/                # Rapier world wrapper, collision groups, raycast helpers
   ├─ world/                  # MapLayout data, MapBuilder, BuildingBuilder, PropBuilder, NavGrid
   ├─ entities/               # Soldier, PlayerController, Hitboxes, Health
   ├─ weapons/
   │  ├─ models/              # M4A1Model.ts, AK47Model.ts, M1911Model.ts, ModelKit.ts
   │  ├─ Weapon.ts, Ballistics.ts, Recoil.ts, Spread.ts, Effects.ts (muzzle flash, shells, impacts)
   ├─ anim/                   # Timeline/tween, TwoBoneIK, FPArms, FPAnimator, SoldierAnimator
   ├─ game/                   # ConquestMode, Flag, Team, Tickets, SpawnSystem, MatchStats
   ├─ ai/                     # BotBrain, Perception, Pathfinding (A*), CoverPoints, BotCombat
   ├─ ui/                     # MainMenu, ProfileScreen, LoadoutPanel, HUD, Minimap,
   │                          # Scoreboard, DeployScreen, PauseMenu, EndScreen
   ├─ audio/                  # AudioManager, procedural SFX
   ├─ save/                   # Profile save/load (localStorage)
   └─ data/                   # weapons.ts, conquest.ts, player.ts, bots.ts, palette.ts, map.ts
```

---

## 5. Screen Flow

```
Boot → Main Menu
        ├─ Play vs Bots → Profile & Loadout → [Deploy] → Loading → Match
        │                                  └─ [Back] → Main Menu
        └─ Quit Game → Confirm dialog → Quit

Match → Pause (Esc) → Resume / Quit to Main Menu
Match → Death → Deploy Screen (choose spawn) → Match
Match end → End Screen → Main Menu
```

### 5.1 Main Menu
- Background: slow camera fly-over of the map (low-cost render), game title on the left.
- Buttons: "Play vs Bots", "Quit Game".
- Quit Game: shows "Are you sure?" (Yes / No).
  - Electron build: closes the app.
  - Web build: calls `window.close()`. If the browser blocks it, show a "Thanks for playing. You can close this tab." screen.

### 5.2 Profile & Loadout Screen
**Left panel — Player profile**
- Player name (editable text field, 3–16 characters, saved in localStorage).
- Team: shown as "Blue Team" (player is always Blue in v1).
- Local stats (saved in localStorage): matches played, wins, losses, kills, deaths, K/D ratio, headshots.

**Center — 3D preview**
- The player's soldier model, holding the selected primary weapon, idle animation, slowly rotating. Mouse drag rotates the model.

**Right panel — Weapon selection**
- Two slots: **Primary Weapon** and **Secondary Weapon**.
- Click a slot to open its list. Primary list: M4A1, AK47. Secondary list: M1911.
- Each weapon card shows: name, a 3D preview of the weapon, and stat bars (Damage, Fire Rate, Range, Accuracy, Mobility) plus magazine size.
- Selected loadout is saved in localStorage and restored next time.

**Bottom buttons:** "Back", "Deploy".

---

## 6. Visual Style

- Low-poly, flat-shaded (`flatShading: true`), bright and saturated colors, clean silhouettes. Similar to POLYGON's style.
- Use a shared palette in `src/data/palette.ts`. Example base values:
  - Blue team: `#2F7DE1`, Red team: `#E5483B`
  - Buildings: terracotta `#D9734E`, teal `#2A9D8F`, mustard `#E9C46A`, coral `#F4A261`, mint `#8FD3B6`, cream `#F1E3C8`, slate `#5C6B7A`
  - Road `#3B3F45`, road lines `#F2D14B` / `#FFFFFF`, sidewalk `#B8BCC2`, grass `#6DBE45`
  - Gun metal `#2B2E33`, polymer black `#1E1F22`, AK wood `#A0522D`, M1911 grip wood `#7B4A2A`
- Lighting: one directional sun with shadows (single shadow map, shadow camera follows the player), plus hemisphere light.
- Sky: gradient sky dome. Light distance fog for depth.
- Optional post-processing: subtle vignette only. No heavy effects.

---

## 7. Weapons

### 7.1 Weapon Stats (put in `src/data/weapons.ts`)

| Stat | M4A1 | AK47 | M1911 |
|---|---|---|---|
| Slot | Primary | Primary | Secondary |
| Fire modes | Auto, Semi (toggle B) | Auto, Semi (toggle B) | Semi |
| Fire rate (RPM) | 750 | 600 | 400 max |
| Damage (near → far) | 30 → 22 | 36 → 26 | 40 → 28 |
| Falloff range | 30 m → 75 m | 25 m → 70 m | 15 m → 40 m |
| Headshot multiplier | 2.0 | 2.0 | 2.0 |
| Limb multiplier | 0.75 | 0.75 | 0.75 |
| Magazine | 30 (+1 chamber) | 30 (+1 chamber) | 7 (+1 chamber) |
| Starting reserve ammo | 120 | 120 | 35 |
| Muzzle velocity | 880 m/s | 715 m/s | 250 m/s |
| Reload (tactical / empty) | 2.2 s / 2.9 s | 2.5 s / 3.2 s | 1.6 s / 1.9 s |
| ADS time | 0.25 s | 0.28 s | 0.18 s |
| Recoil | Low vertical, low horizontal | High vertical, medium horizontal | Medium vertical, sharp snap |
| Move speed modifier | 0.95 | 0.93 | 1.0 |

- Bullets are projectiles with velocity and gravity. Each frame, raycast the segment from the last position to the new one. Max lifetime 2 s.
- Spread: small hip-fire cone, near zero when aiming down sights (ADS). Spread grows when moving, jumping, or firing long bursts.
- Recoil: camera kick (pattern per weapon + random horizontal) that recovers over time, plus visual weapon kick.

### 7.2 Weapon Models (built in code)

Build each weapon from parts using `ModelKit.ts` helpers: boxes, cylinders, and `THREE.Shape` + `ExtrudeGeometry` for profiles (stock, grip, magazine curve). Merge static parts by material to reduce draw calls. Keep moving parts as separate named nodes.

Use real-world proportions (scale in meters) so each gun is clearly recognizable. Target 600–1,500 triangles per first-person weapon, and a simplified version (under 300 triangles) for third-person soldiers.

**M4A1** (overall ~0.84 m, barrel ~0.37 m), polymer black and gun metal colors:
- Flat-top upper receiver with Picatinny rail ridges along the top.
- Lower receiver with magazine well, trigger guard, pistol grip angled back, selector lever.
- Forward assist button and ejection port with dust cover on the right side.
- T-shaped charging handle at the rear of the upper.
- Quad-rail handguard, slim barrel, A2-style birdcage flash hider.
- Triangular front sight post, flip-up rear sight.
- Buffer tube with 6-position collapsible stock.
- STANAG magazine with a slight forward curve.

**AK47** (overall ~0.88 m, barrel ~0.42 m), steel and orange-brown wood colors:
- Stamped receiver with ribbed dust cover on top.
- Large safety/selector lever on the right side, charging handle on the right side of the bolt carrier.
- Gas tube above the barrel with wood upper handguard, wood lower handguard.
- Front sight tower near the muzzle, slant muzzle brake.
- Tangent rear sight on top of the rear trunnion.
- Wood fixed stock with a slight drop, wood pistol grip.
- Curved "banana" magazine (build from 4–6 angled segments).

**M1911** (overall ~0.22 m), gun metal slide and frame, brown wood grip panels:
- Slide with rear cocking serrations, barrel bushing at the front.
- Front blade sight and rear notch sight.
- Exposed hammer, grip safety, thumb safety, slide stop lever.
- Trigger and trigger guard.
- Grip with wood panels (raised diamond shape around the screws), magazine base plate visible at the bottom.

**Required named nodes per weapon** (used by animations and effects):

| Node | M4A1 | AK47 | M1911 |
|---|---|---|---|
| `magazine` | yes | yes | yes |
| `bolt` / `chargingHandle` | bolt carrier (visible in ejection port), charging handle | charging handle | — |
| `slide` | — | — | yes |
| `hammer` | — | — | yes |
| `trigger` | yes | yes | yes |
| `selector` | yes | yes | — |
| `dustCover` | yes (flips open on first shot) | — | — |
| `boltRelease` | yes | — | `slideStop` |

**Required attachment points (empty `Object3D`):** `muzzle`, `ejectionPort`, `sightAnchor` (ADS eye position), `rightHandGrip`, `leftHandGrip`, `magWell`.

**Weapon viewer (debug page):** `/?debug=weapons` shows each weapon on a turntable with buttons to play each animation and toggle wireframe. The user reviews visuals here.

---

## 8. First-Person Animations

All first-person animations must play visibly. Build them in code with a small keyframe timeline system (`anim/Timeline.ts`) using position/rotation keys with easing. Arms follow the weapon using two-bone IK (`anim/TwoBoneIK.ts`): the right hand targets `rightHandGrip`, the left hand targets `leftHandGrip` or a keyframed target during reloads.

**First-person arms:** low-poly upper arm, forearm, and hand with simple fingers. Sleeves in team color, black gloves.

### 8.1 Animation List

| Animation | Details |
|---|---|
| Idle | Slow breathing sway. |
| Mouse sway | Weapon lags slightly behind mouse movement. |
| Walk bob | Figure-8 bob synced to footsteps. Smaller bob when ADS or crouched. |
| Sprint | Weapon lowered and canted toward the body, faster bob. Rifle and pistol use different poses. |
| Sprint in/out | 0.2 s blend. Cannot fire during sprint; firing input cancels sprint after the transition. |
| ADS in/out | Weapon moves so `sightAnchor` aligns with the camera center. Camera FOV 75 → 55 (rifles), 75 → 65 (pistol). |
| Fire | Weapon kick back and up, recovery. Muzzle flash (random rotation, 1–2 frames). Shell ejected from `ejectionPort` with physics arc and spin. Trigger pulled. |
| Fire — M4A1 | Bolt carrier moves back and forward in the ejection port. Dust cover opens on the first shot and stays open. |
| Fire — AK47 | Charging handle moves back and forward each shot. |
| Fire — M1911 | Slide moves back ~0.035 m and returns, hammer cocks. On the last round, slide locks back. |
| Empty trigger | Dry-fire click, small trigger movement, no recoil. |
| Tactical reload | Magazine out, new magazine in, small tap. Ammo count updates at the "magazine seated" key. |
| Empty reload — M4A1 | Tactical reload, then left hand presses the bolt release. |
| Empty reload — AK47 | Tactical reload, then right hand reaches over and racks the charging handle. |
| Empty reload — M1911 | Magazine change, then thumb presses the slide stop and the slide closes. |
| Reload cancel | Switching weapons or sprinting cancels the reload if the magazine is not yet seated. |
| Weapon switch | Holster current (0.35 s, pistol 0.25 s), draw next (0.45 s, pistol 0.3 s). |
| Fire mode toggle | Thumb moves the selector, short click sound. |
| Inspect | Key I: weapon turns to show the left side, then the right side. |
| Crouch | Camera lowers smoothly over 0.2 s. |
| Jump / land | Weapon moves up on jump, dips on landing. |
| Lean | Q/E: camera and weapon roll ~15° and shift sideways 0.35 m. |
| Hit reaction | Small camera shake and red edge flash when damaged. |
| Death | Camera drops and tilts to the side, then cuts to the Deploy Screen. |

### 8.2 Third-Person Soldier Animations

Soldiers are blocky low-poly figures (~1.8 m) with head, helmet, torso, vest with pouches, backpack, upper/lower arms, hands, upper/lower legs, boots. Uniform in team color. Each holds a third-person version of its weapon.

Animate with a procedural rig (rotating body part pivots) driven by `SoldierAnimator.ts`:
- Idle, walk, run, sprint, crouch idle, crouch walk, strafe left/right, backpedal.
- Upper body aims toward the look direction (spine and arms follow pitch).
- Fire (weapon kick), reload (left arm to magazine), weapon switch.
- Jump and fall.
- Death: fall in the direction of the hit, then stay on the ground for 10 s, then fade out.

---

## 9. Player

| Item | Value |
|---|---|
| Health | 100 |
| Health regeneration | After 8 s with no damage, regenerate 10 HP/s |
| Walk speed | 4.5 m/s |
| Sprint speed | 6.5 m/s (stamina 6 s, recovers in 4 s) |
| Crouch speed | 2.5 m/s |
| ADS move speed | 2.8 m/s |
| Jump | ~0.6 m height |
| Step height / max slope | 0.35 m / 45° |
| Fall damage | Above 4 m |

**Hitboxes:** head, torso, arms, legs (Rapier sensor colliders attached to body parts). Damage multipliers from section 7.1.

**Controls (PC keyboard and mouse):**

| Action | Key |
|---|---|
| Move | W A S D |
| Look | Mouse |
| Fire / ADS | Left mouse / Right mouse (hold) |
| Sprint | Left Shift |
| Crouch | C (toggle) |
| Jump | Space |
| Lean left / right | Q / E (hold) |
| Reload | R |
| Primary / Secondary | 1 / 2 (mouse wheel also switches) |
| Fire mode | B |
| Inspect | I |
| Scoreboard | Tab (hold) |
| Large map | M (hold) |
| Pause | Esc |

Use the Pointer Lock API. Click the canvas to lock the mouse.

---

## 10. Map: "Verdan District" (Urban Warfare, 16 vs 16)

### 10.1 Size and Layout
- Playable area: 360 m x 360 m. Out-of-bounds zone beyond that with a 10 s warning countdown, then death.
- Map edges are blocked by tall buildings, walls, and fences so the boundary looks natural.
- The layout is defined as data in `src/data/map.ts` (block grid, building list, prop list, flag positions, spawn points). `MapBuilder` builds the map from this data. Do not generate the layout randomly.
- Blue HQ at the south edge, Red HQ at the north edge. The map is point-symmetric for balance: A mirrors E, B mirrors D, C is central.

```
                 NORTH — RED HQ
   ┌──────────────────────────────────────┐
   │  [D] Construction      [E] Rail Yard  │
   │      Site                             │
   │           ║  Main Avenue (N–S)        │
   │ ══════════╬══ [C] City Hall Plaza ═══ │  ← Cross Street (E–W)
   │           ║                           │
   │  [A] Bus Depot     [B] Apartment      │
   │                        Block          │
   └──────────────────────────────────────┘
                 SOUTH — BLUE HQ
```

### 10.2 Objectives

| Flag | Name | Location | Features |
|---|---|---|---|
| A | Bus Depot | South-west | Open garage hall with buses, fuel island, low walls. Mostly close-range cover. |
| B | Apartment Block | South-east | 4-floor enterable apartment with stairwell, balconies, courtyard. Flag in the courtyard. |
| C | City Hall Plaza | Center | Wide plaza with fountain, statue base, sandbag positions, parked cars. City Hall (3 floors, enterable) and a 6-floor office tower with rooftop access overlook it. |
| D | Construction Site | North-west | Unfinished concrete frame building (open floors), scaffolding, crane, pipes, dirt mounds. |
| E | Rail Yard | North-east | Train cars on tracks, shipping containers, small station building, footbridge over the tracks. |

### 10.3 Streets and Cover
- Main Avenue (north–south): 20 m wide, center median with planters.
- Cross Street (east–west): 16 m wide.
- Side streets: 10–12 m wide. Alleys: 3–4 m wide, connecting flags with flanking routes.
- At least 3 routes between each pair of neighboring flags (street, alley, through-building).
- Cover props: colorful low-poly cars, burned cars, buses, jersey barriers, sandbags, crates, dumpsters, shipping containers, rubble piles, bus stops, street lights, trees, planters, scaffolding.

### 10.4 Buildings
- 8 enterable buildings with interiors (floors, interior walls, doors as openings, stairs, window openings). Floor height 3 m.
- All other buildings are solid blocks with low-poly facades (window frames, ledges, roof edges, AC units).
- Building heights 2–6 floors. Facade colors from the palette.

### 10.5 Spawns
- HQ spawn zone per team. Enemies entering the enemy HQ zone get a 5 s warning, then die. HQ cannot be captured.
- Each flag has 6 spawn points placed 15–30 m away from the flag, behind cover.
- Respawn delay: 10 s.

### 10.6 Navigation for Bots
- `NavGrid.ts` builds a 1 m grid per floor level from the map data (walkable / blocked), with stair links between levels.
- Pathfinding: A* on the grid with path smoothing. Precompute at map load.
- `CoverPoints.ts`: generate cover points next to cover props and wall corners at map load.

---

## 11. Conquest Mode

All values go in `src/data/conquest.ts`.

| Rule | Value |
|---|---|
| Teams | Blue (player + 15 bots) vs Red (16 bots) |
| Starting tickets | 400 per team |
| Death | −1 ticket for that team |
| Ticket bleed | A team holding 3 or 4 flags makes the enemy lose 1 ticket every 4 s. Holding all 5: every 2 s. |
| Flags at start | All neutral |
| Capture radius | 12 m (cylinder, 6 m height, so upper floors near a flag do not count unless set per flag) |
| Capture time | Neutral → owned: 10 s with 1 player. Owned → neutral: 10 s. Speed scales with attacker count minus defender count, max 3x. |
| Contested | Equal numbers in the zone: progress stops. |
| Time limit | 25 minutes |
| Win | Enemy tickets reach 0, or more tickets when time runs out. Equal tickets: draw. |
| Score | Kill 100, headshot +25, capture 200, neutralize 100, defend kill in zone +50 |

### 11.1 HUD
- Top center: ticket counts for both teams, match timer, flag strip A–E with owner color and capture progress.
- Top left: minimap (rotating, shows teammates, visible enemies, flags).
- Bottom right: weapon name, ammo in magazine / reserve, fire mode.
- Bottom left: health bar.
- Center: crosshair (hidden during ADS), hit marker (white; red for kill), damage direction indicator.
- Right side: kill feed (killer, weapon, victim, headshot icon).
- Capture banner: "Capturing B", "Contested", progress ring.

### 11.2 Scoreboard (Tab)
Two columns (Blue / Red): name, score, kills, deaths. Player row highlighted.

### 11.3 Deploy Screen (after death)
- Shows killer name, killer weapon, killer distance.
- Map of the battlefield. Player selects a spawn: HQ or any flag owned by Blue.
- Countdown 10 s, then "Deploy" button becomes active.
- Player can change loadout here (same weapon panel as section 5.2). Change takes effect on the next spawn.

### 11.4 Pause Menu (Esc)
- Resume, Mouse sensitivity slider, Field of view slider (60–100), Master volume slider, Quit to Main Menu (with confirm).
- Settings saved in localStorage. The match keeps running (bots do not pause) — **exception:** in v1 offline mode, pause the simulation while the menu is open.

### 11.5 End Screen
- "BLUE WINS" / "RED WINS" / "DRAW", final tickets, top 3 players per team, player's own stats (score, kills, deaths, headshots, captures).
- Update the player's saved profile stats. Button: "Main Menu".

---

## 12. Bot AI

Each bot is a `Soldier` driven by `BotBrain` instead of `PlayerController`. Bots use the same movement, weapons, and hitboxes as the player.

**Loadout:** each bot picks a random primary (M4A1 or AK47) and carries an M1911. Bot names come from a fixed list in `src/data/bots.ts`.

**State machine:**

| State | Behavior |
|---|---|
| Choose objective | Score each flag by: not owned (+), being captured by enemy (+ for defenders), distance (−), number of teammates already going there (−). Keep a spread across flags. |
| Move | Follow A* path, sprint when no enemy is known, walk when near an objective or enemy. |
| Capture / Defend | Stay inside the zone, move between cover points inside it, look toward likely enemy approaches. |
| Combat | When an enemy is seen: stop sprinting, take cover if a cover point is within 8 m, crouch or strafe, fire in bursts. |
| Reload | Reload behind cover when magazine is under 30% and no enemy is visible. Switch to M1911 if primary is empty during combat at close range. |
| Retreat | Under 30 HP with visible enemies: move to the nearest cover away from the enemy. |
| Search | Move toward the last known enemy position for up to 6 s, then return to objective. |

**Perception:**
- Field of view 110°, sight range 90 m (less at night/fog — not in v1). Line-of-sight raycast against the world.
- Hearing: gunshots within 60 m alert bots to the shooter's direction.
- Reaction time: 0.3–0.6 s before first shot after seeing a target.

**Aim:** aim error cone that shrinks while the bot keeps tracking the same target. Aim at torso, with a small chance to aim at the head. Recoil applies to bots too.

**Difficulty:** one global value in `src/data/bots.ts` (Easy / Normal / Hard) that sets reaction time, aim error, and burst length. Default: Normal. No UI for it in v1.

**Performance:** update bot decisions at 10 Hz, staggered across frames. Perception raycasts limited per frame (budget, e.g. 20 raycasts per frame). Movement and animation run every frame.

---

## 13. Audio (placeholder)

Procedural sounds with the Web Audio API in `audio/`:
- Gunshots per weapon (different pitch and body for M4A1, AK47, M1911), distant gunshot version (filtered).
- Reload clicks (mag out, mag in, bolt, slide), dry fire, fire mode click.
- Footsteps (surface: concrete, dirt, metal), landing, bullet impacts, hit marker tick.
- Flag captured / lost cues.

3D positional audio for other soldiers' shots and footsteps. All sounds go through one `AudioManager` so they can be replaced with real sound files later.

---

## 14. Performance Rules

- Merge static map geometry by material and by map chunk (e.g. 60 m x 60 m chunks) for frustum culling.
- Use `InstancedMesh` for repeated props (barriers, crates, street lights, trees, sandbags).
- Soldier LOD: full model under 40 m, simplified model beyond.
- One shadow-casting directional light. Shadow map 2048, covers ~80 m around the player.
- Object pools for bullets, shells, impact effects, muzzle flashes.
- Draw calls under 300, triangles on screen under 500k.
- Debug overlay (`F3`): FPS, frame time, draw calls, triangles, bot count, physics time.

---

## 15. Development Phases

Each phase lists its tasks and the checks the user will run. Stop after each phase.

### Phase 0 — Project Setup
- Vite + TypeScript + Three.js + Rapier + Vitest.
- Game loop with fixed physics step (60 Hz) and variable render.
- Screen state machine, EventBus, Input (with pointer lock), debug overlay (F3).
- **Check:** `npm run dev` opens a page with a test scene and FPS overlay. `npm test` passes.

### Phase 1 — Menus and Loadout UI
- Main Menu, Quit flow, Profile & Loadout screen (section 5), save/load profile and loadout.
- 3D preview area with placeholder models.
- **Check:** all buttons work, name and loadout persist after page reload, Quit flow works.

### Phase 2 — Weapon Models
- `ModelKit.ts`, M4A1, AK47, M1911 models with all named nodes and attachment points (section 7.2).
- Third-person simplified versions.
- Weapon viewer debug page `/?debug=weapons`.
- Use the real models in the loadout screen previews.
- **Check:** each weapon is recognizable as the real gun from all sides. Moving parts move when tested in the viewer.

### Phase 3 — Player Controller and First-Person Animations
- Test range scene (flat ground, walls, stairs, ramps, crates, target dummies).
- Player movement (section 9), crouch, jump, lean, sprint with stamina.
- First-person arms with two-bone IK.
- All first-person animations in section 8.1 (fire animations without damage yet).
- **Check:** every animation in the table plays correctly for all 3 weapons. No clipping of arms through the weapon.

### Phase 4 — Shooting and Damage
- Ballistics, spread, recoil, damage falloff, hitboxes, health, regen.
- Muzzle flash, shell ejection, bullet impacts (spark/dust per surface), tracers (every 3rd round).
- Hit marker, damage indicator, procedural audio.
- Unit tests: damage falloff, headshot/limb multipliers, fire rate timing, reload ammo math.
- **Check:** shoot target dummies at 10/50/100 m; damage values match the table. Recoil feels different per weapon.

### Phase 5 — Urban Map
- Map data, MapBuilder, buildings (8 enterable), props, streets, flags, spawn areas, map boundaries.
- Collision for all geometry. NavGrid and cover point generation (with a debug view toggle).
- Performance work from section 14 for static geometry.
- **Check:** walk the full map; no holes, no stuck spots; all stairs work; FPS ≥ 60 on target hardware with no bots.

### Phase 6 — Soldiers
- Soldier model (both teams), procedural rig, third-person animations (section 8.2), LOD.
- Spawn 32 static/animated soldiers on the map for a performance test.
- **Check:** animations look correct while walking around them. FPS ≥ 60 with 32 soldiers.

### Phase 7 — Conquest Mode
- Flags, capture logic, tickets and bleed, spawn system, Deploy Screen, HUD, minimap, scoreboard, kill feed, pause menu, End Screen, profile stat updates.
- Unit tests: capture speed and contest rules, ticket bleed, win conditions.
- **Check:** full match flow works with the player alone (capture all flags, win by bleed).

### Phase 8 — Bot AI
- BotBrain, perception, pathfinding, cover use, combat, objective selection (section 12).
- 31 bots in a full match.
- **Check:** bots spread across flags, capture and defend, fight, use cover, reload, and a full match ends with a winner. No bots stuck for more than 5 s.

### Phase 9 — Polish and Performance
- Performance pass to meet section 14 targets during a full 32-soldier match.
- Visual polish (lighting, colors, fog), audio balance, UI polish.
- Bug fixing from the user's test reports.
- **Check:** full 25-minute match at stable 60 FPS on target hardware, no console errors.

### Phase 10 — Builds
- Web production build (`npm run build`), test in Chrome, Edge, Firefox.
- Electron wrapper and Windows installer via electron-builder (`npm run build:pc`). Quit Game closes the app.
- **Check:** both builds run a full match; Quit Game works in both.

---

## 16. Definition of Done for v1
- Main menu → Profile & Loadout → full Conquest match vs 31 bots → End Screen → Main Menu works without errors.
- All 3 weapons look close to the real guns in low-poly style and all first-person animations in section 8.1 play.
- Map supports 16 vs 16 with 5 flags and meets the 60 FPS target.
- Web build and Windows PC build both work.
