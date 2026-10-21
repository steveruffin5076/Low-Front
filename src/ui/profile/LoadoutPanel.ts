import { WEAPONS, WEAPON_IDS, type Loadout, type WeaponSlot } from '../../data/weapons';
import type { PreviewRenderer } from '../../render/PreviewRenderer';
import { el } from '../dom';
import { WeaponCard } from './WeaponCard';

const SLOT_LABELS: Record<WeaponSlot, string> = { primary: 'Primary Weapon', secondary: 'Secondary Weapon' };

/**
 * Weapon selection: one button per slot. Clicking a slot opens its list of weapon cards.
 * Reused by the Deploy Screen in Phase 7.
 */
export class LoadoutPanel {
  readonly element: HTMLElement;
  private loadout: Loadout;
  private openSlot: WeaponSlot | null = null;
  private cards: WeaponCard[] = [];

  constructor(
    initial: Loadout,
    private readonly onChange: (loadout: Loadout) => void,
  ) {
    this.loadout = { ...initial };
    this.element = el('div', { class: 'panel loadout-panel' });
    this.rebuild();
  }

  update(dt: number): void {
    for (const c of this.cards) c.update(dt);
  }

  draw(preview: PreviewRenderer): void {
    for (const c of this.cards) c.draw(preview);
  }

  dispose(): void {
    for (const c of this.cards) c.dispose();
    this.cards = [];
  }

  private toggle(slot: WeaponSlot): void {
    this.openSlot = this.openSlot === slot ? null : slot;
    this.rebuild();
  }

  private select(slot: WeaponSlot, id: Loadout[WeaponSlot]): void {
    this.loadout = { ...this.loadout, [slot]: id };
    this.openSlot = null;
    this.onChange({ ...this.loadout });
    this.rebuild();
  }

  private rebuild(): void {
    this.dispose();
    const sections = (['primary', 'secondary'] as const).map((slot) => {
      const open = this.openSlot === slot;
      const header = el(
        'button',
        {
          class: `slot-button${open ? ' open' : ''}`,
          attrs: { type: 'button', 'aria-expanded': String(open) },
          on: { click: () => this.toggle(slot) },
        },
        [
          el('span', { class: 'slot-label', text: SLOT_LABELS[slot] }),
          el('span', { class: 'slot-weapon', text: WEAPONS[this.loadout[slot]].name }),
        ],
      );
      let list: HTMLElement | null = null;
      if (open) {
        const cards = WEAPON_IDS.filter((id) => WEAPONS[id].slot === slot).map(
          (id) => new WeaponCard(WEAPONS[id], id === this.loadout[slot], () => this.select(slot, id)),
        );
        this.cards.push(...cards);
        list = el('div', { class: 'weapon-list' }, cards.map((c) => c.element));
      }
      return el('div', { class: 'slot' }, [header, list]);
    });
    this.element.replaceChildren(el('h2', { class: 'panel-title', text: 'Loadout' }), ...sections);
  }
}
