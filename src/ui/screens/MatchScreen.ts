import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { RangeSession } from '../../scenes/RangeSession';
import { button, el } from '../dom';

/**
 * Match screen. Until the Conquest match arrives (Phase 7) it hosts the test range.
 * `load()` must finish before the screen is entered.
 */
export class MatchScreen implements State {
  private root: HTMLElement | null = null;
  private physics: PhysicsWorld | null = null;
  private session: RangeSession | null = null;

  constructor(private readonly ctx: GameContext) {}

  get physicsMs(): number {
    return this.physics?.lastStepMs ?? 0;
  }

  async load(): Promise<void> {
    this.unload();
    this.physics = await PhysicsWorld.create();
    this.session = new RangeSession(this.physics, this.ctx.input, this.ctx.profiles.load().loadout);
  }

  enter(): void {
    this.ctx.input.lockOnClick = true;
    this.root = el('div', { class: 'screen match-screen' }, [
      button('Main Menu', () => this.ctx.changeScreen('mainMenu'), 'btn btn-corner'),
    ]);
    this.ctx.ui.append(this.root);
    this.session?.mount(this.root);
  }

  exit(): void {
    this.ctx.input.lockOnClick = false;
    this.ctx.input.exitLock();
    this.root?.remove();
    this.root = null;
    this.unload();
  }

  fixedUpdate(dt: number): void {
    if (!this.session || !this.physics) return;
    this.session.fixedUpdate(dt);
    this.physics.step();
  }

  update(dt: number, alpha: number): void {
    this.session?.update(dt, alpha);
  }

  render(): void {
    this.session?.render(this.ctx.renderer);
  }

  private unload(): void {
    this.session?.dispose();
    this.physics?.dispose();
    this.session = null;
    this.physics = null;
  }
}
