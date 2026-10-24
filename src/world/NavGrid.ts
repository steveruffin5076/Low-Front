import * as THREE from 'three';
import { NAV } from '../data/nav';
import type { NavLink } from './LocalFrame';
import { MinHeap } from './MinHeap';
import { labelRegions, nearestInRegion } from './NavPaths';
import { footprintOverlaps, volumeBounds, type Volume } from './Volume';

/** One floor level of the grid (ground, first floor, rooftops, …). */
export interface NavLevel {
  /** Nominal floor height of the level. */
  y: number;
  /** Cell (0, 0) covers x0…x0+1, z0…z0+1. */
  x0: number;
  z0: number;
  w: number;
  h: number;
  walk: Uint8Array;
  floorY: Float32Array;
  /** Per cell, one bit per neighbor direction ((dj + 1) * 3 + di + 1) that a thin wall blocks. */
  blockedDirs: Uint16Array;
  /** First node id of this level. */
  base: number;
}

interface Indexed {
  v: Volume;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface Edge {
  to: number;
  cost: number;
  /** Points along a stair or ramp link, in travel order. */
  via?: THREE.Vector3[];
}

/**
 * 1 m navigation grid per floor level, rasterized from the collision volumes (plan section 10.6):
 * a cell is walkable when a floor supports it and a soldier-sized capsule fits above it.
 * Stair and ramp links connect levels. A* finds paths; `NavPaths` smooths them.
 */
export class NavGrid {
  readonly levels: NavLevel[] = [];
  readonly linkEdges = new Map<number, Edge[]>();
  /** Links that could not be connected (both ends must land on walkable cells). */
  readonly brokenLinks: NavLink[] = [];
  private readonly buckets = new Map<string, Indexed[]>();
  /** Connected area id per node (−1: not walkable). Links count as connections both ways. */
  region: Int32Array = new Int32Array(0);
  // A* scratch arrays, reused between searches.
  private gScore = new Float64Array(0);
  private came = new Int32Array(0);
  private seen = new Uint32Array(0);
  private searchStamp = 0;

  constructor(volumes: readonly Volume[], links: readonly NavLink[], half: number) {
    for (const v of volumes) this.index(v);
    this.addLevel(0, -half, -half, half, half, volumes);
    // Upper levels: one per distinct floor top above ground, covering those floors.
    const groups = new Map<number, Indexed[]>();
    for (const list of this.buckets.values()) {
      for (const e of list) {
        if (e.v.kind !== 'floor' || e.max.y <= NAV.step + 0.1) continue;
        const key = Math.round(e.max.y * 10) / 10;
        const g = groups.get(key) ?? [];
        if (!g.includes(e)) g.push(e);
        groups.set(key, g);
      }
    }
    for (const [y, g] of [...groups].sort((a, b) => a[0] - b[0])) {
      const x0 = Math.max(-half, Math.min(...g.map((e) => e.min.x)) - 1);
      const z0 = Math.max(-half, Math.min(...g.map((e) => e.min.z)) - 1);
      const x1 = Math.min(half, Math.max(...g.map((e) => e.max.x)) + 1);
      const z1 = Math.min(half, Math.max(...g.map((e) => e.max.z)) + 1);
      if (x1 > x0 && z1 > z0) this.addLevel(y, x0, z0, x1, z1, volumes);
    }
    for (const l of links) this.addLink(l);
    this.region = labelRegions(this);
  }

  get nodeCount(): number {
    const last = this.levels[this.levels.length - 1];
    return last.base + last.w * last.h;
  }

  // --- Building ---

  private index(v: Volume): void {
    const b = volumeBounds(v);
    const e: Indexed = { v, min: b.min.clone(), max: b.max.clone() };
    const s = NAV.bucket;
    const r = NAV.radius;
    for (let bx = Math.floor((b.min.x - r) / s); bx <= Math.floor((b.max.x + r) / s); bx++) {
      for (let bz = Math.floor((b.min.z - r) / s); bz <= Math.floor((b.max.z + r) / s); bz++) {
        const key = `${bx},${bz}`;
        const list = this.buckets.get(key) ?? [];
        list.push(e);
        this.buckets.set(key, list);
      }
    }
  }

