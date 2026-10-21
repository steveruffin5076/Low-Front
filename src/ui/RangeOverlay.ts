import { VIEWMODEL_MOTION as M } from '../data/viewmodel';
import { el } from './dom';
import './range.css';

export interface RangeReadout {
  weapon: string;
  mag: number;
  reserve: number;
  fireMode: string;
  action: string;
  stance: string;
  speed: number;
  stamina: number;
  ads: number;
}

const HELP = [
  'WASD move · Mouse look · Shift sprint · C crouch · Space jump',
  'LMB fire · RMB aim · R reload · 1/2/wheel switch · B fire mode · I inspect · Q/E lean',
  'Test only: H hit reaction · K death',
].join('\n');

/**
 * Test range overlay: crosshair (hidden while aiming), a debug readout, the red
 * hit flash and key help. The real HUD arrives in Phase 7.
 */
export class RangeOverlay {
  readonly element: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly lockHint: HTMLElement;
  private flashTime = 0;

  constructor() {
    this.crosshair = el('div', { class: 'crosshair' }, ['t', 'r', 'b', 'l'].map((s) => el('span', { class: `ch-${s}` })));
    this.readout = el('pre', { class: 'range-readout' });
    this.flash = el('div', { class: 'hit-flash' });
    this.banner = el('div', { class: 'death-banner', text: 'You died — respawning' });
    this.banner.hidden = true;
    this.lockHint = el('div', { class: 'lock-hint', text: 'Click to play' });
    this.element = el('div', { class: 'range-overlay' }, [
      this.flash,
      this.crosshair,
      this.readout,
      el('pre', { class: 'range-help', text: HELP }),
      this.banner,
      this.lockHint,
    ]);
  }

  hitFlash(): void {
    this.flashTime = M.hit.flashTime;
  }

  update(dt: number, r: RangeReadout, dead: boolean, locked: boolean): void {
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.flash.style.opacity = String(this.flashTime / M.hit.flashTime);
    this.crosshair.style.opacity = String(dead ? 0 : 1 - Math.min(1, r.ads * 2));
    this.banner.hidden = !dead;
    this.lockHint.hidden = locked;
    this.readout.textContent = [
      `${r.weapon}  ${r.mag} / ${r.reserve}  [${r.fireMode}]`,
      `Action   ${r.action}`,
      `Stance   ${r.stance}`,
      `Speed    ${r.speed.toFixed(1)} m/s`,
      `Stamina  ${'█'.repeat(Math.round(r.stamina * 10)).padEnd(10, '·')}`,
    ].join('\n');
  }
}
