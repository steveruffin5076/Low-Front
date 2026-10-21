# PROGRESS.md

## Phase 4 — Shooting and Damage (done, waiting for review)

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
