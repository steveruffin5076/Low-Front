# PROGRESS.md

## Fix after Phase 6 review: rifle iron sights (done, waiting for review)

Your report: the M4A1 and AK47 sight pictures when aiming did not match the real rifles.
- **M4A1**:
  - The sight line is now 66 mm (2.6 in) above the bore, the standard AR-15/M4 sight height. It was 49 mm.
  - The rear sight is a flip-up sight with a round 5 mm (0.2 in) peep aperture and protective wings. Before, it was a square window.
  - The front post is 1.8 mm (0.07 in) wide, between the front sight base ears, with its tip at the center of the aperture.
  - Sight radius is about 14.8 in; the eye is about 3 in behind the aperture.
- **AK47**:
  - The sight line is now 48.5 mm above the bore (it was 35 mm), and the sight radius is 378 mm (it was 335 mm).
  - A U-notch sits on the tangent leaf's slider. The round front post stands between the two protective ears, with its tip level with the top of the notch.
  - The eye is about 10 in behind the notch, as on the real rifle, so the dust cover shows below the rear sight.
  - The front post was also lying flat and could not be seen. It now stands upright.
- New tests check each rifle's sight height, that the sights line up (just over the sight line is clear, just under it meets the front post), and the sight radius. 170 tests in total.
- How to test: Deploy with each rifle, aim (RMB) at a target, and compare with real sight pictures.

## Phase 6 — Soldiers (done, waiting for review)

### What was done
- **Soldier model** (`src/entities/soldier/SoldierModel.ts`, parts and sizes in `src/data/soldier.ts`): blocky low-poly figure, about 1.83 m tall with the helmet.
  - Parts: head, helmet with brim, eye band, torso, vest with pouches and radio, backpack, belt with a pistol holster, upper and lower arms, gloves, upper and lower legs with thigh pockets and knee pads, boots.
  - Uniform, trousers and helmet in team colors (Blue / Red).
  - Both weapons (third-person models) are part of the soldier: the active one in the hands, the rifle slung across the back or the pistol in the hip holster.
- **One draw call per soldier**: every part and both weapons are rigidly skinned to one skeleton and merged into one mesh with one shared vertex-color material. Geometry is shared between soldiers with the same team and loadout.
- **LOD**: a simplified model (240 triangles, against 744 for the full one) beyond 40 m, bound to the same skeleton; far soldiers animate at 20 updates per second.
- **Procedural rig** (`src/entities/soldier/SoldierRig.ts`): the bones are the pivots. The arms use two-bone IK onto the weapon's grip points, so every weapon is held correctly, and the hands follow the weapon during reloads and switches.
- **Animations** (`src/anim/SoldierAnimator.ts`, pure logic and unit tested), all of plan section 8.2:
  - Locomotion: idle (breathing), walk, run, sprint (rifle lowered across the chest), crouch idle (kneeling), crouch walk, strafe left/right, backpedal. Leg swing follows the move direction, and the gait cycle advances with distance so feet don't slide.
  - Upper body aims: pitch is shared over the spine, chest and neck. Rifles use a bladed stance (left shoulder forward).
  - Fire kick; reload (left hand takes the magazine to a vest pouch and back; the magazine moves with the hand); weapon switch (rifle to the back sling, pistol from the holster, and back).
  - Jump (legs tuck) and fall (legs reach down).
  - Death: falls the way the bullet travelled (backward when shot from the front, sideways from the side), knees buckle, the weapon swings down along the body. The body stays 10 s, then fades out over 1 s.
- **Soldier entity** (`src/entities/soldier/Soldier.ts`): health with regeneration, a body that blocks the player, and 12 hitboxes (head, 3 torso, 4 arm, 4 leg) that follow the bones every fixed step. Crouched soldiers have lower head hitboxes, and dead ones have none. Your bullets use the same damage table and "Last hit" readout as the test range.
- **32-soldier test on the map** (`src/scenes/SoldierCrowd.ts`, settings in `src/data/crowd.ts`), until the Conquest match in Phase 7:
  - 16 Blue soldiers around flags A, B and C, and 16 Red soldiers around D, E and C.
  - Half walk, run, sprint or crouch-walk along nav-grid paths between flags.
  - Half stand at flag spawn points and cycle through idle, fire, crouch, reload, strafe, backpedal, weapon switch, jump and crouched fire.
  - Shot soldiers fall, fade and respawn.
