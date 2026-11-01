# PROGRESS.md

## Phase 11 — New weapons, fictional names, team choice, pre-battle countdown (done)

### What was done
- **No real gun names.** Every weapon has a short fictional code, everywhere a player can see it (HUD, kill feed, loadout cards, Deploy Screen, End Screen, viewers):
  - VX-4 (was M4A1), KR-7 (was AK47), P-11 (was M1911);
  - new: SR-9, BR-12, LR-24.
  - Internal ids stay the same, so old saves still work. A test rejects real gun names.
- **Weapon code cleanup (W0):** the animations and effects read the weapon's data (action, pellets, reload type, shell size) instead of checking weapon names, and the weapon card bars use a scale that fits all guns.
- **SR-9 submachine gun:** 800 RPM, 24 → 16 damage, 30+1 rounds, quick aim (0.18 s), full move speed.
- **BR-12 pump shotgun:**
  - 9 pellets of 12 → 5 damage (full damage to 10 m, lowest from 25 m), 6+1 shells;
  - after each shot the left hand works the pump and the empty shell flies out;
  - loads **one shell at a time**: firing stops the reload and keeps the shells already loaded; sprinting or switching also stops it;
  - ghost ring rear sight and a front post.
- **LR-24 bolt-action sniper rifle:**
  - 88 → 70 damage (a headshot kills), 5+1 rounds;
  - the right hand works the bolt after every shot (lift, back, case out, forward, down);
  - **6× scope:** when fully aimed, a scope view replaces the gun (black surround, crosshair) and the mouse turns slower in step with the zoom;
  - slow to aim (0.55 s), very inaccurate from the hip.
- **Bots use the new guns:**
  - picks by weight: rifles most, SR-9 and BR-12 common, LR-24 about 1 bot in 16;
  - shotgun bots push in on enemies and use the pistol at long range; SMG bots also like close fights;
  - sniper bots hold still and crouch, take longer to fire, and fire single precise shots with a pause between them.
- **Join a team:** Deploy on the profile screen now opens "Join a team", with Blue and Red. You take one bot's place on that side (15 bots + you against 16). Your choice is saved and marked "Last played". Everything follows your team:
  - sleeve color, map dots, flag sounds, the HQ on the Deploy Screen, the enemy-HQ warning;
  - the End Screen adds "Victory" or "Defeat: you fought for Red/Blue".
- **20 s countdown before the battle:**
  - a "Battle starts in 20" banner, ticks for the last 3 seconds, then "GO!";
  - you stand still at your spawn point (you can look around) and cannot fire; bots stand at their spawn points too;
  - the clock, tickets and flags start after "GO".
- **No stacked spawns:** each HQ has 32 spawn points (4 rows of 8, all on walkable ground). Spawns skip points where someone stands, including the player.
- The bot match test now also prints kills by weapon and how many bots carry each gun.
- Tests: 272 unit tests (new ones for names, shell reload and pellets, bolt action and scope, bot weapon styles, team save, the countdown and spawns).

### Checked results
- **Bot matches** (`npm run test:match`, seeds 7 and 11): both play to a winner (1153 s and 1174 s), longest stuck 4.0 s, about 2.2 ms per step. Kills by weapon:

  | Seed | VX-4 | KR-7 | SR-9 | BR-12 | LR-24 | P-11 |
  |---|---|---|---|---|---|---|
  | 7 | 270 | 190 | 53 | 21 | 11 | 28 |
  | 11 | 125 | 302 | 72 | 22 | 5 | 54 |

  Per bot, rifles get the most kills: most fights on this map happen around 40 m.
- **Browser (headless Chromium):**
  - each new gun: hip, aimed (SR-9 sights, BR-12 ghost ring, LR-24 scope view), pump and bolt strokes with the case flying out, shell-by-shell reload (2 → 7, one shell at a time);
  - team screen at 1280×720 and phone width;
  - joining Red: 15 red and 16 blue bots, red sleeves, red map dots, the red HQ on the Deploy Screen, "Victory: you fought for Red", Red saved in the profile;
  - countdown on both teams: at the start, every soldier is at least 6 m from the next; walking, sprinting and jumping do nothing; firing does nothing; bots don't move; after "GO" the clock runs, bots move and firing works;
  - no console errors.

