import { HUD } from '../../data/hud';
import { el } from '../dom';
import type { MapImage } from './MapImage';
import { drawDot, drawFlag, drawPlayer, type FlagMarker, type MapMarker } from './mapMarkers';

const CFG = HUD.minimap;

/**
 * Minimap (top left, plan section 11.1): turns with the player so forward is up; shows flags
 * with their owner color, teammates and the enemies the player can see.
 */
export class Minimap {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;

  constructor(private readonly image: MapImage) {
    this.canvas = el('canvas', { class: 'minimap-canvas' });
    this.canvas.width = this.canvas.height = CFG.size;
    this.element = el('div', { class: 'minimap' }, [this.canvas]);
  }

  draw(px: number, pz: number, yaw: number, flags: readonly FlagMarker[], markers: readonly MapMarker[]): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const S = CFG.size;
    const k = S / (2 * CFG.range);
    const img = this.image;
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(yaw);
    const f = k / img.scale;
    const [ix, iy] = img.toPx(px, pz);
    g.drawImage(img.canvas, -ix * f, -iy * f, img.canvas.width * f, img.canvas.height * f);
    g.restore();
    // Markers stay upright: rotate their positions only.
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const place = (x: number, z: number): [number, number] => {
      const dx = (x - px) * k;
      const dy = (z - pz) * k;
      return [S / 2 + dx * c - dy * s, S / 2 + dx * s + dy * c];
    };
    for (const m of markers) {
      const [x, y] = place(m.x, m.z);
      if (x > -4 && y > -4 && x < S + 4 && y < S + 4) drawDot(g, x, y, m);
    }
    for (const fl of flags) {
      let [x, y] = place(fl.x, fl.z);
      // Flags outside the view stick to the edge so they always show their direction.
      const r = HUD.flagMarker.radius + 2;
      x = Math.min(S - r, Math.max(r, x));
      y = Math.min(S - r, Math.max(r, y));
      drawFlag(g, x, y, fl);
    }
    drawPlayer(g, S / 2, S / 2, 0);
  }
}
