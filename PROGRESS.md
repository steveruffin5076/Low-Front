# PROGRESS.md

## Phase 1 — Menus and Loadout UI (done, waiting for review)

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
- The soldier and weapons are simple placeholder boxes. Real weapon models arrive in Phase 2, the real soldier in Phase 6.
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
