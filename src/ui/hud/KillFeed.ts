import { HUD } from '../../data/hud';
import type { KillFeedEntry } from '../../game/ConquestMatch';
import { el } from '../dom';

const CAUSE_TEXT: Record<string, string> = {
  fall: 'fell',
  bounds: 'left the battlefield',
  hq: 'entered the enemy HQ',
  suicide: 'died',
};

/** Kill feed (right side): killer, weapon, victim and a headshot mark; newest on top. */
export class KillFeed {
  readonly element = el('div', { class: 'kill-feed' });
  private readonly rows: { el: HTMLElement; time: number }[] = [];

  add(k: KillFeedEntry): void {
    const name = (who: { name: string; team: string }): HTMLElement => el('span', { class: `kf-name kf-${who.team}`, text: who.name });
    const parts: HTMLElement[] = k.killer
      ? [name(k.killer), el('span', { class: 'kf-weapon', text: k.weapon }), name(k.victim)]
      : [name(k.victim), el('span', { class: 'kf-weapon', text: CAUSE_TEXT[k.cause ?? 'suicide'] })];
    if (k.headshot) parts.push(el('span', { class: 'kf-headshot', text: 'HS', attrs: { title: 'Headshot' } }));
    const row = el('div', { class: 'kf-row' }, parts);
    this.element.prepend(row);
    this.rows.unshift({ el: row, time: HUD.killFeed.time });
    while (this.rows.length > HUD.killFeed.max) this.rows.pop()!.el.remove();
  }

  update(dt: number): void {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      const r = this.rows[i];
      r.time -= dt;
      r.el.style.opacity = String(Math.min(1, r.time));
      if (r.time <= 0) {
        r.el.remove();
        this.rows.splice(i, 1);
      }
    }
  }
}