- **Soldier viewer** at `/?debug=soldier`:
  - one soldier on a moving grid (shows foot sliding);
  - a button for every motion and action, and the aim pitch slider;
  - team, rifle and near/far model;
  - front, side and back cameras, and slow motion.
- The Profile & Loadout screen shows the real soldier (idle, holding the chosen rifle). The placeholder soldier is removed.
- Tests (164 in total):
  - model: bones, height, triangle budgets, team colors, skinning;
  - animator: gait, strafe and backpedal, crouch, pitch split, jump, fire, reload, switch, death direction and timing;
  - rig: both hands reach the grips for each rifle in 6 stances, pistol after a switch, muzzle follows pitch, magazine travels;
  - hitboxes with Rapier: head, torso, arm and leg zones, crouched head, dead soldier, hit direction;
  - crowd: 20 s on the real map with every soldier on walkable ground, all walkers moving, and a CPU cost of 0.4 ms per frame on average.

### Checked results (headless browser, software rendering)
| View | Draw calls | Triangles |
|---|---|---|
| Plaza (C) | 139 | 206k |
| Bus Depot (A) | 157 | 222k |
| Apartment Block (B) | 159 | 242k |
| Rail Yard (E) | 146 | 213k |
| All 32 soldiers grouped 12–30 m in front of the camera | 177 | 248k |

Shooting a Red soldier 10 m away with the M4A1: 30.0 damage to the torso and 22.5 to the arm, matching the damage table; it fell backward and faded. No console errors.

### How to test
1. `npm run dev`, then open `http://localhost:5173/?debug=soldier`. Try every motion and action from the Front, Side and Back cameras, both teams, both rifles, and the far model. Use "Slow motion" to check the steps, the reload and the switch.
2. "Play vs Bots" shows the new soldier on the loadout screen.
3. "Deploy": soldiers walk and stand around every flag. Walk around and between them (they block you). Shoot one to see the hit readout, the fall in the hit direction, the 10 s on the ground and the fade.
4. Press F3 and check FPS with soldiers in view; please check FPS ≥ 60 on your machine.
5. `npm test`: 164 tests pass.

### Known issues
- The soldiers are a test crowd: they don't react, shoot back or collide with each other, and walkers glide along their nav paths without physics. Bots come in Phase 8. Friendly soldiers can be shot (team rules come with the match in Phase 7).
- Soldier firing is visual only (weapon kick): no muzzle flash, tracers or sound yet.
- The F3 overlay's "Bots" count stays 0 until bots exist.
- Checked with software rendering only (2–4 FPS here), so the animation feel and the FPS target need a check on real hardware.

## Phase 5 — Urban Map "Verdan District" (done)

### What was done
- **Map data** (`src/data/map/`): 360 × 360 m city, center (0, 0), north = −Z. Point-symmetric: one half is authored and mirrored with (x, z) → (−x, −z) (`mirror.ts`), so both teams get the same streets, blocks, cover and spawns.
  - Streets: Main Avenue (with median planters), Cross Street, side streets at ±70, alleys between blocks, sidewalks raised 0.15 m with curbs.
  - Flags: A Bus Depot (−120, 120), B Apartment Block (120, 120), C City Hall Plaza (0, 0), D Construction Site (−120, −120), E Rail Yard (120, −120). Each has a 12 m capture ring and a pole (capture logic in Phase 7).
  - HQs: Blue at the south end of Main Avenue, Red at the north end, 14 spawn points each. 6 spawn points per flag, 15–30 m from it.