### How to test
1. `npm run dev`, open the printed URL. Play vs Bots → pick a new gun → Deploy.
2. "Join a team": pick Red. Check the red sleeves and the countdown banner. During the countdown, try to walk and to shoot: neither works, looking around does.
3. After "GO", play. Try:
   - BR-12: reload with R, then fire part way through the reload;
   - LR-24: hold right mouse for the scope.
4. Die, and check the Deploy Screen shows the red HQ. At the end, the End Screen shows Victory or Defeat for Red.
5. `npm test`, `npm run typecheck`, `npm run build`; `BOT_MATCH_SEEDS=7,11 npm run test:match` (about 5 minutes).

### Fix after review
- **You could still walk during the countdown.** Now you stand still at your spawn point until "GO" (looking around still works).

### Known issues
- On this mid-range map, shotgun and sniper bots score fewer kills than rifle bots (see the table).
- The scope view is a flat overlay: there is no lens zoom distortion and no scope glint for enemies.
- The weapon pack you sent was not used, as you asked.
- The headless test browser runs slowly, so animation screenshots were taken with game time slowed down; in a normal browser at 60 FPS the timing is as designed.

## Fix after Phase 10 review: two rifles after changing the primary (done)

Your report: after switching to another primary weapon, the old and the new rifle showed at the same time.
- **Cause:** a loadout change builds a new first-person rig, and the old rig's cleanup freed its GPU memory but left it in the weapon scene, so the old rifle and arms kept drawing.
- **Fix:** the old rig is now removed from the scene (`FPAnimator.dispose`).
- **Checked:**
  - deploy with the M4A1, die, pick the AK47, deploy: only the AK47 shows, and the weapon scene has the same 7 objects before and after;
  - new test `tests/FPAnimator.test.ts` (fails without the fix); 220 tests pass.

## Phase 10 — Builds + add-ons (done)

### What was done
- **Windows desktop app** (Electron):
  - `npm run pc` runs it.
  - `npm run build:pc` builds the installer `LowFront-Setup-1.0.0.exe`. You choose the install folder, and it adds Start menu and desktop shortcuts.
  - The game is served from `app://game/`, a fixed address inside the app. Your profile and settings are kept in the app's own data folder and survive updates.
  - **On laptops with two graphics chips, the app uses the faster one** (for every player, no Windows setting needed).
  - Starts maximized with no menu bar, and F11 toggles fullscreen. Only one copy runs at a time.
  - **Quit Game closes the app.**
  - The app icon is drawn by `scripts/icon.mjs`.
- **Windows build on GitHub:** the new workflow "Build Windows app" (`.github/workflows/build-pc.yml`) builds the installer on a Windows machine on every push to `main` and to Claude's working branches. Download it from the run's **Artifacts**. The Pages deploy skips downloading Electron.
- **Graphics preset** (Pause Menu → Graphics), applied immediately and saved:
  - High: full resolution, 2048 shadows (the default);
  - Medium: 85% resolution, 1024 shadows;
  - Low: 70% resolution, no sun shadows.
- **Resupply crates**:
  - One crate near each flag. If your team owns the flag, standing at it gives full ammo and full health.
  - Then no crate works for you for 20 s. If nothing is missing, using a crate doesn't start the 20 s wait.
  - The stripe shows the owner's color; your team's crates show on the minimap and large map; you get a "Resupplied" notice and sound.
  - **Bots use them too:** with no enemy in sight and their rifle empty or on its last magazine, they run to the nearest owned crate within 60 m.
