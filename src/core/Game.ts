import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import { StateMachine } from './StateMachine';
import type { GameContext, ScreenName } from './GameContext';
import { Renderer } from '../render/Renderer';
import { PreviewRenderer } from '../render/PreviewRenderer';
import { ProfileStore } from '../save/ProfileStore';
import { SettingsStore } from '../save/SettingsStore';
import { browserStore } from '../save/Storage';
import { MenuBackdrop } from '../scenes/MenuBackdrop';
import { DebugOverlay } from '../ui/DebugOverlay';
import { LoadingScreen } from '../ui/screens/LoadingScreen';
import { MainMenu } from '../ui/screens/MainMenu';
import { EndScreen } from '../ui/screens/EndScreen';
import { MatchScreen } from '../ui/screens/MatchScreen';
import { ProfileScreen } from '../ui/screens/ProfileScreen';
import { QuitScreen } from '../ui/screens/QuitScreen';

export interface GameEvents {
  screenChanged: { screen: ScreenName };
}

/** Top-level owner of all systems and screens. */
export class Game {
  readonly events = new EventBus<GameEvents>();
  readonly screens = new StateMachine<ScreenName>();
  private readonly ctx: GameContext;
  private readonly debug: DebugOverlay;
  private readonly loop: GameLoop;
  private readonly match: MatchScreen;
  /** CPU time this frame: fixed steps (simulation) and the last render call. */
  private simMs = 0;
  private renderMs = 0;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ctx = {
      ui,
      renderer: new Renderer(canvas),
      preview: new PreviewRenderer(),
      input: new Input(canvas),
      profiles: new ProfileStore(browserStore()),
      settings: new SettingsStore(browserStore()),
      lastMatch: null,
      backdrop: new MenuBackdrop(),
      changeScreen: (screen) => this.changeScreen(screen),
    };
    this.debug = new DebugOverlay(ui);
    this.match = new MatchScreen(this.ctx);
    this.screens
      .add('mainMenu', new MainMenu(this.ctx))
      .add('profile', new ProfileScreen(this.ctx))
      .add('loading', new LoadingScreen(this.ctx, () => this.match.load(), 'match'))
      .add('match', this.match)
      .add('end', new EndScreen(this.ctx))
      .add('quit', new QuitScreen(this.ctx));
    this.loop = new GameLoop({
      fixedUpdate: (dt) => {
        const t = performance.now();
        this.screens.fixedUpdate(dt);
        this.simMs += performance.now() - t;
      },
      update: (dt, alpha) => this.update(dt, alpha),
      render: () => {
        const t = performance.now();
        this.screens.render();
        this.renderMs = performance.now() - t;
      },
    });
  }

  start(): void {
    this.changeScreen('mainMenu');
    this.loop.start();
  }

  changeScreen(screen: ScreenName): void {
    this.screens.change(screen);
    this.events.emit('screenChanged', { screen });
  }

  private update(dt: number, alpha: number): void {
    const input = this.ctx.input;
    if (input.wasPressed('F3')) this.debug.toggle();
    this.screens.update(dt, alpha);
    // Stats are from the previous frame's render, which is accurate enough for an overlay.
    const { drawCalls, triangles } = this.ctx.renderer.takeStats();
    this.debug.update(dt, {
      drawCalls,
      triangles,
      physicsMs: this.match.physicsMs,
      bots: this.match.botCount,
      simMs: this.simMs,
      renderMs: this.renderMs,
      voices: this.match.session?.audio.voices ?? 0,
    });
    this.simMs = 0;
    input.endFrame();
  }
}