- **8 enterable buildings** built from floor plans (`src/data/map/plans.ts`, `src/world/BuildingBuilder.ts`): depot hall and office (A), apartment with balconies (B), City Hall and a 6-floor office tower with roof access (C), unfinished concrete frame (D), station (E), and a mirrored pair of corner shops. Floors are 3 m; doors, windows, interior walls, switchback stairs (smooth ramp colliders under visual steps), roof stair houses.
- **Solid buildings** with facades (windows, floor ledges, roof edges), **props** for every flag area and the streets (cars, buses, barriers, sandbags, crates, containers, train cars, crane, scaffolding, fountain, trees, …), a **footbridge** over the rails.
- **Collision volumes**: every solid thing is first an oriented box (`src/world/Volume.ts`); the same list makes the Rapier colliders, the nav grid and the cover points, so they always agree. Colliders are tagged by surface for impacts and footsteps.
- **Performance**: static geometry is vertex-colored with one shared material and merged per 60 × 60 m chunk; props are one InstancedMesh per type. Measured with F3: 113–131 draw calls and 198k–232k triangles at all test viewpoints (budget 300 / 500k). Load in the browser: map ~0.6 s, nav grid ~0.16 s, cover points ~0.03 s.
- **Lighting and sky** (`src/render/Lighting.ts`, `src/render/Sky.ts`): sun with a shadow area that follows the player, hemisphere light, gradient sky dome, light fog. Shared by the map and the range.
- **Map edge**: a ring of tall buildings and walls outside ±180, invisible walls at ±191. Leaving ±180 shows "Return to the battlefield: 10" and kills the player when it reaches 0 (`src/game/OutOfBounds.ts`).
- **Navigation** (`src/world/NavGrid.ts`): 1 m grid per floor level, rasterized from the volumes (floor below, room for a 0.3 m radius, 1.75 m soldier; steps up to 0.4 m). Moves through thin walls are blocked. Stair links connect the levels. A* is included for the tests (path smoothing comes with the bots in Phase 8).
- **Cover points** (`src/ai/CoverPoints.ts`): next to props and wall corners, tagged low or high with a facing direction.
- **Game**: Deploy now loads the city and spawns you in Blue HQ. `PlaySession` runs on a `World` interface; the test range is still at `/?debug=range`. The main menu fly-over uses the real map.
- **Map viewer** at `/?debug=map` (whole map, or one building with `&plan=<id>`, X-ray view).
- Tests (123 in total): map data rules (symmetry, bounds, flag positions, spawn distances, spawns not inside volumes), floor-plan geometry, nav grid (stair links, Blue HQ reaches every flag and Red HQ, 3 separate routes between neighboring flags), out-of-bounds timer, and a walk test that drives the real player controller and Rapier along nav paths from Blue HQ through every flag to Red HQ, and up and down every staircase, failing on any stuck spot or hole.

### How to test
1. `npm run dev`, "Play vs Bots" → "Deploy". You start in Blue HQ at the south end of Main Avenue.
2. Walk to each flag (A west-south, B east-south, C center, D west-north, E east-north). Enter the buildings, climb every staircase, go onto the office tower and depot office roofs.
3. Press F4 to show the nav grid (cells per floor level) and cover points (orange low, red high) and stair links (magenta). Press F3 for FPS, draw calls and triangles. Please check FPS (target ≥ 60) on your machine.
4. Walk past the map edge (beyond the last street): the countdown starts; go back to cancel it, or wait 10 s to die and respawn.
5. `/?debug=map` shows the whole map from above (drag to orbit, scroll to zoom); pick a building and use X-ray to see inside. `/?debug=range` opens the old test range.
6. `npm test` — 123 tests pass.

### Known issues
- Flags are visual only; capture, tickets and the Deploy Screen come in Phase 7. Death respawns you in Blue HQ.
- Nav paths go cell to cell and pass wall corners closely; bots will smooth them in Phase 8.
- Checked with software rendering only (2–4 FPS here), so FPS, shadows and the feel of the city need a check on real hardware. With low FPS the game slows down (the fixed step is capped per frame), so the 10 s countdown takes longer in real time.
- Interiors are plain (no furniture yet); the plan does not require it.
- The build still prints the chunk size warning from Phase 0.

## Phase 4 — Shooting and Damage (done)