- **Web graphics tip:** when the browser runs the game on built-in graphics (Intel UHD/Iris, AMD Radeon/Vega built-in chips, or software rendering), the main menu names the chip and explains how to switch the browser to the graphics card. Close it once with × and it doesn't come back. Not shown in the desktop app.
- Tests: 219 unit tests, including:
  - crate rules (owner, reach, cooldown, refill and heal, nearest crate for bots);
  - the bot resupply state;
  - graphics preset saving and old saves;
  - built-in GPU detection.

### Checked results
- **Desktop app** (Linux build under a virtual display; the Windows build is the same app):
  - it starts on the main menu at `app://game/` with the quit bridge, and without the GPU tip;
  - it plays a match with 31 bots;
  - **Quit Game exits the app (exit code 0)**;
  - the profile name, FOV 90 and the Medium preset survive a restart.
- **Windows installer:** built by GitHub Actions on Windows (103 MB artifact). It can't be built in this Linux container, because the installer step needs Wine.
- **Web production build** (`vite preview`, headless Chromium):
  - three menu → match → End Screen → menu loops;
  - textures, DOM and audio contexts return to the same counts;
  - geometries settle at a small fixed cache of soldier models;
  - no console errors.
- **Graphics preset** at 1280×720:

  | Preset | Render buffer | Draw calls |
  |---|---|---|
  | Low | 896×503 | 99 |
  | Medium | 1088×612 | 131 |
  | High | 1280×720 | 131 |

- **Crates for the player:** health 30 → 100, ammo 2/0 → 31/120, a 20 s cooldown starts, and the notice shows.
- **Full bot matches:**

  | Seed | Bot resupplies | Result | Longest stall |
  |---|---|---|---|
  | 7 | 74 | Red wins on tickets at 17:44 | 4.0 s |
  | 11 | 59 | Red wins on tickets at 16:56 | 4.0 s |

### How to test
1. **Windows app**:
   1. On GitHub, open Actions → "Build Windows app" → the latest run → Artifacts → download `LowFront-Setup-windows`.
   2. Unzip it and run `LowFront-Setup-1.0.0.exe`. Windows may warn that the app is unsigned: choose More info → Run anyway.
   3. Start Low Front from the desktop shortcut. Press F3: the first line should name your **NVIDIA GeForce RTX 3050**.
   4. Play a full match, check your FPS, then press Esc → Quit to Main Menu → Quit Game. The app should close.
   5. Start it again: your name and settings should still be there.
2. **Web**:
   1. Open https://steveruffin5076.github.io/Low-Front/ in Chrome, Edge and Firefox.
   2. In each: play a match, open the Pause Menu, change Graphics, finish or quit the match.
   3. Quit Game on the web closes the tab, or shows "You can close this tab".
3. **Crates**: capture a flag and look for the green crate with the white cross near it. Walk onto it when low on ammo or health.
4. `npm test` (219 tests); `npm run test:match` (about 3 minutes per seed).

### Known issues
- The installer is unsigned, so Windows SmartScreen warns on first run. Signing needs a paid code-signing certificate.
- You can walk through a crate (it has no collision box, so bots never get stuck on it).
- Edge, Firefox, and the real Windows installer were not run here; they are your check.

## Fix after Phase 9 review: your gameplay video (done)

From your 60 s recording on an RTX 3050 laptop (1920×1080, 100% scaling):
- **What F3 showed:** 51–73 FPS with 40 ms spikes. The game's own CPU work was only about 6 ms per frame (2.4–3.9 ms simulation, 2.2–3.4 ms render), so the time goes to the graphics chip. The laptop also has an Intel UHD chip, and browsers often run on it.
- **F3 now shows the graphics chip** in use (for example "NVIDIA GeForce RTX 3050 Laptop GPU" or "Intel(R) UHD Graphics").
- **Shaders are built when the match loads**, hidden effects and the second weapon included, so the first firefight does not stall. All 17 programs exist before play, and fighting, reloading and switching weapons add none.
- **Interiors are slightly brighter:** the sky fill is 0.9 (was 0.8), with a lighter ground color.
- **To use the RTX 3050:**
  1. Open Windows Settings → System → Display → Graphics.
  2. Add your browser (Chrome or Edge), open Options, choose "High performance" (NVIDIA), and restart the browser.
  3. F3 should then show the NVIDIA chip.
  4. Memory was 95% full in the recording; closing other apps should help with the spikes.

