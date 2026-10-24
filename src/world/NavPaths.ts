import type * as THREE from 'three';
import type { Edge, NavGrid, NavLevel } from './NavGrid';

/** Side offset (cells) of the two extra lines that give a straight line the soldier's width. */
const WIDTH = 0.35;

/**
 * True if a soldier can walk in a straight line from node `a` to node `b` on one level:
 * every cell crossed is walkable and every crossing is a legal move (corners need both
 * orthogonal moves, so lines never cut a corner). The line is checked at its center and
 * at each side, so a soldier's width clears props along the way.
 */
export function clearLine(nav: NavGrid, a: number, b: number): boolean {
  const A = nav.decode(a);
  const B = nav.decode(b);
  if (A.level !== B.level) return false;
  const dx = B.i - A.i;
  const dz = B.j - A.j;
  const len = Math.hypot(dx, dz);
  if (len === 0) return true;
  const ox = (-dz / len) * WIDTH;
  const oz = (dx / len) * WIDTH;
  return lineClear(nav, A.level, A.i + 0.5, A.j + 0.5, dx, dz) && lineClear(nav, A.level, A.i + 0.5 + ox, A.j + 0.5 + oz, dx, dz) && lineClear(nav, A.level, A.i + 0.5 - ox, A.j + 0.5 - oz, dx, dz);
}

/** Walks the cells of one line from grid point (x, z) along (dx, dz). */
function lineClear(nav: NavGrid, L: NavLevel, x: number, z: number, dx: number, dz: number): boolean {
  const steps = Math.ceil(Math.hypot(dx, dz) * 4);
  let ci = Math.floor(x);
  let cj = Math.floor(z);
  if (ci < 0 || cj < 0 || ci >= L.w || cj >= L.h || !L.walk[cj * L.w + ci]) return false;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const ni = Math.floor(x + dx * t);
    const nj = Math.floor(z + dz * t);
    if (ni === ci && nj === cj) continue;
    const di = ni - ci;
    const dj = nj - cj;
    if (di && dj) {
      const viaX = nav.canStep(L, ci, cj, di, 0) && nav.canStep(L, ci + di, cj, 0, dj);
      const viaZ = nav.canStep(L, ci, cj, 0, dj) && nav.canStep(L, ci, cj + dj, di, 0);
      if (!viaX || !viaZ) return false;
    } else if (!nav.canStep(L, ci, cj, di, dj)) {
      return false;
    }
    ci = ni;
    cj = nj;
  }
  return true;
}

/**
 * Smoothed world points for a node path (plan section 10.6): string-pulling keeps only the
 * corners needed to stay on walkable ground; stair links keep their waypoints.
 */
export function smoothPath(nav: NavGrid, path: readonly number[]): THREE.Vector3[] {
  if (path.length === 0) return [];
  const out: THREE.Vector3[] = [nav.position(path[0])];
  let anchor = 0;
  let i = 1;
  while (i < path.length) {
    const link = nav.linkEdges.get(path[i - 1])?.find((e) => e.to === path[i]);
    if (link) {
      if (anchor !== i - 1) out.push(nav.position(path[i - 1]));
      if (link.via) out.push(...link.via.map((v) => v.clone()));
      out.push(nav.position(path[i]));
      anchor = i;
      i++;
      continue;
    }
    if (i - anchor > 1 && !clearLine(nav, path[anchor], path[i])) {
      out.push(nav.position(path[i - 1]));
      anchor = i - 1;
      continue;
    }
    i++;
  }
  if (anchor !== path.length - 1) out.push(nav.position(path[path.length - 1]));
  return out;
}

/** The walkable cell nearest to `p` (same floor) whose region is `region`, within `radius` cells. */
export function nearestInRegion(nav: NavGrid, p: THREE.Vector3, region: number, radius: number): number | null {
  const n = nav.node(p.x, p.y, p.z);
  if (n === null) return null;
  const { level, i, j } = nav.decode(n);
  let best: number | null = null;
  let bestD = Infinity;
  for (let dj = -radius; dj <= radius; dj++) {
    for (let di = -radius; di <= radius; di++) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= level.w || jj >= level.h) continue;
      const k = jj * level.w + ii;
      const d = di * di + dj * dj;
      if (level.walk[k] && nav.region[level.base + k] === region && d < bestD) {
        bestD = d;
        best = level.base + k;
      }
    }
  }
  return best;
}

/** Labels connected walkable areas (moves and links) so unreachable goals fail at once. */
export function labelRegions(nav: NavGrid): Int32Array {
  const count = nav.nodeCount;
  const region = new Int32Array(count).fill(-1);
  const edges: Edge[] = [];
  const stack: number[] = [];
  let id = 0;
  for (let n = 0; n < count; n++) {
    if (region[n] !== -1 || !nav.walkable(n)) continue;
    region[n] = id;
    stack.push(n);
    while (stack.length) {
      const c = stack.pop()!;
      for (const e of nav.neighbors(c, edges)) {
        if (region[e.to] === -1) {
          region[e.to] = id;
          stack.push(e.to);
        }
      }
    }
    id++;
  }
  return region;
}
