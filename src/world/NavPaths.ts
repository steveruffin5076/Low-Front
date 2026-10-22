import type * as THREE from 'three';
import type { NavGrid } from './NavGrid';

/**
 * True if a soldier can walk in a straight line from node `a` to node `b` on one level:
 * every cell crossed is walkable and every crossing is a legal move (corners need both
 * orthogonal moves, so lines never cut a corner).
 */
export function clearLine(nav: NavGrid, a: number, b: number): boolean {
  const A = nav.decode(a);
  const B = nav.decode(b);
  if (A.level !== B.level) return false;
  const L = A.level;
  const dx = B.i - A.i;
  const dz = B.j - A.j;
  const steps = Math.ceil(Math.hypot(dx, dz) * 4);
  let ci = A.i;
  let cj = A.j;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const ni = Math.floor(A.i + 0.5 + dx * t);
    const nj = Math.floor(A.j + 0.5 + dz * t);
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