## Phase 9 — Polish and Performance (done)

### What was done
- **Measurement**:
  - F3 now also shows CPU time per frame for the simulation (all fixed steps) and for the render call, and how many sounds are playing.
  - With `?debug`, `__game.match.benchmark(20)` in the browser console runs 20 s of the match without rendering and returns ms per fixed step.
  - `npm run test:match` reports ms per step and takes `BOT_MATCH_SEEDS=7,11,23`.
- **Performance** (31 bots in combat): one fixed step went from 2.60 to 1.43 ms in the headless browser.
  - Bots standing still skip the character controller query; nothing can move them on a static map.
  - Lean wall checks only run while leaning; bots never lean.
  - Hitboxes are only re-placed after a new pose. Far soldiers pose at 20 Hz.
  - Other soldiers' sounds beyond hearing range (120 m), or over a 48-voice limit, are dropped instead of building audio nodes.
  - No per-shot or per-decision object creation.
  - Far (LOD) soldiers no longer cast shadows.
  - Not changed: about 0.4 ms per step is Rapier handling the 2,789 static map colliders, even with nothing moving. Merging colliders would change collisions and bullet impacts, so I left it.
- **Visuals** (the "Faceted low-poly" direction you chose; plan §6 palette unchanged):
  - a stronger, warmer sun against a weaker, cooler sky fill, so each flat face reads clearly as lit or in shade;
  - sky and fog tuned to match;
  - the first-person lights move to `src/data/lighting.ts` and gain a cool rim light, so the black rifle shows its edges;
  - a subtle vignette, done as a CSS overlay (strength in `src/data/hud.ts`).
- **Audio**:
  - other soldiers' shots (70%) and steps (85%) sit under your own;
  - flag cues are louder;
  - a compressor/limiter on the master output keeps big firefights from clipping. All levels are in `src/data/audio.ts`.
- **Fixes**:
  - **Match ending while dead:** if the match ended while the Deploy Screen or Pause Menu was open, it stayed on top of the final scoreboard. Now it closes.
  - **Deploy Screen at 1024×600:** the spawn buttons spilled out of their panel; the map now shrinks on short screens.
  - **Kill feed:** it showed through the scoreboard and large map; it now hides while they are open.
  - **GPU memory between matches:** each match left the old sun's shadow map in GPU memory. It is now freed.
  - **Wedged bots:** a bot could get wedged in a small wall corner for up to 5.1 s. Paths from off-nav spots now start with the nearest walkable cell. As a last resort, a bot still stuck after 4 s moves onto the nearest walkable cell (1–5 times per match; the match test reports it).

### Checked results
- `npm run typecheck`, `npm test` (212 tests) and `npm run build` pass.
- `npm run test:match` with 3 seeds:
  - Red won on tickets at 18:26, 16:18 and 15:44;
  - 437–494 kills and 30–42 flag changes;
  - the longest stall was 4.0 s;
  - about 2.0 ms per step in Node, where there is no audio.
- **Headless browser**:
  - three menu → match → End Screen → menu loops return to the same geometry, texture, DOM node and audio-context counts. JS heap: +0.25 MB per match (caches).
  - every screen checked at 1280×720, 1920×1080 and 1024×600;
  - pause freezes the bots; deploying at a flag, and dying to a bot while aiming and reloading, both work;
  - sounds peak at 20 in a firefight (limit 48);
  - no console errors.
  - Before and after screenshots of the same views were compared for the lighting.

### How to test
1. `npm run dev`, play a full match, and press F3:
   - **CPU sim** should stay well under 16 ms with one fixed step per frame;
   - **Draw calls** should stay under 300, and **Triangles** under 500k.
   - Please send me your FPS, the F3 numbers in a big firefight, and your computer (CPU, GPU, browser).
