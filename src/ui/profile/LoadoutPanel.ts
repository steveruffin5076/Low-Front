import { ATTACHMENTS, COMPATIBLE, type WeaponBuild } from '../../data/attachments';
import { WEAPONS, WEAPON_IDS, type Loadout, type WeaponSlot } from '../../data/weapons';
import type { PreviewRenderer } from '../../render/PreviewRenderer';
import { fitWeapon } from '../../weapons/Gunsmith';
import { button, el } from '../dom';
import { GunsmithPanel } from './GunsmithPanel';
import { WeaponCard } from './WeaponCard';

const SLOT_LABELS: Record<WeaponSlot, string> = { primary: 'Primary Weapon', secondary: 'Secondary Weapon' };

/**
 * Weapon selection: one button per slot. Clicking a slot opens its list of weapon cards.
 * A weapon that takes attachments gets a Gunsmith button. Used by the profile and Deploy screens.
 */
export class LoadoutPanel {
  readonly element: HTMLElement;
  private loadout: Loadout;
  private openSlot: WeaponSlot | null = null;
  private cards: WeaponCard[] = [];
  private gunsmith: GunsmithPanel | null = null;

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
    this.gunsmith?.update(dt);
  }

  draw(preview: PreviewRenderer): void {
    for (const c of this.cards) c.draw(preview);
    this.gunsmith?.draw(preview);
  }

  dispose(): void {
    for (const c of this.cards) c.dispose();
    this.cards = [];
  }

  /** Closes the gunsmith too (leaving the screen). */
  close(): void {
    this.dispose();
    this.closeGunsmith();
  }

  private openGunsmith(slot: WeaponSlot): void {
    const id = this.loadout[slot];
    this.closeGunsmith();
    this.gunsmith = new GunsmithPanel(
      id,
      this.loadout.builds?.[id] ?? {},
      (build) => this.setBuild(id, build),
      () => {
        this.closeGunsmith();
        this.rebuild();
      },
    );
    this.element.append(this.gunsmith.element);
  }

  private closeGunsmith(): void {
    this.gunsmith?.dispose();
    this.gunsmith = null;
  }

  private setBuild(id: Loadout['primary'], build: WeaponBuild): void {
    const builds = { ...this.loadout.builds };
    if (Object.keys(build).length) builds[id] = build;
    else delete builds[id];
    this.loadout = { ...this.loadout, builds };
    this.onChange({ ...this.loadout });
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

  /** e.g. " (2 parts)" */
  private buildLabel(id: Loadout['primary']): string {
    const n = Object.keys(this.loadout.builds?.[id] ?? {}).length;
    return n ? ` · ${Object.values(this.loadout.builds![id]!).map((a) => ATTACHMENTS[a!].name).join(', ')}` : '';
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
      const weapon = this.loadout[slot];
      const smith = COMPATIBLE[weapon]?.length
        ? button(`Gunsmith${this.buildLabel(weapon)}`, () => this.openGunsmith(slot), 'btn gs-open')
        : null;
      let list: HTMLElement | null = null;
      if (open) {
        const cards = WEAPON_IDS.filter((id) => WEAPONS[id].slot === slot).map(
          (id) => new WeaponCard(fitWeapon(WEAPONS[id], this.loadout.builds?.[id]), id === this.loadout[slot], () => this.select(slot, id)),
        );
        this.cards.push(...cards);
        list = el('div', { class: 'weapon-list' }, cards.map((c) => c.element));
      }
      return el('div', { class: 'slot' }, [header, smith, list]);
    });
    this.element.replaceChildren(el('h2', { class: 'panel-title', text: 'Loadout' }), ...sections);
  }
}
