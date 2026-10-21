import * as THREE from 'three';
import { NAV } from '../data/nav';
import type { NavGrid } from '../world/NavGrid';
import { volumeBounds, type Volume } from '../world/Volume';

export interface CoverPoint {
  pos: THREE.Vector3;
  /** Unit direction from the point toward the cover. */
  toward: THREE.Vector3;
  /** High cover hides a standing soldier; low cover needs crouching. */
  high: boolean;
}

/**
 * Cover points next to props and walls (plan section 10.6): points along each face of a
 * blocking volume, a short step away from it, kept only where the nav grid is walkable and the
 * volume stands on that floor. Building corners get points too (good peeking spots).
 */
export function generateCoverPoints(volumes: readonly Volume[], nav: NavGrid): CoverPoint[] {
  const out: CoverPoint[] = [];
  const taken = new Set<string>();
  const c = NAV.cover;
  const p = new THREE.Vector3();
  for (const v of volumes) {
    if (v.kind !== 'solid' || v.noCover || v.invisible || v.tilt !== 0) continue;
    if (Math.min(v.half.x, v.half.z) < 0.1 && Math.max(v.half.x, v.half.z) < 0.5) continue;
    const b = volumeBounds(v);
    const big = v.half.x * v.half.z > 30;
    const spacing = big ? c.wallSpacing : c.propSpacing;
    const cos = Math.cos(v.yaw);
    const sin = Math.sin(v.yaw);
    // Faces: local ±X and ±Z, each sampled along its length.
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const faceHalf = nx !== 0 ? v.half.z : v.half.x;
      const off = (nx !== 0 ? v.half.x : v.half.z) + c.standoff + NAV.radius;
      const count = Math.max(1, Math.floor((2 * faceHalf) / spacing));
      const samples: number[] = [];
      for (let i = 0; i < count; i++) samples.push(-faceHalf + (2 * faceHalf * (i + 0.5)) / count);
      // Corners of large volumes, just past the edge.
      if (big) samples.push(-faceHalf - NAV.radius, faceHalf + NAV.radius);
      for (const u of samples) {
        const lx = nx !== 0 ? nx * off : u;
        const lz = nz !== 0 ? nz * off : u;
        p.set(v.center.x + lx * cos + lz * sin, b.min.y, v.center.z - lx * sin + lz * cos);
        const n = nav.node(p.x, Math.max(0, b.min.y), p.z);
        if (n === null || !nav.walkable(n)) continue;
        const pos = nav.position(n);
        const height = b.max.y - pos.y;
        // The volume must stand on (or below) this floor and rise above it enough to hide behind.
        if (b.min.y > pos.y + NAV.step || height < c.lowMin) continue;
        const key = `${Math.round(pos.x / c.dedupe)},${Math.round(pos.y)},${Math.round(pos.z / c.dedupe)}`;
        if (taken.has(key)) continue;
        taken.add(key);
        const toward = new THREE.Vector3(-nx * cos - nz * sin, 0, nx * sin - nz * cos).normalize();
        out.push({ pos, toward, high: height >= c.highMin });
      }
    }
  }
  return out;
}
