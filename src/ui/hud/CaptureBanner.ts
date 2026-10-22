import type { CaptureZone } from '../../game/CaptureZone';
import type { TeamId } from '../../data/map/types';
import { el } from '../dom';
import { teamColor } from './mapMarkers';

const RING_R = 22;
const RING_LEN = 2 * Math.PI * RING_R;
const SVG = 'http://www.w3.org/2000/svg';

/** "Capturing B" / "Neutralizing B" / "Contested" with a progress ring, while the player is in a zone. */
export class CaptureBanner {
  readonly element: HTMLElement;
  private readonly text = el('span', { class: 'cb-text' });
  private readonly letter = el('span', { class: 'cb-letter' });
  private readonly arc: SVGCircleElement;

  constructor() {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 56 56');
    svg.classList.add('cb-ring');
    const track = document.createElementNS(SVG, 'circle');
    this.arc = document.createElementNS(SVG, 'circle');
    for (const c of [track, this.arc]) {
      c.setAttribute('cx', '28');
      c.setAttribute('cy', '28');
      c.setAttribute('r', String(RING_R));
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke-width', '5');
      svg.append(c);
    }
    track.setAttribute('stroke', 'rgba(255,255,255,0.2)');
    this.arc.setAttribute('stroke-dasharray', String(RING_LEN));
    this.arc.setAttribute('transform', 'rotate(-90 28 28)');
    const ring = el('div', { class: 'cb-ring-wrap' }, [this.letter]);
    ring.prepend(svg as unknown as HTMLElement);
    this.element = el('div', { class: 'capture-banner' }, [ring, this.text]);
    this.element.hidden = true;
  }

  /** `zone` the player stands in (null hides the banner), seen from `team`. */
  update(zone: CaptureZone | null, team: TeamId): void {
    this.element.hidden = zone === null;
    if (!zone) return;
    const id = zone.flag.id;
    const sign = team === 'blue' ? 1 : -1;
    const ours = zone.control * sign;
    let text: string;
    let progress: number;
    if (zone.state === 'contested') {
      text = 'Contested';
      progress = Math.abs(zone.control);
    } else if (zone.owner === team && ours >= 1) {
      text = `${id} secured`;
      progress = 1;
    } else if (ours < 0) {
      text = `Neutralizing ${id}`;
      progress = 1 - Math.abs(zone.control);
    } else {
      text = `Capturing ${id}`;
      progress = ours;
    }
    this.text.textContent = text;
    this.letter.textContent = id;
    this.arc.setAttribute('stroke', teamColor(zone.control === 0 ? team : zone.control > 0 ? 'blue' : 'red'));
    this.arc.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - Math.max(0, Math.min(1, progress)))));
    this.element.classList.toggle('contested', zone.state === 'contested');
  }
}
