import type { ConquestMatch } from '../../game/ConquestMatch';
import { formatClock } from '../../game/MatchClock';
import { el } from '../dom';
import { teamColor } from './mapMarkers';

/** Top center (plan section 11.1): both teams' tickets, the match timer and the A–E flag strip. */
export class TopBar {
  readonly element: HTMLElement;
  private readonly blue = el('span', { class: 'tb-tickets tb-blue' });
  private readonly red = el('span', { class: 'tb-tickets tb-red' });
  private readonly clock = el('span', { class: 'tb-clock' });
  private readonly flags: { box: HTMLElement; fill: HTMLElement }[] = [];

  constructor(match: ConquestMatch) {
    const strip = el('div', { class: 'tb-flags' });
    for (const z of match.zones) {
      const fill = el('div', { class: 'tb-flag-fill' });
      const box = el('div', { class: 'tb-flag' }, [el('span', { text: z.flag.id }), fill]);
      strip.append(box);
      this.flags.push({ box, fill });
    }
    this.element = el('div', { class: 'top-bar' }, [el('div', { class: 'tb-row' }, [this.blue, this.clock, this.red]), strip]);
  }

  update(match: ConquestMatch): void {
    this.blue.textContent = String(match.tickets.count.blue);
    this.red.textContent = String(match.tickets.count.red);
    this.clock.textContent = formatClock(match.timeLeft);
    match.zones.forEach((z, i) => {
      const f = this.flags[i];
      f.box.style.background = teamColor(z.owner);
      f.box.classList.toggle('owned', z.owner !== null);
      // Progress bar under the letter: how far the flag leans and toward whom.
      f.fill.style.width = `${(Math.abs(z.control) * 100).toFixed(0)}%`;
      f.fill.style.background = teamColor(z.control > 0 ? 'blue' : z.control < 0 ? 'red' : null);
      f.box.classList.toggle('contested', z.state === 'contested');
    });
  }
}
