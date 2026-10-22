import { HUD } from '../../data/hud';
import { PLANS } from '../../data/map/plans';
import type { MapData, Rect, TeamId } from '../../data/map/types';

const C = HUD.map.colors;

/**
 * Top-down 2D image of the map, drawn once from the map data (ground, streets, buildings, HQs).
 * North (−Z) is up. Shared by the minimap, the large map and the Deploy Screen.
 */
export class MapImage {
  readonly canvas: HTMLCanvasElement;
  /** Half the width covered, in meters. */
  readonly extent: number;
  readonly scale = HUD.map.pxPerMeter;

  constructor(readonly map: MapData) {
    this.extent = map.half + HUD.map.margin;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = Math.round(this.extent * 2 * this.scale);
    this.draw();
  }

  /** Map meters → image pixels. */
  toPx(x: number, z: number): [number, number] {
    return [(x + this.extent) * this.scale, (z + this.extent) * this.scale];
  }

  private draw(): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const m = this.map;
    g.fillStyle = C.outside;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.rect(g, { x0: -m.half, z0: -m.half, x1: m.half, z1: m.half }, C.ground);
    for (const a of m.ground) this.rect(g, a.rect, C[a.kind]);
    for (const s of m.streets) this.rect(g, s.rect, C.asphalt);
    for (const h of m.hqs) this.rect(g, h.rect, teamTint(h.team));
    for (const b of m.solids) this.rect(g, { x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 }, C.building, true);
    for (const e of m.enterables) {
      const p = PLANS[e.plan];
      const turned = Math.round(e.rotY / (Math.PI / 2)) % 2 !== 0;
      const w = turned ? p.d : p.w;
      const d = turned ? p.w : p.d;
      this.rect(g, { x0: e.x - w / 2, z0: e.z - d / 2, x1: e.x + w / 2, z1: e.z + d / 2 }, C.enterable, true);
    }
  }

  private rect(g: CanvasRenderingContext2D, r: Rect, color: string, outline = false): void {
    const [x0, z0] = this.toPx(Math.min(r.x0, r.x1), Math.min(r.z0, r.z1));
    const [x1, z1] = this.toPx(Math.max(r.x0, r.x1), Math.max(r.z0, r.z1));
    g.fillStyle = color;
    g.fillRect(x0, z0, x1 - x0, z1 - z0);
    if (outline) {
      g.strokeStyle = C.edge;
      g.lineWidth = 1;
      g.strokeRect(x0 + 0.5, z0 + 0.5, x1 - x0 - 1, z1 - z0 - 1);
    }
  }
}

function teamTint(team: TeamId): string {
  return team === 'blue' ? 'rgba(47,125,225,0.35)' : 'rgba(229,72,59,0.35)';
}
