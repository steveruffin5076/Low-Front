import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { TestScene } from '../../scenes/TestScene';
import { button, el } from '../dom';

/**
 * Placeholder match: the Phase 0 test scene. The real Conquest match arrives in Phase 7.
 * `load()` must finish before the screen is entered.
 */
export class MatchScreen implements State {
  private root: HTMLElement | null = null;
  private physics: PhysicsWorld | null = null;
  private scene: TestScene | null = null;

  constructor(private readonly ctx: GameContext) {}

  get physicsMs(): number {
    return this.physics?.lastStepMs ?? 0;
  }

  async load(): Promise<void> {
    this.unload();
    this.physics = await PhysicsWorld.create();
    this.scene = new TestScene(this.physics);
  }

  enter(): void {
    this.ctx.input.lockOnClick = true;
    this.scene?.enter();
    this.root = el('div', { class: 'screen match-placeholder' }, [
      el('p', { class: 'hint', text: 'Match placeholder (the real match comes in Phase 7). Press F3 for the debug overlay.' }),
      button('Main Menu', () => this.ctx.changeScreen('mainMenu'), 'btn btn-corner'),
    ]);
    this.ctx.ui.append(this.root);
  }

  exit(): void {
    this.ctx.input.lockOnClick = false;
    this.ctx.input.exitLock();
    this.root?.remove();
    this.root = null;
    this.unload();
  }

  fixedUpdate(dt: number): void {
    this.scene?.fixedUpdate(dt);
  }

  update(dt: number, alpha: number): void {
    this.scene?.update(dt, alpha);
  }

  render(): void {
    if (this.scene) this.ctx.renderer.render(this.scene.scene, this.scene.camera);
  }

  private unload(): void {
    this.scene?.dispose();
    this.physics?.dispose();
    this.scene = null;
    this.physics = null;
  }
}