### What was done
- **Bullets** are projectiles (`src/weapons/Ballistics.ts`): they leave the eye along the aim direction with the weapon's muzzle velocity and gravity; each fixed step the segment from the old to the new position is raycast; max life 2 s; pooled.
- **Damage** (`src/weapons/Damage.ts`): falloff table from plan section 7.1 (near damage up to the falloff start, linear to far damage at the falloff end), head ×2.0, arms and legs ×0.75, torso ×1.0. Distance is the distance the bullet flew.
- **Spread** (`src/weapons/Spread.ts`, `src/data/ballistics.ts`): hip cone per weapon, near zero when aiming; grows when moving, in the air and during long bursts, then recovers. The crosshair gap shows the current cone.
- **Recoil** (`src/weapons/Recoil.ts`, patterns in `src/data/weapons.ts`): camera kick per shot (vertical + per-weapon horizontal pattern + random), recovers after you stop firing; pulling the mouse down counts as recovery. Measured over a 0.8 s burst: M4A1 3.5° up / 0.2° sideways, AK47 4.8° up / 0.8° sideways, M1911 1.4° snap per shot that returns in about 0.15 s.
- **Hitboxes** (`src/entities/Hitboxes.ts`): sensor colliders for head, torso, arms and legs that only bullets see (collision groups in `src/physics/collision.ts`).
- **Health** (`src/entities/Health.ts`): 100 HP, regenerates 10 HP/s after 8 s without damage. **Fall damage** above 4 m: 20 HP per meter above 4 m (`HEALTH` in `src/data/player.ts`).
- **Target dummies** at exactly 10 / 50 / 100 m (staggered sideways so they do not block each other); they fall over when killed and stand up after 3 s.
- **Effects**: muzzle flash and shells (Phase 3), impacts per surface — sparks (metal), dust (concrete, dirt), splinters (wood), red puff (hit) — bullet-hole decals, tracers every 3rd round. All instanced (one draw call per effect type).
- **HUD bits** (test overlay until Phase 7): hit marker (white, red on kill), damage direction indicator, health bar, spread and a "Last hit" line (weapon, target, zone, damage, distance, remaining HP).
- **Audio** (procedural, `src/audio/AudioManager.ts`): gunshot per weapon (different pitch and body) with a filtered distant version, impacts by surface, footsteps by surface (quieter crouched, louder sprinting), landing, hit-marker tick; 3D positioning for world sounds.
- Unit tests: falloff, zone multipliers, spread, recoil, regen, fall damage, bullet drop, fire rate, reload ammo math, and a Rapier-backed bullet test (wall distance, hitbox zones, own capsule ignored). 104 tests.

### Checked results (headless browser, aimed single shots)
| Weapon | 10 m torso / head / limb | 50 m torso / head / limb | 100 m torso / limb |
|---|---|---|---|
| M4A1 | 30.0 / 60.0 / 22.5 | 26.5 / 52.9 / 19.8 | 22.0 / 16.5 |
| AK47 | 36.0 / 72.0 / 27.0 | 30.5 / 60.9 / 22.8 | 26.0 / 19.5 |
| M1911 | 40.0 / 80.0 / 30.0 | 28.0 / 56.0 / 21.0 | (drops ~0.8 m at 100 m) |

### How to test
1. `npm run dev`, "Play vs Bots" → "Deploy". You spawn facing the lane; dummies stand at 10, 50 and 100 m.
2. Aim (RMB) and fire single shots (B for semi) at the torso, head, legs and arms. Read "Last hit" bottom left and compare with the table above.
3. Hold fire with each weapon to feel the recoil; stop and watch the view return.
4. Shoot the cream wall (concrete), dark barrier and ramps (metal), crates (wood) and the ground (dirt) to see the impacts and bullet holes. Every 3rd round is a tracer.
5. Press H to take 20 damage from a random direction (damage indicator, red flash), then wait 8 s for regeneration. Press K to die. Jump off the 3 m platform (no damage) — fall damage needs more than 4 m.
6. `npm test` — 104 tests pass.

### Known issues
- Fixed during this phase: Rapier lets the player capsule sink through a large box collider when standing within about 1 mm of the box center (the spawn point was exactly there). The character motor now lifts the feet back onto the floor; a regression test covers it.
- The range has no platform higher than 3 m, so fall damage can only be seen by falling from more than 4 m in a later map (or from the test checks).
- Hits on the player come only from the H test key until bots shoot back (Phase 8).
- Tracers at rifle speeds cross 100 m in about 7 frames, so they are brief.
- Checked with software rendering only; sound and feel need a check on real hardware.

