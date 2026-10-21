import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import { StateMachine } from './StateMachine';
import { Renderer } from '../render/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { DebugOverlay } from '../ui/DebugOverlay';
import { TestScene } from '../scenes/TestScene';

export type ScreenName = 'test';

export interface GameEvents {
  screenChanged: { screen: ScreenName };
}

/** Top-level owner of all systems. */
export class Game {
  readonly events = new EventBus<GameEvents>();
  readonly screens = new StateMachine<ScreenName>();
  readonly input: Input;
  readonly renderer: Renderer;
  private readonly debug: DebugOverlay;
  private readonly loop: GameLoop;
  private physics!: PhysicsWorld;
  private testScene!: TestScene;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.debug = new DebugOverlay(ui);
    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.screens.fixedUpdate(dt),
      update: (dt, alpha) => this.update(dt, alpha),
      render: () => this.renderer.render(this.testScene.scene),
    });
  }

  async start(): Promise<void> {
    this.physics = await PhysicsWorld.create();
    this.testScene = new TestScene(this.physics);
    this.renderer.setCamera(this.testScene.camera);
    this.screens.add('test', this.testScene);
    this.changeScreen('test');
    this.loop.start();
  }

  changeScreen(screen: ScreenName): void {
    this.screens.change(screen);
    this.events.emit('screenChanged', { screen });
  }

  private update(dt: number, alpha: number): void {
    if (this.input.wasPressed('F3')) this.debug.toggle();
    this.screens.update(dt, alpha);
    // Stats are from the previous frame's render, which is accurate enough for an overlay.
    const { drawCalls, triangles } = this.renderer.takeStats();
    this.debug.update(dt, { drawCalls, triangles, physicsMs: this.physics.lastStepMs, bots: 0 });
    this.input.endFrame();
  }
}
