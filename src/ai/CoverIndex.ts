import type * as THREE from 'three';
import type { CoverPoint } from './CoverPoints';

const BUCKET = 8;
/** Cover points on another floor do not count. */
const MAX_DY = 1.5;

/** Spatial index over cover points for quick "nearest cover" questions. */
export class CoverIndex {
  private readonly buckets = new Map<string, CoverPoint[]>();

  constructor(readonly points: readonly CoverPoint[]) {
    for (const p of points) {
      const key = this.key(Math.floor(p.pos.x / BUCKET), Math.floor(p.pos.z / BUCKET));
      const list = this.buckets.get(key) ?? [];
      list.push(p);
      this.buckets.set(key, list);
    }
  }

  /** Cover points within `radius` of `pos` (same floor). */
  near(pos: THREE.Vector3, radius: number, out: CoverPoint[] = []): CoverPoint[] {
    out.length = 0;
    const r2 = radius * radius;
    const bx0 = Math.floor((pos.x - radius) / BUCKET);
    const bx1 = Math.floor((pos.x + radius) / BUCKET);
    const bz0 = Math.floor((pos.z - radius) / BUCKET);
    const bz1 = Math.floor((pos.z + radius) / BUCKET);
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let bz = bz0; bz <= bz1; bz++) {
        for (const p of this.buckets.get(this.key(bx, bz)) ?? []) {
          const dx = p.pos.x - pos.x;
          const dz = p.pos.z - pos.z;
          if (dx * dx + dz * dz <= r2 && Math.abs(p.pos.y - pos.y) < MAX_DY) out.push(p);
        }
      }
    }
    return out;
  }

  /**
   * The best cover point within `radius`: lowest `cost` (default: distance). Points for which
   * `cost` returns null are skipped (e.g. cover that does not face the threat).
   */
  best(pos: THREE.Vector3, radius: number, cost?: (p: CoverPoint, distance: number) => number | null): CoverPoint | null {
    let best: CoverPoint | null = null;
    let bestCost = Infinity;
    for (const p of this.near(pos, radius)) {
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      const c = cost ? cost(p, d) : d;
      if (c !== null && c < bestCost) {
        bestCost = c;
        best = p;
      }
    }
    return best;
  }

  private key(bx: number, bz: number): string {
    return `${bx},${bz}`;
  }
}