## Phase 3 — Player Controller and First-Person Animations (done)

### What was done
- **Test range** (`src/data/testRange.ts`, `src/scenes/TestRange.ts`): flat ground, shooting lane with target dummies at 10 / 50 / 100 m and distance posts every 10 m, stairs to a 3 m platform, ramps at 20°, 40° and 50°, crates of 0.3 / 0.5 / 1.0 / 2.0 m, walls and a corner for lean tests. Deploy now opens this range with the saved loadout.
- **Player movement** (section 9): walk 4.5, sprint 6.5 with 6 s stamina (4 s refill), crouch 2.5 (C toggle), ADS 2.8 m/s, weapon speed modifiers, 0.6 m jump, 0.35 m steps, 45° slope limit, lean Q/E (15°, 0.35 m, stops at walls). Rapier kinematic character controller.
- **First-person view**: weapon and arms drawn in their own layer on top of the world (no clipping into walls). Low-poly arms with team-color sleeves and black gloves, solved with two-bone IK to the weapon's grip points.
- **Animations** (all of section 8.1, for all three weapons):
  - Idle breathing, mouse sway, figure-8 walk bob (smaller when aiming or crouched), sprint pose (rifle and pistol differ) with a 0.2 s blend; firing is blocked during sprint and pressing fire ends the sprint.
  - ADS: the sight anchor moves to the screen center; FOV 75 → 55 (rifles) / 65 (pistol).
  - Fire: kick and recovery, muzzle flash, shell ejection with arc and spin, trigger pull. M4A1 bolt carrier cycles in the port and the dust cover opens on the first shot and stays open; AK47 charging handle cycles; M1911 slide cycles and the hammer re-cocks. On the last round the M1911 slide and the M4A1 bolt lock back.
  - Dry fire click on an empty trigger.
  - Tactical reload: magazine out, new magazine from the pouch, seated with a tap; ammo updates at the "magazine seated" moment.
  - Empty reloads: M4A1 left hand presses the bolt release; AK47 right hand reaches over and racks the charging handle; M1911 slide stop is pressed and the slide closes.
  - Reload cancel by sprinting or switching before the magazine is seated.
  - Weapon switch (1 / 2 / mouse wheel): holster 0.35 s (pistol 0.25 s), draw 0.45 s (pistol 0.3 s).
  - Fire mode toggle (B): selector moves with a click. Inspect (I): left side, then right side.
  - Crouch camera over 0.2 s, jump (weapon up) and landing dip, lean roll and shift.
  - Hit reaction (camera shake + red edge flash) and death (camera drops and tilts, then respawn) — on test keys H and K until damage exists.
- Logic kept separate from rendering and unit tested: movement rules and stamina, weapon ammo / fire rate / fire modes / reload math, the weapon action controller (reload seat and cancel, switching, inspect), keyframe timeline, spring and two-bone IK (85 tests in total).
- Small test overlay: crosshair (hidden while aiming), ammo / fire mode / action / stance / speed / stamina readout, key help.

### How to test
1. `npm run dev`, open the URL, "Play vs Bots" → pick a loadout → "Deploy". Click the game to lock the mouse (Esc releases it; "Main Menu" is top left).
2. Movement: walk, sprint until stamina runs out, crouch (C), jump (Space) onto the 0.5 m crate, climb the stairs and the 20° / 40° ramps; the 50° ramp should block you. Lean (Q / E) next to the cream walls.
3. Weapons: fire (hold LMB, B for semi), aim (hold RMB), reload with rounds left and on an empty magazine, switch (1 / 2 / wheel), inspect (I). Try sprinting or switching during a reload.
4. Press H for the hit reaction and K for the death camera.
5. `npm test` — 85 tests pass.

