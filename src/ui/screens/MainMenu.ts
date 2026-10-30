import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import { MENU } from '../../data/menu';
import { isBuiltInGpu } from '../../platform/gpu';
import { quitGame } from '../../platform/quit';
import { showConfirm } from '../ConfirmDialog';
import { button, el } from '../dom';

/** Main menu: city fly-over, title, "Play vs Bots", "Quit Game". */
export class MainMenu implements State {
  private root: HTMLElement | null = null;

  constructor(private readonly ctx: GameContext) {}

  enter(): void {
    this.root = el('div', { class: 'screen main-menu' }, [
      el('div', { class: 'main-menu-column' }, [
        el('h1', { class: 'game-title', text: MENU.title }),
        el('p', { class: 'game-subtitle', text: MENU.subtitle }),
        el('div', { class: 'menu-buttons' }, [
          button('Play vs Bots', () => this.ctx.changeScreen('profile'), 'btn btn-menu btn-primary'),
          button('Quit Game', () => this.confirmQuit(), 'btn btn-menu'),
        ]),
      ]),
    ]);
    const tip = this.gpuTip();
    if (tip) this.root.append(tip);
    this.ctx.ui.append(this.root);
  }

  /**
   * Web build on built-in graphics: a dismissable tip to switch the browser to the graphics
   * card. The desktop app asks for the fast GPU itself, so it never shows this.
   */
  private gpuTip(): HTMLElement | null {
    const w = window as unknown as { lowFront?: unknown };
    const key = MENU.gpuTip.storageKey;
    if (w.lowFront || !isBuiltInGpu(this.ctx.renderer.gpuName) || readFlag(key)) return null;
    const tip: HTMLElement = el('div', { class: 'gpu-tip', attrs: { role: 'note' } }, [
      el('span', { text: `Running on ${this.ctx.renderer.gpuName}. ${MENU.gpuTip.text}` }),
      button('×', () => {
        writeFlag(key);
        tip.remove();
      }, 'gpu-tip-close'),
    ]);
    return tip;
  }

  exit(): void {
    this.root?.remove();
    this.root = null;
  }

  update(dt: number): void {
    this.ctx.backdrop.update(dt);
  }

  render(): void {
    this.ctx.renderer.render(this.ctx.backdrop.scene, this.ctx.backdrop.camera);
  }

  private confirmQuit(): void {
    if (!this.root) return;
    showConfirm(this.root, 'Are you sure?', () =>
      quitGame({
        target: window as unknown as Parameters<typeof quitGame>[0]['target'],
        onBlocked: () => this.ctx.changeScreen('quit'),
        delayMs: MENU.quitFallbackDelayMs,
      }),
    );
  }
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Storage blocked: the tip just comes back next time.
  }
}