2. Look at the city and your rifle: lit and shaded faces should differ clearly; the rifle shows a light edge along its top.
3. Fight at C: your own gun is the loudest sound; a big firefight should not crackle.
4. Let the match end while you are dead: the scoreboard and End Screen show without the Deploy Screen on top.
5. `npm test`, and `npm run test:match` (about 3 minutes per seed).

### Known issues
- The 60 FPS check needs your hardware. Here software rendering gives 1–3 FPS, so only the CPU side was measured.
- Red still wins every bots-only run (16 against 15). With you on Blue the teams are even.
- The last-resort bot move is a jump of up to 2 m. It happens a few times per match, usually out of your sight.

## Phase 8 — Bot AI (done)

### What was done
- **31 bots**: 15 Blue teammates and 16 Red enemies, named from the plan's list. Each has a random primary (M4A1 or AK47) and the M1911.
  - They use the player's own systems: movement and the Rapier character controller (`PlayerController`), weapons (`PlayerWeapons`: fire rate, magazines, reloads, switching), the shared bullets, and the third-person `Soldier` for looks and hitboxes.
  - They capture flags and count in the match like the player: kills, score, tickets, kill feed.
  - They spawn at HQ, and respawn after 10 s at HQ or the owned flag nearest their objective.
- **Shared combat** (`src/game/Combat.ts`): every bullet carries its shooter and never hits the shooter's own hitboxes. Bullets hit bots or the player (the player now has hitboxes).
  - **No friendly fire**: a bullet that hits a teammate stops but does no damage. The plan does not say; this is the usual rule.
  - Bot kills reach the Deploy Screen ("Killed by Bandit, AK47 · 13 m").
- **Brain** (`src/ai/BotBrain.ts`, pure logic, decisions at 10 Hz, staggered across bots):
  - **Objective**: flags are scored by owner, an enemy capturing one of ours, path distance and teammates already going there, so bots spread out.
  - **Hold**: inside the zone the bot moves between cover points every 4–9 s.
  - **Combat**: when the enemy is farther than 35 m, attackers keep moving to the objective and shoot on the way. Otherwise the bot fights from cover within 8 m for 3–7 s, then moves on. In the open, attackers close in on enemies farther than 20 m, and others strafe.
  - **Reload** behind cover under 30% with no enemy in sight. With the primary empty, the bot switches to the M1911 at close range, or at any range when it has no rounds left.
  - **Retreat** to cover away from the enemy under 30 HP. **Search** the last known position for up to 6 s.
  - **Stuck**: no progress for 2 s, or not getting 1 m away: step aside and repath along cell centers. Stuck twice in a row: pick another objective.
- **Perception** (`src/ai/Perception.ts`): 110° view, 90 m sight range, line of sight under a budget of 20 raycasts per frame (round-robin), and gunshots heard within 60 m. Each bot remembers enemies for 8 s.
- **Aim** (`src/ai/BotAim.ts`):
  - reaction 0.3–0.6 s;
  - an error cone that shrinks while the bot tracks the same target;
  - bursts of 3–6 rounds; a 12% chance per burst to aim at the head;
  - weapon spread and recoil apply, and the bot pulls back 70% of the recoil.
  - Easy, Normal and Hard presets are in `src/data/bots.ts`; Normal is used (no menu for it, as planned).
