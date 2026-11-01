import type { WeaponDef } from '../../data/weapons';
import type { PreviewRenderer } from '../../render/PreviewRenderer';
import { STAT_BAR_LABELS, magazineLabel, statBars, type StatBarName } from '../../weapons/WeaponStats';
import { el } from '../dom';
import { WeaponPreview } from './WeaponPreview';

/** Weapon card: name, turning 3D preview, stat bars and magazine size. */
export class WeaponCard {
  readonly element: HTMLButtonElement;
  private readonly preview: WeaponPreview;

  constructor(weapon: WeaponDef, selected: boolean, onSelect: () => void) {
    this.preview = new WeaponPreview(weapon.id, weapon.build);
    const bars = statBars(weapon);
    this.element = el(
      'button',
      {
        class: `weapon-card${selected ? ' selected' : ''}`,
        attrs: { type: 'button', 'aria-pressed': String(selected) },
        on: { click: onSelect },
      },
      [
        el('div', { class: 'weapon-card-name', text: weapon.name }),
        this.preview.canvas,
        el(
          'div',
          { class: 'stat-list' },
          (Object.keys(STAT_BAR_LABELS) as StatBarName[]).map((k) => statRow(STAT_BAR_LABELS[k], bars[k])),
        ),
        el('div', { class: 'stat-mag' }, [
          el('span', { text: 'Magazine' }),
          el('span', { class: 'stat-mag-value', text: magazineLabel(weapon) }),
        ]),
      ],
    );
  }

  update(dt: number): void {
    this.preview.update(dt);
  }

  draw(preview: PreviewRenderer): void {
    this.preview.draw(preview);
  }

  dispose(): void {
    this.preview.dispose();
  }
}

/** One stat bar; `base` (0–1) marks where the bar was before a change (gunsmith). */
export function statRow(label: string, value: number, base?: number): HTMLElement {
  const fill = el('div', { class: 'stat-fill' });
  fill.style.width = `${Math.round(value * 100)}%`;
  const track = el('div', { class: 'stat-track' }, [fill]);
  if (base !== undefined && Math.abs(base - value) > 0.005) {
    // The changed part: green when better, red when worse.
    const delta = el('div', { class: `stat-delta ${value > base ? 'up' : 'down'}` });
    delta.style.left = `${Math.round(Math.min(base, value) * 100)}%`;
    delta.style.width = `${Math.round(Math.abs(value - base) * 100)}%`;
    fill.style.width = `${Math.round(Math.min(base, value) * 100)}%`;
    track.append(delta);
  }
  return el('div', { class: 'stat-row' }, [el('span', { class: 'stat-label', text: label }), track]);
}
