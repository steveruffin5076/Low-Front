import { ATTACHMENTS, ATTACHMENT_SLOTS, COMPATIBLE, SLOT_NAMES, type AttachmentDef, type AttachmentEffects, type AttachmentSlot, type WeaponBuild } from '../../data/attachments';
import { MOVEMENT } from '../../data/player';
import { WEAPONS, type WeaponId } from '../../data/weapons';
import type { PreviewRenderer } from '../../render/PreviewRenderer';
import { effectsFor, fitWeapon } from '../../weapons/Gunsmith';
import { STAT_BAR_LABELS, magazineLabel, statBars, type StatBarName } from '../../weapons/WeaponStats';
import { button, el } from '../dom';
import { statRow } from './WeaponCard';
import { WeaponPreview } from './WeaponPreview';

/** How each effect reads on a part card; `better` says which direction helps. */
const EFFECT_LABELS: Record<Exclude<keyof AttachmentEffects, 'magazineAdd'>, { label: string; better: 'lower' | 'higher' }> = {
  adsTime: { label: 'Aim time', better: 'lower' },
  verticalRecoil: { label: 'Vertical recoil', better: 'lower' },
  horizontalRecoil: { label: 'Side recoil', better: 'lower' },
  hipSpread: { label: 'Hip-fire spread', better: 'lower' },
  adsSpread: { label: 'Aimed spread', better: 'lower' },
  moveSpeed: { label: 'Move speed', better: 'higher' },
  range: { label: 'Range', better: 'higher' },
  reloadTime: { label: 'Reload time', better: 'lower' },
  pelletSpread: { label: 'Pellet spread', better: 'lower' },
  braced: { label: 'Crouched recoil', better: 'lower' },
};

/** Effect chips for a part: "Aim time −10%" in green, "+5%" in red, and its specials. */
export function effectChips(def: AttachmentDef, weapon: WeaponId): { text: string; good: boolean }[] {
  const out: { text: string; good: boolean }[] = [];
  const effects = effectsFor(def, weapon);
  if (def.optic) out.push({ text: `Zoom ${(MOVEMENT.baseFov / def.optic.adsFov).toFixed(1)}×`, good: true });
  if (def.suppressed) out.push({ text: 'Quiet shots', good: true });
  if (effects.magazineAdd) out.push({ text: `+${effects.magazineAdd} rounds`, good: true });
  for (const [key, info] of Object.entries(EFFECT_LABELS) as [keyof typeof EFFECT_LABELS, (typeof EFFECT_LABELS)[keyof typeof EFFECT_LABELS]][]) {
    const k = effects[key];
    if (k === undefined || k === 1) continue;
    const pct = Math.round((k - 1) * 100);
    out.push({ text: `${info.label} ${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`, good: info.better === 'lower' ? pct < 0 : pct > 0 });
  }
  return out;
}

/**
 * Gunsmith (enhancement-1 §5.12): a large preview of the weapon with its build, one row per slot
 * (open it to pick a part or None), and the stat bars showing the change from the bare weapon.
 * Every change is reported at once through `onChange`.
 */
export class GunsmithPanel {
  readonly element: HTMLElement;
  private readonly preview: WeaponPreview;
  private build: WeaponBuild;
  private openSlot: AttachmentSlot | null = null;
  private readonly slots = el('div', { class: 'gs-slots' });
  private readonly stats = el('div', { class: 'gs-stats' });

  constructor(
    private readonly id: WeaponId,
    build: WeaponBuild,
    private readonly onChange: (build: WeaponBuild) => void,
    onClose: () => void,
  ) {
    this.build = { ...build };
    this.preview = new WeaponPreview(id, this.build, 'gs-canvas');
    this.element = el('div', { class: 'gunsmith' }, [
      el('div', { class: 'gs-panel' }, [
        el('div', { class: 'gs-head' }, [
          el('h2', { class: 'panel-title', text: `Gunsmith · ${WEAPONS[id].name}` }),
          button('Done', onClose, 'btn btn-primary gs-done'),
        ]),
        el('div', { class: 'gs-body' }, [el('div', { class: 'gs-view' }, [this.preview.canvas, this.stats]), this.slots]),
      ]),
    ]);
    this.render();
  }

  update(dt: number): void {
    this.preview.update(dt);
  }

  draw(preview: PreviewRenderer): void {
    this.preview.draw(preview);
  }

  dispose(): void {
    this.preview.dispose();
    this.element.remove();
  }

  private pick(slot: AttachmentSlot, id: AttachmentDef['id'] | null): void {
    const next = { ...this.build };
    if (id) next[slot] = id;
    else delete next[slot];
    this.build = next;
    this.openSlot = null;
    this.preview.show(this.id, this.build);
    this.onChange({ ...this.build });
    this.render();
  }

  private render(): void {
    const allowed = COMPATIBLE[this.id] ?? [];
    // Only the slots this gun has parts for (a pistol has no underbarrel).
    const slots = ATTACHMENT_SLOTS.filter((slot) => allowed.some((a) => ATTACHMENTS[a].slot === slot));
    this.slots.replaceChildren(
      ...slots.map((slot) => {
        const current = this.build[slot] ? ATTACHMENTS[this.build[slot]!] : null;
        const open = this.openSlot === slot;
        const header = el(
          'button',
          {
            class: `slot-button${open ? ' open' : ''}`,
            attrs: { type: 'button', 'aria-expanded': String(open) },
            on: {
              click: () => {
                this.openSlot = open ? null : slot;
                this.render();
              },
            },
          },
          [el('span', { class: 'slot-label', text: SLOT_NAMES[slot] }), el('span', { class: 'slot-weapon', text: current?.name ?? 'None' })],
        );
        if (!open) return el('div', { class: 'slot' }, [header]);
        const parts = allowed.map((a) => ATTACHMENTS[a]).filter((a) => a.slot === slot);
        const option = (def: AttachmentDef | null): HTMLElement =>
          el(
            'button',
            {
              class: `gs-part${(def?.id ?? null) === (current?.id ?? null) ? ' selected' : ''}`,
              attrs: { type: 'button' },
              on: { click: () => this.pick(slot, def?.id ?? null) },
            },
            [
              el('div', { class: 'gs-part-name', text: def?.name ?? 'None' }),
              def ? el('div', { class: 'gs-part-blurb', text: def.blurb }) : el('div', { class: 'gs-part-blurb', text: 'The standard part.' }),
              def ? el('div', { class: 'gs-chips' }, effectChips(def, this.id).map((c) => el('span', { class: `gs-chip ${c.good ? 'good' : 'bad'}`, text: c.text }))) : null,
            ],
          );
        return el('div', { class: 'slot' }, [header, el('div', { class: 'gs-parts' }, [option(null), ...parts.map(option)])]);
      }),
    );
    const base = WEAPONS[this.id];
    const fitted = fitWeapon(base, this.build);
    const now = statBars(fitted);
    const before = statBars(base);
    this.stats.replaceChildren(
      el('div', { class: 'stat-list' }, (Object.keys(STAT_BAR_LABELS) as StatBarName[]).map((k) => statRow(STAT_BAR_LABELS[k], now[k], before[k]))),
      el('div', { class: 'stat-mag' }, [el('span', { text: 'Magazine' }), el('span', { class: 'stat-mag-value', text: magazineLabel(fitted) })]),
    );
  }
}
