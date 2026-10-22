import { el } from './dom';
import { CombatFeedback } from './hud/CombatFeedback';
import type { PlayerHud, PlayerReadout } from './PlayerHud';

export type RangeReadout = PlayerReadout;

const HELP = [
  'WASD move · Mouse look · Shift sprint · C crouch · Space jump',
  'LMB fire · RMB aim · R reload · 1/2/wheel switch · B fire mode · I inspect · Q/E lean',
  'Test only: H take 20 damage · K die',
].join('\n');

/** Test range overlay: combat feedback plus a debug readout, key help and the death banner. */
export class RangeOverlay implements PlayerHud {
  readonly element: HTMLElement;
  private readonly feedback = new CombatFeedback();
  private readonly readout: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly lockHint: HTMLElement;

  constructor() {
    this.readout = el('pre', { class: 'range-readout' });
    this.banner = el('div', { class: 'death-banner', text: 'You died — respawning' });
    this.banner.hidden = true;
    this.lockHint = el('div', { class: 'lock-hint', text: 'Click to play' });
    this.element = el('div', { class: 'range-overlay' }, [
      ...this.feedback.parts,
      this.readout,
      el('pre', { class: 'range-help', text: HELP }),
      this.banner,
      this.lockHint,
    ]);
  }

  setBoundsWarning(seconds: number | null): void {
    this.feedback.setWarning(seconds === null ? null : `Return to the battlefield: ${Math.ceil(seconds)}`);
  }

  hitFlash(): void {
    this.feedback.hitFlash();
  }

  showHitMarker(kill: boolean): void {
    this.feedback.showHitMarker(kill);
  }

  showDamageFrom(angle: number): void {
    this.feedback.showDamageFrom(angle);
  }

  update(dt: number, r: PlayerReadout, dead: boolean, locked: boolean): void {
    this.feedback.update(dt, r, dead);
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
