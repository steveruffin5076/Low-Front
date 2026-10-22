import { HUD } from '../../data/hud';
import { el } from '../dom';
import type { MapImage } from './MapImage';
import { drawDot, drawFlag, drawPlayer, type FlagMarker, type MapMarker } from './mapMarkers';

/** The whole battlefield, north up (hold M; also the Deploy Screen map). */
export class LargeMap {
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;

  constructor(
    private readonly image: MapImage,
    size: number = HUD.largeMap.size,
    cls = 'large-map',
  ) {
    this.canvas = el('canvas', { class: `${cls}-canvas` });
    this.canvas.width = this.canvas.height = size;
    this.element = el('div', { class: cls }, [this.canvas]);
  }

  /** Map meters → canvas pixels. */
  toCanvas(x: number, z: number): [number, number] {
    const [ix, iy] = this.image.toPx(x, z);
    const f = this.canvas.width / this.image.canvas.width;
    return [ix * f, iy * f];
  }

  draw(flags: readonly FlagMarker[], markers: readonly MapMarker[], player: { x: number; z: number; yaw: number } | null, highlight?: string): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const S = this.canvas.width;
    g.drawImage(this.image.canvas, 0, 0, S, S);
    for (const m of markers) drawDot(g, ...this.toCanvas(m.x, m.z), m);
    for (const f of flags) {
      const [x, y] = this.toCanvas(f.x, f.z);
      if (highlight === f.id) {
        g.beginPath();
        g.arc(x, y, HUD.flagMarker.radius + 6, 0, Math.PI * 2);
        g.strokeStyle = '#ffe066';
        g.lineWidth = 3;
        g.stroke();
      }
      drawFlag(g, x, y, f, HUD.flagMarker.radius + 3);
    }
    if (player) drawPlayer(g, ...this.toCanvas(player.x, player.z), -player.yaw, 10);
  }
}
