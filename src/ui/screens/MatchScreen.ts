import { debugFlag } from '../../core/debugFlags';
import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { CityMap } from '../../scenes/CityMap';
import { ConquestSession } from '../../scenes/ConquestSession';
import { PlaySession } from '../../scenes/PlaySession';
import { TestRange } from '../../scenes/TestRange';
import { button, el } from '../dom';

/**
 * Match screen: a Conquest match on the city map (plan section 11). `/?debug=range` loads the
 * test range instead. `load()` must finish before entering.
 */
export class MatchScreen implements State {
  private root: HTMLElement | null = null;
  private physics: PhysicsWorld | null = null;
  /** Exactly one of these is set while loaded. */
  private range: PlaySession | null = null;
  private conquest: ConquestSession | null = null;

  constructor(private readonly ctx: GameContext) {}

  get physicsMs(): number {
    return this.physics?.lastStepMs ?? 0;
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
    } else {
      this.conquest = new ConquestSession(this.physics, this.ctx.input, profile.name, profile.loadout, new CityMap(this.physics));
    }
  }

  enter(): void {
    this.ctx.input.lockOnClick = true;
    this.root = el('div', { class: 'screen match-screen' }, [
      button('Main Menu', () => this.ctx.changeScreen('mainMenu'), 'btn btn-corner'),
    ]);
    this.ctx.ui.append(this.root);
    (this.range ?? this.conquest)?.mount(this.root);
  }

  exit(): void {
    this.ctx.input.lockOnClick = false;
    this.ctx.input.exitLock();
    this.root?.remove();
    this.root = null;
    this.unload();
  }

  fixedUpdate(dt: number): void {
    if (!this.physics) return;
    if (this.conquest?.paused) return;
    this.range?.fixedUpdate(dt);
    this.conquest?.fixedUpdate(dt);
    this.physics.step();
  }

  update(dt: number, alpha: number): void {
    this.range?.update(dt, alpha);
    const c = this.conquest;
    if (c) {
      c.update(dt, alpha);
      // Until the Deploy Screen: back to HQ when the respawn delay is over.
      if (c.state === 'dead' && c.respawnWait === 0 && c.session.deathFinished) c.deploy({ kind: 'hq' });
    }
  }

  render(): void {
    (this.range ?? this.conquest)?.render(this.ctx.renderer);
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