### Known issues
- Damage, hit markers, camera recoil, tracers, impacts and gunshot sounds come in Phase 4 (fire is visual only; the dummies do not react). Only mechanical clicks are played now.
- Hit reaction and death are triggered by test keys (H, K). Death respawns in the range; the Deploy Screen comes in Phase 7.
- Fall height is measured on landing, but fall damage is applied in Phase 4.
- Esc only releases the mouse; the Pause Menu comes in Phase 7.
- Arms and hands are blocky. In a few poses (AK47 rack, inspect) a forearm passes in front of the weapon by design of the motion; please report any pose where an arm cuts through the weapon.
- Checked in a headless browser with software rendering; animation feel, sensitivity and FPS need a check on real hardware.
- Dev-only URL flag `?debug=freemouse` treats the mouse as locked (for automated checks), and any `?debug=` exposes `window.__game`.

## Phase 2 — Weapon Models (done)

### What was done
- `src/weapons/models/ModelKit.ts`: box, cylinder, side-profile and cross-section extrusion, arc helper, and an `Assembly` that merges static parts by material and keeps moving parts as separate named nodes.
- Shared flat-shaded palette materials in `src/render/Materials.ts`.
- M4A1, AK47 and M1911 built in code (`src/weapons/models/`), first-person and third-person versions.
  - Convention: meters, +Y up, muzzle along −Z, +X is the weapon's right side, origin at `rightHandGrip`.
  - Named moving parts and attachment points from plan section 7.2 (`muzzle`, `ejectionPort`, `sightAnchor`, `rightHandGrip`, `leftHandGrip`, `magWell`).

| Weapon | First person | Third person | Length (real) | Moving parts |
|---|---|---|---|---|
| M4A1 | 1,424 tris, 10 meshes | 196 tris | 0.840 m (0.84) | magazine, bolt, chargingHandle, trigger, selector, dustCover, boltRelease |
| AK47 | 820 tris, 7 meshes | 192 tris | 0.882 m (0.88) | magazine, chargingHandle, trigger, selector |
| M1911 | 828 tris, 8 meshes | 108 tris | 0.228 m (0.22) | magazine, slide, hammer, trigger, slideStop |

- Weapon viewer at `/?debug=weapons`: weapon picker, first/third person, auto-rotate, wireframe, attachment point labels, camera presets (Left, Right, Top, Front, Back), drag to orbit and scroll to zoom, triangle and mesh counts, and one button per moving part.
- The loadout weapon cards and the soldier preview use the new models.
- Unit tests check every model for required parts, attachment points, triangle budgets, real length (±5%) and merged static meshes (49 tests in total).

### How to test
1. `npm run dev`, then open `http://localhost:5173/?debug=weapons`.
2. Pick each weapon. Use Left / Right / Top / Front to check the shape from all sides.
3. Press each button under "Moving parts". Left-side parts (M4A1 selector and bolt release, M1911 slide stop) are easiest to see with the Left camera.
4. Toggle "Points" to see the attachment points and "Wireframe" to see the mesh. Switch to "Third person" for the simplified versions.
5. Open the game without `?debug=weapons`, go to "Play vs Bots" and open the weapon slots: the cards and the soldier show the new models.
6. `npm test` — 49 tests pass.

### Known issues
- Part motions in the viewer are simple test motions. The real keyframed animations come in Phase 3.
- The plan's palette colors make the M4A1 nearly all black, so small details (ejection port, forward assist) show mostly through shape and lighting.
- The AK47 tangent rear sight is placed on the rear sight block in front of the receiver, where it is on the real rifle. Plan section 7.2 says "on top of the rear trunnion".
- `sightAnchor` eye distances (0.13 m behind the M4A1 rear sight, 0.33 m behind the M1911 rear sight) are first values; they are tuned with ADS in Phase 3.

## Phase 1 — Menus and Loadout UI (done)