- **Navigation**:
  - smoothed paths (straight lines checked with a soldier's width);
  - a path queue (3 A* searches per frame), with regions and goal snapping so a search for an unreachable spot stays fast;
  - a cover-point index.
  - Bot capsules do not block each other, so bots never jam a doorway; the player still blocks them and they block the player.
- **Sound**: bot gunshots are positional (the distant filter applies), and bot footsteps play within 30 m.
- **Debug**: F5 with `?debug` shows each bot's name, state and objective, its path in the team color, and a yellow line to the enemy it is shooting at. F3 shows the living bot count.
- The Phase 6 test crowd and `?debug=crowd` are removed.
- **Tests**: 212 unit tests, plus `npm run test:match`. That test plays a whole headless match with 31 bots, real physics, nav and bullets, and takes about 3 minutes.
  - Unit tests cover: objective spread and defending, perception (view, range, reaction, hearing), aim settling, combat → cover → move on, retreat, search timeout, reload rules, path smoothing, no friendly fire, and own hitboxes.

### Checked results
- **Full headless match** (`npm run test:match`, bots only):
  - Red wins on tickets at 15:22;
  - 436 kills, 37 flag changes, about 5,300 reloads;
  - longest time any bot made no progress: 3.6 s (the limit is 5 s).
  - Earlier tuning runs ended 400:0 → Red at 15–19 min, with 33–56 flag changes. Red has 16 bots and Blue 15, and in the game the player makes Blue 16.
- **Headless browser** (software rendering):
  - 31 bots, 131–163 draw calls, up to 247k triangles;
  - all bot work for a fixed step: about 1.9 ms;
  - no console errors.
  - Seen: firefights at C, bots holding B, bot kills in the kill feed, the F5 view, and the Deploy Screen after a bot kills the player.

### How to test
1. `npm run dev`, "Play vs Bots" → "Deploy". Bots spread to the flags; Red pushes from the north.
2. Fight at a flag: bots take cover, reload and retreat when hurt. Watch flags change hands, the kill feed and the scoreboard (Tab).
3. Get killed by a bot: the Deploy Screen shows who killed you, with what, and from how far.
4. Open `/?debug=freemouse`, then press F5 for the bot view and F3 for stats.
5. `npm test` (212 tests). `npm run test:match` for the full match (about 3 minutes).

### Known issues
- Red won every headless bots-only run (16 vs 15). With you on Blue the teams are even; tune `BOTS.objective` in `src/data/bots.ts` if it still feels one-sided.
- Bots don't lean, and they don't climb onto props (cars, crates): an enemy standing on one is searched for from the floor next to it.
- Bots pass through each other.
- FPS with a full match on real hardware, and how the bots feel, are your check: here software rendering gives 1–3 FPS.

## Phase 7 — Conquest Mode (done)

### What was done
- **Rules** (all numbers in `src/data/conquest.ts`, pure logic in `src/game/`, unit tested):
  - 400 tickets per team, −1 per death. A team holding 3–4 flags drains the enemy by 1 ticket every 4 s; all 5 flags, every 2 s.
  - 25-minute limit. A team at 0 tickets loses; at the time limit, more tickets wins; equal is a draw.
  - **Capture** (`CaptureZone.ts`): a 12 m cylinder, 6 m tall. Neutral → owned takes 10 s with one soldier, and owned → neutral another 10 s. Speed scales with attackers minus defenders, up to 3×. Equal numbers: contested, no progress. An empty zone keeps its progress.
  - **Score**: kill 100, headshot +25, capture 200, neutralize 100, defend kill +50 (killing an enemy inside a zone your team owns).
  - **Enemy HQ**: 5 s warning, then death. Respawn delay 10 s.
  - **Spawns**: HQ, or any flag your team owns (6 points each; taken points are skipped).
- **Match session** (`src/scenes/ConquestSession.ts`): Deploy starts a match on the city map, spawning you in Blue HQ.
  - Your deaths cost tickets and go to the Deploy Screen. Falling, the out-of-bounds timer, the enemy HQ and the K test key all count.
  - Flags show the owner's color, and the cloth rises and sinks with capture progress.
  - Short sound cues play when a flag is captured, lost or neutralized.
- **HUD** (`src/ui/hud/`):
  - top center: tickets, timer, and the A–E flag strip with owner color and progress;
  - capture banner ("Capturing C", "Neutralizing C", "Contested", "C secured") with a progress ring;
  - minimap (top left): turns with you, shows flags, teammates and the enemies you can see (in front, within 90 m, in line of sight);
  - weapon, ammo and fire mode (bottom right), health (bottom left), crosshair, hit marker, damage direction, kill feed (right) with a headshot mark;
  - warnings for out of bounds and the enemy HQ.
  - Hold **Tab** for the scoreboard (your row highlighted). Hold **M** for the whole map.
- **Deploy Screen**:
  - shows who killed you, with weapon and distance (or how you died);
  - you pick a spawn on the map or with the buttons (HQ and Blue flags);
  - "Deploy" unlocks after the 10 s countdown;
  - the loadout panel there applies on the next spawn and is saved.
- **Pause Menu** (Esc, or when the mouse is released):
  - Resume; mouse sensitivity; field of view (60–100); master volume; Quit to Main Menu (with confirm).
  - The match pauses while it is open. Settings apply at once and are saved in localStorage.
- **End Screen**: "BLUE WINS" / "RED WINS" / "DRAW", why it ended, final tickets, the top 3 per team, and your score, kills, deaths, headshots and captures. Your saved profile stats (matches, wins, losses, kills, deaths, headshots) are updated. The scoreboard shows for 3 s before it.
- `?debug=` now takes a list, e.g. `?debug=freemouse,crowd`. The Phase 6 soldiers are now `?debug=crowd`:
  - targets you can shoot (kill feed, score, −1 ticket for their team);
  - they never take flags;
  - Blue ones show on the minimap as teammates, Red ones when you can see them.
- Tests (187 in total), including:
  - capture speed (1, 2 and 4 soldiers, 3× cap), contested stop, neutralize then capture, the zone height;
  - bleed rates, death tickets, win by tickets, win on time, draw;
  - all score rules, the enemy HQ timer, spawn options following flag ownership, match summary and profile update, settings store;
  - a full match where the player alone captures all five flags and Red bleeds to 0 → Blue wins.

### Checked results (headless browser, software rendering)
- Standing on flag C: Blue in 10 s of game time; the flag strip, banner and flag cloth follow it.
- A real M4A1 kill on a `?debug=crowd` target shows in the kill feed, gives 100 points and costs Red 1 ticket.
- Entering Red HQ shows "Leave the enemy HQ: 5"; K opens the Deploy Screen after the death camera.
- Deploy unlocks after 10 s and spawns at HQ. Esc pauses the match, and a FOV change is saved.
- Red at 0 tickets → scoreboard → End Screen "BLUE WINS". The saved profile shows 1 match, 1 win and 1 death. Main Menu works.
- 145–151 draw calls and up to 236k triangles with the HUD; no console errors.

### How to test
1. `npm run dev`, "Play vs Bots" → "Deploy". You start in Blue HQ (south).
2. Walk to a flag and stand in the ring: the banner and the flag strip show the capture (10 s for neutral → Blue).
3. Capture all five flags. The Red ticket count then drops by 1 every 2 s until Blue wins and the End Screen shows; this takes about 13 minutes with all flags.
4. Hold Tab (scoreboard) and M (map). Walk into Red HQ (north) for the warning. Press K to die: the Deploy Screen opens; change the loadout, wait 10 s and deploy at HQ or a Blue flag.
5. Press Esc (or release the mouse) for the Pause Menu: change sensitivity, FOV and volume, then Resume.
6. `?debug=crowd` adds the 32 soldiers as targets to test the kill feed, score and minimap dots.
7. `npm test`: 187 tests pass.

### Known issues
- No bots yet (Phase 8), so Red never captures or scores. The scoreboard says so, and the checks for contested flags and for being killed by an enemy are covered by the unit tests only.
- In a real browser, re-locking the mouse right after Esc can be refused for about a second; click the game to lock it again.
- Checked with software rendering only (2–4 FPS here, so game time runs slower than real time).

## Fix after Phase 6 review: rifle iron sights (done)

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

## Phase 6 — Soldiers (done)

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
