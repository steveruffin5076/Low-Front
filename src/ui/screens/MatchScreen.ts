import { debugFlag } from '../../core/debugFlags';
import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import { CONQUEST } from '../../data/conquest';
import { ENGINE } from '../../data/engine';
import { summarize } from '../../game/MatchSummary';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { applyMatch } from '../../save/ProfileStore';
import { CityMap } from '../../scenes/CityMap';
import { ConquestSession, PLAYER_ID } from '../../scenes/ConquestSession';
import { PlaySession } from '../../scenes/PlaySession';
import { TestRange } from '../../scenes/TestRange';
import { button, el } from '../dom';
import { DeployScreen } from '../match/DeployScreen';
import { PauseMenu } from '../match/PauseMenu';

/**
 * Match screen: a Conquest match on the city map (plan section 11) with the Deploy Screen,
 * Pause Menu and the move to the End Screen. `/?debug=range` loads the test range instead.
 * `load()` must finish before entering.
 */
export class MatchScreen implements State {
  private root: HTMLElement | null = null;
  private physics: PhysicsWorld | null = null;
  /** Exactly one of these is set while loaded. */
  private range: PlaySession | null = null;
  private conquest: ConquestSession | null = null;
  private pauseMenu: PauseMenu | null = null;
  private deployScreen: DeployScreen | null = null;
  /** Counts down from the match result to the End Screen; −1 while playing. */
  private endTimer = -1;

  constructor(private readonly ctx: GameContext) {}

  get physicsMs(): number {
    return this.physics?.lastStepMs ?? 0;
  }

  /**
   * Debug benchmark (`?debug`, from the console: `__game.match.benchmark(20)`): runs `seconds`
   * of match time as fast as possible, without rendering, and returns CPU ms per fixed step.
   */
  benchmark(seconds: number): number {
    const c = this.conquest;
    if (!c || !this.physics) return 0;
    const steps = Math.round(seconds * ENGINE.fixedHz);
    const t = performance.now();
    for (let i = 0; i < steps; i++) {
      c.fixedUpdate(1 / ENGINE.fixedHz);
      this.physics.step();
    }
    return (performance.now() - t) / steps;
  }

  /** Living bots, for the F3 overlay. */
  get botCount(): number {
    return this.conquest?.bots.bots.filter((b) => b.alive).length ?? 0;
  }

  /** The play session (the player, weapons, camera), for tests and tools. */
  get session(): PlaySession | null {
    return this.range ?? this.conquest?.session ?? null;
  }

  async load(): Promise<void> {
    this.unload();
    this.physics = await PhysicsWorld.create();
    const profile = this.ctx.profiles.load();
    if (debugFlag('range')) {
      this.range = new PlaySession(this.physics, this.ctx.input, profile.loadout, new TestRange(this.physics));
      return;
    }
    const c = new ConquestSession(this.physics, this.ctx.input, profile.name, profile.loadout, new CityMap(this.physics));
    c.applySettings(this.ctx.settings.load());
    c.callbacks.onEnded = () => {
      // The match can end while the Deploy Screen or Pause Menu is open: the final scoreboard takes over.
      this.closeOverlays();
      this.endTimer = CONQUEST.endScreenDelay;
    };
    this.conquest = c;
  }

  enter(): void {
    const input = this.ctx.input;
    input.lockOnClick = true;
    // Esc or Alt+Tab while playing pauses; releasing the mouse for the Deploy Screen does not.
    input.onLockLost = () => {
      if (this.conquest?.state === 'alive' && !this.deployScreen) this.openPause();
    };
    // The test range keeps its corner button; the match quits from the Pause Menu.
    this.root = el('div', { class: 'screen match-screen' }, this.range ? [button('Main Menu', () => this.ctx.changeScreen('mainMenu'), 'btn btn-corner')] : []);
    this.ctx.ui.append(this.root);
    (this.range ?? this.conquest)?.mount(this.root);
  }

