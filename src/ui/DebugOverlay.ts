import { ENGINE } from '../data/engine';

export interface DebugStats {
  drawCalls: number;
  triangles: number;
  physicsMs: number;
  bots: number;
}

/** F3 overlay: FPS, frame time, draw calls, triangles, bot count, physics time. */
export class DebugOverlay {
  private el: HTMLDivElement;
  private visible = false;
  private frames = 0;
  private elapsed = 0;
  private worstFrame = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    this.el.hidden = true;
    parent.appendChild(this.el);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
  }

  /** Call once per rendered frame with the frame delta (seconds). */
  update(dt: number, stats: DebugStats): void {
    this.frames++;
    this.elapsed += dt;
    this.worstFrame = Math.max(this.worstFrame, dt);
    if (this.elapsed < ENGINE.debugRefreshInterval) return;

    if (this.visible) {
      const fps = this.frames / this.elapsed;
      const avgMs = (this.elapsed / this.frames) * 1000;
      this.el.textContent = [
        `FPS        ${fps.toFixed(0)}`,
        `Frame      ${avgMs.toFixed(2)} ms (max ${(this.worstFrame * 1000).toFixed(1)})`,
        `Draw calls ${stats.drawCalls}`,
        `Triangles  ${stats.triangles.toLocaleString()}`,
        `Bots       ${stats.bots}`,
        `Physics    ${stats.physicsMs.toFixed(3)} ms`,
      ].join('\n');
    }
    this.frames = 0;
    this.elapsed = 0;
    this.worstFrame = 0;
  }
}
