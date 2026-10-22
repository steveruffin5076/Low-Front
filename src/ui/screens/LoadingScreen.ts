import type { State } from '../../core/StateMachine';
import type { GameContext, ScreenName } from '../../core/GameContext';
import { MENU } from '../../data/menu';
import { el } from '../dom';

/** Runs an async load task, then moves to the next screen. */
export class LoadingScreen implements State {
  private root: HTMLElement | null = null;
  /** Increases on every enter so a late result from an old load is ignored. */
  private loadId = 0;

  constructor(
    private readonly ctx: GameContext,
    private readonly task: () => Promise<void>,
    private readonly next: ScreenName,
  ) {}

  enter(): void {
    const id = ++this.loadId;
    const status = el('p', { class: 'loading-text', text: 'Loading…' });
    this.root = el('div', { class: 'screen loading-screen' }, [status]);
    this.ctx.ui.append(this.root);

    const minDelay = new Promise((r) => setTimeout(r, MENU.loadingMinMs));
    Promise.all([this.task(), minDelay])
      .then(() => {
        if (id === this.loadId && this.root) this.ctx.changeScreen(this.next);
      })
      .catch((err: unknown) => {
        console.error('Loading failed', err);
        status.textContent = 'Loading failed. See the console for details.';
      });
  }

  exit(): void {
    this.loadId++;
    this.root?.remove();
    this.root = null;
  }

  render(): void {
    this.ctx.renderer.clear();
  }
}