  private near(x: number, z: number): readonly Indexed[] {
    return this.buckets.get(`${Math.floor(x / NAV.bucket)},${Math.floor(z / NAV.bucket)}`) ?? [];
  }

  private addLevel(y: number, ax0: number, az0: number, ax1: number, az1: number, _volumes: readonly Volume[]): void {
    const x0 = Math.floor(ax0);
    const z0 = Math.floor(az0);
    const w = Math.ceil(ax1) - x0;
    const h = Math.ceil(az1) - z0;
    const prev = this.levels[this.levels.length - 1];
    const level: NavLevel = { y, x0, z0, w, h, walk: new Uint8Array(w * h), floorY: new Float32Array(w * h), blockedDirs: new Uint16Array(w * h), base: prev ? prev.base + prev.w * prev.h : 0 };
    const ground = y === 0;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const cx = x0 + i + 0.5;
        const cz = z0 + j + 0.5;
        const vols = this.near(cx, cz);
        // Support: the highest floor near this level's height under the cell center.
        let floor = ground ? 0 : -Infinity;
        for (const e of vols) {
          const top = e.max.y;
          if (ground ? top > NAV.step + 0.05 : Math.abs(top - y) > NAV.levelTolerance) continue;
          if (!ground && e.v.kind !== 'floor') continue;
          if (e.v.kind === 'ramp') continue;
          if (top > floor && footprintOverlaps(e.v, cx, cz, 0.01)) floor = top;
        }
        if (floor === -Infinity) continue;
        // Clearance: nothing in the body band above the floor within the soldier radius.
        const lo = floor + NAV.step;
        const hi = floor + NAV.height;
        let blocked = false;
        for (const e of vols) {
          if (e.max.y <= lo || e.min.y >= hi) continue;
          if (footprintOverlaps(e.v, cx, cz, NAV.radius)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          level.walk[j * w + i] = 1;
          level.floorY[j * w + i] = floor;
        }
      }
    }
    this.blockThinWalls(level);
    this.levels.push(level);
  }