  exit(): void {
    const input = this.ctx.input;
    input.onLockLost = null;
    input.lockOnClick = false;
    input.exitLock();
    this.closeOverlays();
    this.root?.remove();
    this.root = null;
    this.unload();
  }

  fixedUpdate(dt: number): void {
    if (!this.physics || this.conquest?.paused) return;
    this.range?.fixedUpdate(dt);
    this.conquest?.fixedUpdate(dt);
    this.physics.step();
  }

  update(dt: number, alpha: number): void {
    this.range?.update(dt, alpha);
    const c = this.conquest;
    if (!c) return;
    if (this.ctx.input.wasPressed('Escape')) {
      if (this.pauseMenu) this.closePause();
      else this.openPause();
    }
    c.update(dt, alpha);
    if (c.state === 'dead' && !this.deployScreen && c.deadTime >= CONQUEST.deployScreenDelay) this.openDeploy();
    if (!this.pauseMenu) this.deployScreen?.update(dt);
    if (this.endTimer >= 0 && (this.endTimer -= dt) <= 0) this.finish();
  }

  render(): void {
    (this.range ?? this.conquest)?.render(this.ctx.renderer);
    this.deployScreen?.draw(this.ctx.preview);
  }

  private openPause(): void {
    const c = this.conquest;
    if (!c || !this.root || this.pauseMenu || c.state === 'ended') return;
    c.paused = true;
    const input = this.ctx.input;
    input.lockOnClick = false;
    input.exitLock();
    this.pauseMenu = new PauseMenu(
      this.ctx.settings.load(),
      (s) => {
        this.ctx.settings.save(s);
        c.applySettings(s);
      },
      () => this.closePause(),
      () => this.ctx.changeScreen('mainMenu'),
    );
    this.root.append(this.pauseMenu.element);
  }

  private closePause(): void {
    if (!this.pauseMenu || !this.conquest) return;
    this.pauseMenu.element.remove();
    this.pauseMenu = null;
    this.conquest.paused = false;
    if (!this.deployScreen) this.relock();
  }

  private openDeploy(): void {
    const c = this.conquest;
    if (!c || !this.root) return;
    const input = this.ctx.input;
    input.lockOnClick = false;
    input.exitLock();
    this.deployScreen = new DeployScreen(
      c,
      this.ctx.profiles.load().loadout,
      (loadout) => {
        const profile = this.ctx.profiles.load();
        profile.loadout = loadout;
        this.ctx.profiles.save(profile);
      },
      (choice, loadout) => {
        c.deploy(choice, loadout);
        this.deployScreen?.dispose();
        this.deployScreen = null;
        this.relock();
      },
    );
    this.root.append(this.deployScreen.element);
  }

  private relock(): void {
    const input = this.ctx.input;
    input.lockOnClick = true;
    input.requestLock();
  }

  /** Match over: save the player's stats, then show the End Screen. */
  private finish(): void {
    const c = this.conquest;
    const result = c?.match.result;
    if (!c || !result) return;
    const summary = summarize(c.match, result, PLAYER_ID);
    const profile = this.ctx.profiles.load();
    const p = summary.player;
    profile.stats = applyMatch(profile.stats, {
      won: result.winner === null ? null : result.winner === p.team,
      kills: p.kills,
      deaths: p.deaths,
      headshots: p.headshots,
    });
    this.ctx.profiles.save(profile);
    this.ctx.lastMatch = summary;
    this.ctx.changeScreen('end');
  }

  private closeOverlays(): void {
    this.pauseMenu?.element.remove();
    this.pauseMenu = null;
    this.deployScreen?.dispose();
    this.deployScreen = null;
    this.endTimer = -1;
  }

  private unload(): void {
    this.range?.dispose();
    this.conquest?.dispose();
    this.physics?.dispose();
    this.range = null;
    this.conquest = null;
    this.physics = null;
  }
}
