import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import { el } from '../dom';

/** Shown on the web build when the browser does not let the game close the tab. */
export class QuitScreen implements State {
  private root: HTMLElement | null = null;

  constructor(private readonly ctx: GameContext) {}

  enter(): void {
    this.root = el('div', { class: 'screen quit-screen' }, [
      el('p', { text: 'Thanks for playing. You can close this tab.' }),
    ]);
    this.ctx.ui.append(this.root);
  }

  exit(): void {
    this.root?.remove();
    this.root = null;
  }

  render(): void {
    this.ctx.renderer.clear();
  }
}