  /**
   * Two neighboring cells can both have clearance while a thin wall (0.3 m) runs between them.
   * Marks such moves as blocked by sampling the segment between the cell centers.
   */
  private blockThinWalls(level: NavLevel): void {
    const { w, h, x0, z0 } = level;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!level.walk[k]) continue;
        const cx = x0 + i + 0.5;
        const cz = z0 + j + 0.5;
        const y = level.floorY[k];
        // Only half of the directions; the reverse move is marked on the neighbor.
        for (const [di, dj] of HALF_DIRS) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
          const kk = jj * w + ii;
          if (!level.walk[kk]) continue;
          const lo = Math.max(y, level.floorY[kk]) + NAV.step;
          const hi = Math.min(y, level.floorY[kk]) + NAV.height;
          let blocked = false;
          for (const t of SAMPLES) {
            const px = cx + di * t;
            const pz = cz + dj * t;
            for (const e of this.near(px, pz)) {
              if (e.max.y <= lo || e.min.y >= hi) continue;
              if (footprintOverlaps(e.v, px, pz, WALL_SAMPLE_RADIUS)) {
                blocked = true;
                break;
              }
            }
            if (blocked) break;
          }
          if (blocked) {
            level.blockedDirs[k] |= 1 << dirBit(di, dj);
            level.blockedDirs[kk] |= 1 << dirBit(-di, -dj);
          }
        }
      }
    }
  }

  private addLink(l: NavLink): void {
    const a = this.nearestWalkable(l.a);
    const b = this.nearestWalkable(l.b);
    if (a === null || b === null) {
      this.brokenLinks.push(l);
      return;
    }
    let cost = 0;
    const pts = [l.a, ...l.via, l.b];
    for (let i = 1; i < pts.length; i++) cost += pts[i].distanceTo(pts[i - 1]);
    // The exact link ends are waypoints too: cell centers can sit beside the flight.
    const forward = [l.a, ...l.via, l.b];
    for (const [from, to, via] of [[a, b, forward], [b, a, [...forward].reverse()]] as const) {
      const list = this.linkEdges.get(from) ?? [];
      list.push({ to, cost, via });
      this.linkEdges.set(from, list);
    }
  }

  // --- Queries ---

  /** Level whose floor at (x, z) is closest to y, and the node there (walkable or not). */
  node(x: number, y: number, z: number): number | null {
    let best: number | null = null;
    let bestDy = Infinity;
    for (const l of this.levels) {
      const i = Math.floor(x - l.x0);
      const j = Math.floor(z - l.z0);
      if (i < 0 || j < 0 || i >= l.w || j >= l.h) continue;
      const k = j * l.w + i;
      const fy = l.walk[k] ? l.floorY[k] : l.y;
      const dy = Math.abs(fy - y);
      if (dy < bestDy && dy < 1.5) {
        bestDy = dy;
        best = l.base + k;
      }
    }
    return best;
  }

  nearestWalkable(p: THREE.Vector3, maxDist: number = NAV.linkSnap): number | null {
    const n = this.node(p.x, p.y, p.z);
    if (n === null) return null;
    if (this.walkable(n)) return n;
    const { level, i, j } = this.decode(n);
    const r = Math.ceil(maxDist);
    let best: number | null = null;
    let bestD = Infinity;
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= level.w || jj >= level.h) continue;
        const k = jj * level.w + ii;
        const d = Math.hypot(di, dj);
        if (level.walk[k] && d < bestD && d <= maxDist && Math.abs(level.floorY[k] - p.y) < 1) {
          bestD = d;
          best = level.base + k;
        }
      }
    }
    return best;
  }

  walkable(n: number): boolean {
    const { level, k } = this.decode(n);
    return level.walk[k] === 1;
  }

  decode(n: number): { level: NavLevel; levelIndex: number; k: number; i: number; j: number } {
    let li = this.levels.length - 1;
    while (li > 0 && this.levels[li].base > n) li--;
    const level = this.levels[li];
    const k = n - level.base;
    return { level, levelIndex: li, k, i: k % level.w, j: Math.floor(k / level.w) };
  }

  position(n: number, out = new THREE.Vector3()): THREE.Vector3 {
    const { level, k, i, j } = this.decode(n);
    return out.set(level.x0 + i + 0.5, level.floorY[k], level.z0 + j + 0.5);
  }

  /** Walkable neighbors with move costs (8 directions, no corner cutting, step limit) plus links. */
  neighbors(n: number, out: Edge[] = []): Edge[] {
    out.length = 0;
    const { level, k, i, j } = this.decode(n);
    const y = level.floorY[k];
    const blockedDirs = level.blockedDirs[k];
    const ok = (ii: number, jj: number): boolean => {
      if (ii < 0 || jj < 0 || ii >= level.w || jj >= level.h) return false;
      if (blockedDirs & (1 << dirBit(ii - i, jj - j))) return false;
      const kk = jj * level.w + ii;
      return level.walk[kk] === 1 && Math.abs(level.floorY[kk] - y) <= NAV.step;
    };
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        if (!ok(i + di, j + dj)) continue;
        if (di && dj && !(ok(i + di, j) && ok(i, j + dj))) continue;
        out.push({ to: level.base + (j + dj) * level.w + (i + di), cost: di && dj ? Math.SQRT2 : 1 });
      }
    }
    const links = this.linkEdges.get(n);
    if (links) out.push(...links);
    return out;
  }

  /** One grid move from cell (i, j) by (di, dj) on `level`: walkable, within step height, no thin wall. */
  canStep(level: NavLevel, i: number, j: number, di: number, dj: number): boolean {
    const ii = i + di;
    const jj = j + dj;
    if (i < 0 || j < 0 || i >= level.w || j >= level.h || ii < 0 || jj < 0 || ii >= level.w || jj >= level.h) return false;
    const k = j * level.w + i;
    const kk = jj * level.w + ii;
    if (!level.walk[k] || !level.walk[kk]) return false;
    if (level.blockedDirs[k] & (1 << dirBit(di, dj))) return false;
    return Math.abs(level.floorY[kk] - level.floorY[k]) <= NAV.step;
  }

  /** World points for a node path, with the stair waypoints of any links inserted. */
  pathPoints(path: readonly number[]): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < path.length; i++) {
      if (i > 0) {
        const link = this.linkEdges.get(path[i - 1])?.find((e) => e.to === path[i]);
        if (link?.via) out.push(...link.via.map((v) => v.clone()));
      }
      out.push(this.position(path[i]));
    }
    return out;
  }

  /**
   * A* from `from` to `to` (world positions). `blocked` marks extra impassable nodes (tests use
   * it to find other routes). `weight` > 1 trades a little path length for much less search
   * (bots use it; paths are smoothed anyway); `maxExpand` caps the work. A goal in another
   * region (an unreachable island) snaps to the nearest reachable cell. Returns node ids, or null.
   */
  findPath(from: THREE.Vector3, to: THREE.Vector3, blocked?: Set<number>, weight = 1, maxExpand = Infinity): number[] | null {
    const start = this.nearestWalkable(from);
    if (start === null) return null;
    let goal = this.nearestWalkable(to);
    if (goal === null || this.region[goal] !== this.region[start]) goal = nearestInRegion(this, to, this.region[start], NAV.goalSnap);
    if (goal === null) return null;
    const goalPos = this.position(goal);
    const count = this.nodeCount;
    if (this.gScore.length < count) {
      this.gScore = new Float64Array(count);
      this.came = new Int32Array(count);
      this.seen = new Uint32Array(count);
    }
    const stamp = ++this.searchStamp;
    // seen[n] === stamp: open or closed in this search; closed nodes get stamp + 2^31.
    const CLOSED = 0x80000000;
    const g = this.gScore;
    const came = this.came;
    const seen = this.seen;
    const heap = new MinHeap();
    const tmp = new THREE.Vector3();
    const h = (n: number): number => {
      this.position(n, tmp);
      const dx = Math.abs(tmp.x - goalPos.x);
      const dz = Math.abs(tmp.z - goalPos.z);
      return weight * (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz) + Math.abs(tmp.y - goalPos.y));
    };
    g[start] = 0;
    came[start] = -1;
    seen[start] = stamp;
    heap.push(start, h(start));
    const edges: Edge[] = [];
    let expanded = 0;
    while (heap.size) {
      const n = heap.pop();
      if (n === goal) {
        const path = [n];
        for (let c = came[n]; c !== -1; c = came[c]) path.push(c);
        return path.reverse();
      }
      if (seen[n] === ((stamp | CLOSED) >>> 0)) continue;
      seen[n] = (stamp | CLOSED) >>> 0;
      if (++expanded > maxExpand) return null;
      const gn = g[n];
      for (const e of this.neighbors(n, edges)) {
        if (blocked?.has(e.to)) continue;
        const st = seen[e.to];
        if (st === ((stamp | CLOSED) >>> 0)) continue;
        const ng = gn + e.cost;
        if (st !== stamp || ng < g[e.to]) {
          g[e.to] = ng;
          came[e.to] = n;
          seen[e.to] = stamp;
          heap.push(e.to, ng + h(e.to));
        }
      }
    }
    return null;
  }

}

/** East, south and the two southern diagonals; the other four are their reverses. */
const HALF_DIRS = [[1, 0], [0, 1], [1, 1], [-1, 1]] as const;
/** Points along a move (fraction of the cell step) checked against thin walls. */
const SAMPLES = [0.25, 0.5, 0.75];
const WALL_SAMPLE_RADIUS = 0.05;

function dirBit(di: number, dj: number): number {
  return (dj + 1) * 3 + di + 1;
}
