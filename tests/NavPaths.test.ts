import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CoverIndex } from '../src/ai/CoverIndex';
import { generateCoverPoints } from '../src/ai/CoverPoints';
import { PathService } from '../src/ai/PathService';
import { VERDAN } from '../src/data/map';
import { buildMap } from '../src/world/MapBuilder';
import { NavGrid } from '../src/world/NavGrid';
import { clearLine, smoothPath } from '../src/world/NavPaths';

let nav: NavGrid;
let cover: CoverIndex;
beforeAll(() => {
  const built = buildMap(VERDAN);
  nav = new NavGrid(built.volumes, built.links, VERDAN.half);
  cover = new CoverIndex(generateCoverPoints(built.volumes, nav));
});

/** Every point along a ground segment lies on a walkable cell. */
function walkableAlong(a: THREE.Vector3, b: THREE.Vector3): boolean {
  const steps = Math.ceil(a.distanceTo(b) * 4);
  for (let s = 0; s <= steps; s++) {
    const p = a.clone().lerp(b, s / steps);
    const n = nav.node(p.x, p.y, p.z);
    if (n === null || !nav.walkable(n)) return false;
  }
  return true;
}

const ROUTES: [THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(0, 0, 164), new THREE.Vector3(-120, 0, 96)],
  [new THREE.Vector3(-120, 0, 96), new THREE.Vector3(0, 0, 8)],
  [new THREE.Vector3(0, 0, 8), new THREE.Vector3(120, 0, -96)],
  [new THREE.Vector3(120, 0, 141), new THREE.Vector3(-120, 0, -141)],
];

describe('path smoothing', () => {
  it('keeps far fewer points and stays on walkable ground', () => {
    for (const [from, to] of ROUTES) {
      const path = nav.findPath(from, to)!;
      const smooth = smoothPath(nav, path);
      expect(smooth.length).toBeLessThan(path.length / 4);
      expect(smooth[0].distanceTo(nav.position(path[0]))).toBeLessThan(1e-6);
      expect(smooth[smooth.length - 1].distanceTo(nav.position(path[path.length - 1]))).toBeLessThan(1e-6);
      for (let i = 1; i < smooth.length; i++) {
        // Stair segments change height; ground segments must be walkable throughout.
        if (Math.abs(smooth[i].y - smooth[i - 1].y) < 0.5) expect(walkableAlong(smooth[i - 1], smooth[i]), `${from.toArray()} segment ${i}`).toBe(true);
      }
    }
  });

  it('refuses lines through walls', () => {
    // Inside the depot office vs. outside it: a straight line would cross a wall.
    const a = nav.nearestWalkable(new THREE.Vector3(-150, 0, 120))!;
    const b = nav.nearestWalkable(new THREE.Vector3(-150, 0, 105))!;
    expect(clearLine(nav, a, b)).toBe(false);
    expect(clearLine(nav, a, a)).toBe(true);
  });

  it('queues searches and runs a few per frame', () => {
    const service = new PathService(nav, 2);
    const results: (THREE.Vector3[] | null)[] = [];
    for (const [from, to] of ROUTES) service.request(from, to, (p) => results.push(p));
    const cancelled = service.request(ROUTES[0][0], ROUTES[0][1], () => results.push(null));
    cancelled.cancelled = true;
    service.update();
    expect(results).toHaveLength(2);
    service.update();
    service.update();
    expect(results).toHaveLength(4);
    expect(results.every((r) => r && r.length > 1)).toBe(true);
    expect(service.pending).toBe(0);
  });
});

describe('cover index', () => {
  it('finds the same nearest cover as a full scan', () => {
    const queries = [new THREE.Vector3(0, 0, 20), new THREE.Vector3(-120, 0, 120), new THREE.Vector3(118, 0, -125), new THREE.Vector3(60, 0, 60)];
    for (const q of queries) {
      const found = cover.best(q, 15);
      let brute = null;
      let bd = Infinity;
      for (const p of cover.points) {
        const d = Math.hypot(p.pos.x - q.x, p.pos.z - q.z);
        if (d <= 15 && Math.abs(p.pos.y - q.y) < 1.5 && d < bd) {
          bd = d;
          brute = p;
        }
      }
      expect(found).toBe(brute);
    }
  });
});
