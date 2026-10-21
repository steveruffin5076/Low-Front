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
  hp: number;
  maxHp: number;
  /** Spread cone in degrees and the camera FOV, to size the crosshair. */
  spreadDeg: number;
  fov: number;
  lastHit: string;
}

const HELP = [
  'WASD move · Mouse look · Shift sprint · C crouch · Space jump',
  'LMB fire · RMB aim · R reload · 1/2/wheel switch · B fire mode · I inspect · Q/E lean',
  'Test only: H take 20 damage · K die',
].join('\n');

/** Seconds a hit marker and a damage indicator stay visible. */
const HIT_MARKER_TIME = 0.25;
const INDICATOR_TIME = 1.6;
const MAX_INDICATORS = 4;
/** Crosshair arms never come closer than this (px). */
const MIN_GAP = 4;

/**
 * Test range overlay: crosshair (spread-sized, hidden while aiming), hit marker, damage
 * direction indicators, health bar, red hit flash, debug readout and key help.
 * The real HUD arrives in Phase 7.
 */
export class RangeOverlay {
  readonly element: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly hitMarker: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly lockHint: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthText: HTMLElement;
  private readonly indicators: { el: HTMLElement; time: number }[] = [];
  private flashTime = 0;
  private markerTime = 0;

  constructor() {
    this.crosshair = el('div', { class: 'crosshair' }, ['t', 'r', 'b', 'l'].map((s) => el('span', { class: `ch-${s}` })));
    this.hitMarker = el('div', { class: 'hit-marker' }, ['a', 'b', 'c', 'd'].map((s) => el('span', { class: `hm-${s}` })));
    this.readout = el('pre', { class: 'range-readout' });
    this.flash = el('div', { class: 'hit-flash' });
    this.banner = el('div', { class: 'death-banner', text: 'You died — respawning' });
    this.banner.hidden = true;
    this.lockHint = el('div', { class: 'lock-hint', text: 'Click to play' });
    this.healthFill = el('div', { class: 'health-fill' });
    this.healthText = el('span', { class: 'health-text' });
    const ring = el('div', { class: 'damage-ring' });
    for (let i = 0; i < MAX_INDICATORS; i++) {
      const ind = el('div', { class: 'damage-indicator' }, [el('span')]);
      ring.append(ind);
      this.indicators.push({ el: ind, time: 0 });
    }
    this.element = el('div', { class: 'range-overlay' }, [
      this.flash,
      ring,
      this.crosshair,
      this.hitMarker,
      el('div', { class: 'health-bar' }, [this.healthFill, this.healthText]),
      this.readout,
      el('pre', { class: 'range-help', text: HELP }),
      this.banner,
      this.lockHint,
    ]);
  }

  hitFlash(): void {
    this.flashTime = M.hit.flashTime;
  }

  /** White for a hit, red for a kill. */
  showHitMarker(kill: boolean): void {
    this.markerTime = HIT_MARKER_TIME;
    this.hitMarker.classList.toggle('kill', kill);
  }

  /** `angle` in radians: 0 = from the front, positive = from the right. */
  showDamageFrom(angle: number): void {
    const slot = this.indicators.reduce((a, b) => (b.time < a.time ? b : a));
    slot.time = INDICATOR_TIME;
    slot.el.style.transform = `rotate(${angle}rad)`;
  }

  update(dt: number, r: RangeReadout, dead: boolean, locked: boolean): void {
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.flash.style.opacity = String(this.flashTime / M.hit.flashTime);
    this.markerTime = Math.max(0, this.markerTime - dt);
    this.hitMarker.style.opacity = String(this.markerTime / HIT_MARKER_TIME);
    for (const ind of this.indicators) {
      ind.time = Math.max(0, ind.time - dt);
      ind.el.style.opacity = String(Math.min(1, ind.time / (INDICATOR_TIME * 0.5)));
    }

    // Crosshair gap matches the spread cone on screen.
    const halfHeight = window.innerHeight / 2;
    const gap = Math.max(MIN_GAP, (Math.tan((r.spreadDeg * Math.PI) / 180) / Math.tan((r.fov * Math.PI) / 360)) * halfHeight);
    this.crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
    this.crosshair.style.opacity = String(dead ? 0 : 1 - Math.min(1, r.ads * 2));

    const hpFrac = Math.max(0, r.hp / r.maxHp);
    this.healthFill.style.width = `${(hpFrac * 100).toFixed(1)}%`;
    this.healthFill.classList.toggle('low', hpFrac < 0.3);
    this.healthText.textContent = `${Math.ceil(r.hp)}`;

    this.banner.hidden = !dead;
    this.lockHint.hidden = locked;
    this.readout.textContent = [
      `${r.weapon}  ${r.mag} / ${r.reserve}  [${r.fireMode}]`,
      `Action   ${r.action}`,
      `Stance   ${r.stance}`,
      `Speed    ${r.speed.toFixed(1)} m/s`,
      `Spread   ${r.spreadDeg.toFixed(2)}°`,
      `Stamina  ${'█'.repeat(Math.round(r.stamina * 10)).padEnd(10, '·')}`,
      `Last hit ${r.lastHit}`,
    ].join('\n');
  }
}
