# PROGRESS.md

## Phase 0 — Project Setup (done, waiting for review)

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
