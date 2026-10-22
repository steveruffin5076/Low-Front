import { VIEWMODEL_MOTION as M } from '../../data/viewmodel';
import { el } from '../dom';
import type { PlayerReadout } from '../PlayerHud';
import '../range.css';

/** Seconds a hit marker and a damage indicator stay visible. */
const HIT_MARKER_TIME = 0.25;
const INDICATOR_TIME = 1.6;
const MAX_INDICATORS = 4;
/** Crosshair arms never come closer than this (px). */
const MIN_GAP = 4;

/**
 * Combat feedback shared by the test range overlay and the match HUD: crosshair (sized by the
 * spread, hidden while aiming), hit marker, damage direction indicators, red hit flash, health
 * bar and a warning banner (out of bounds, enemy HQ).
 */
export class CombatFeedback {
  /** Parts to add to a HUD root, in stacking order. */
  readonly parts: HTMLElement[];
  readonly healthBar: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly hitMarker: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly warning: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthText: HTMLElement;
  private readonly indicators: { el: HTMLElement; time: number }[] = [];
  private flashTime = 0;
  private markerTime = 0;

  constructor() {
    this.crosshair = el('div', { class: 'crosshair' }, ['t', 'r', 'b', 'l'].map((s) => el('span', { class: `ch-${s}` })));
    this.hitMarker = el('div', { class: 'hit-marker' }, ['a', 'b', 'c', 'd'].map((s) => el('span', { class: `hm-${s}` })));
    this.flash = el('div', { class: 'hit-flash' });
    this.warning = el('div', { class: 'bounds-banner' });
    this.warning.hidden = true;
    this.healthFill = el('div', { class: 'health-fill' });
    this.healthText = el('span', { class: 'health-text' });
    this.healthBar = el('div', { class: 'health-bar' }, [this.healthFill, this.healthText]);
    const ring = el('div', { class: 'damage-ring' });
    for (let i = 0; i < MAX_INDICATORS; i++) {
      const ind = el('div', { class: 'damage-indicator' }, [el('span')]);
      ring.append(ind);
      this.indicators.push({ el: ind, time: 0 });
    }
    this.parts = [this.flash, ring, this.crosshair, this.hitMarker, this.healthBar, this.warning];
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

  /** A warning banner text, or null to hide it. */
  setWarning(text: string | null): void {
    this.warning.hidden = text === null;
    if (text !== null && this.warning.textContent !== text) this.warning.textContent = text;
  }

  update(dt: number, r: PlayerReadout, dead: boolean): void {
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
  }
}