### What was done
- Screen flow: Main Menu → Profile & Loadout → Loading → Match (placeholder) and back. Each screen is a state in `src/ui/screens/`.
- Main Menu: slow fly-over of a placeholder city, title on the left, "Play vs Bots" and "Quit Game".
- Quit flow: "Are you sure?" (Yes / No). Yes calls the Electron bridge when present (Phase 10), otherwise `window.close()`. If the tab stays open, the "Thanks for playing. You can close this tab." screen is shown.
- Profile & Loadout screen:
  - Left: player name (3–16 characters, saved when valid; Deploy is disabled while the name is invalid), "Blue Team", local stats (matches, wins, losses, kills, deaths, K/D, headshots).
  - Center: placeholder soldier holding the selected primary, idle breathing, slow rotation, mouse drag rotates.
  - Right: Primary and Secondary slots. Clicking a slot opens its list of weapon cards (name, 3D preview, Damage / Fire Rate / Range / Accuracy / Mobility bars, magazine size).
  - Bottom: Back, Deploy.
- Profile, stats and loadout are saved in localStorage (`lowfront.profile.v1`). Bad or missing data falls back to defaults.
- Full weapon stat table in `src/data/weapons.ts`. Stat bars are calculated in `src/weapons/WeaponStats.ts`.
- One shared offscreen renderer draws all UI 3D previews (`src/render/PreviewRenderer.ts`).
- Pointer lock is only active in the match.
- Unit tests added for name validation, profile save/load, stat bars and the quit flow (28 tests in total).

### How to test
1. `npm run dev` and open the printed URL.
2. Main Menu: the city fly-over moves slowly. Click "Quit Game" → "No" closes the dialog. Click "Quit Game" → "Yes": the browser usually blocks closing a tab it did not open, so the "Thanks for playing" screen appears. Reload to continue.
3. Click "Play vs Bots". Change the name (try 2 characters: an error shows and Deploy is disabled). Open the Primary slot, pick AK47. Drag the soldier to rotate it.
4. Reload the page and open "Play vs Bots" again: the name and loadout are kept.
5. "Back" returns to the Main Menu. "Deploy" shows the loading screen, then the match placeholder. "Main Menu" (top left) returns.
6. `npm test` — 28 tests pass.

### Known issues
- The soldier is a simple placeholder. The real soldier arrives in Phase 6. (Weapons were replaced in Phase 2.)
- The menu fly-over uses a placeholder city. It switches to the real map in Phase 5.
- The match is the Phase 0 test scene. The "Main Menu" button in it is temporary until the Pause Menu in Phase 7.
- Stats stay at 0 until matches update them in Phase 7.
- Spread and recoil values in `src/data/weapons.ts` are first estimates for the Accuracy bar; they are tuned in Phase 4.

## Phase 0 — Project Setup (done)

### What was done
- Vite + TypeScript (strict) + Three.js + Rapier (`@dimforge/rapier3d-compat`) + Vitest.
- `src/core/`: `EventBus` (typed), `StateMachine` (screens), `Time` (`FixedStepClock`), `GameLoop` (fixed 60 Hz simulation, variable render with interpolation), `Input` (keys, mouse, wheel, Pointer Lock on canvas click), `Game` (boots all systems).
- `src/render/Renderer.ts`, `src/physics/PhysicsWorld.ts` (async WASM init, step timing).
- `src/scenes/TestScene.ts`: ground, static boxes, a physics box that drops every 4 s, slow orbit camera, sun with shadows, hemisphere light, fog.
- `src/ui/DebugOverlay.ts` (F3): FPS, frame time, draw calls, triangles, bot count, physics time.
- Config values in `src/data/engine.ts`, `src/data/palette.ts`, `src/data/testScene.ts`.
- Unit tests in `tests/` for the fixed-step clock, EventBus and StateMachine (14 tests).

### How to test
1. `npm install`
2. `npm test` — all tests pass.
3. `npm run typecheck` — no errors.
4. `npm run dev`, open the printed URL. A test scene shows colored boxes; an orange box drops onto the scene every 4 s.
5. Press F3 to show or hide the debug overlay.
6. Click the canvas to lock the mouse (Esc to release). Mouse look comes in Phase 3.
7. `npm run build` creates `dist/`.

### Known issues
- The production bundle is about 4.9 MB (1.8 MB gzip) because `rapier3d-compat` inlines its WASM as base64. Vite prints a chunk size warning. This can be revisited in Phase 9/10.
- Physics time in the overlay is near 0 ms in this scene because there is only one dynamic body.
