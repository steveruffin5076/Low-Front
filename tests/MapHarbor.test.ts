import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HARBOR } from '../src/data/map/harbor';
import type { FlagId } from '../src/data/map/types';
import { generateCoverPoints } from '../src/ai/CoverPoints';
import { buildMap, type BuiltMap } from '../src/world/MapBuilder';
import { NavGrid } from '../src/world/NavGrid';

/** The second map: the same checks as Verdan (symmetry, spawns, reachability, routes, cover). */
let built: BuiltMap;
let nav: NavGrid;
const V = (x: number, z: number, y = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
const flag = (id: FlagId) => HARBOR.flags.find((f) => f.id === id)!;

beforeAll(() => {
  built = buildMap(HARBOR);
  nav = new NavGrid(built.volumes, built.links, HARBOR.half);
});

describe('Kessel Harbor map data', () => {
  it('places the flags point-symmetric', () => {
    expect([flag('A').x, flag('A').z]).toEqual([-flag('E').x, -flag('E').z]);
    expect([flag('B').x, flag('B').z]).toEqual([-flag('D').x, -flag('D').z]);
    expect([flag('C').x, flag('C').z]).toEqual([0, 0]);
  });

  it('gives each flag 6 spawn points 15–30 m away, on walkable ground', () => {
    for (const f of HARBOR.flags) {
      const spawns = HARBOR.flagSpawns[f.id];
      expect(spawns.length, f.id).toBe(6);
      for (const s of spawns) {
        const d = Math.hypot(s.x - f.x, s.z - f.z);
        expect(d, `${f.id} (${s.x}, ${s.z})`).toBeGreaterThanOrEqual(15);
        expect(d, `${f.id} (${s.x}, ${s.z})`).toBeLessThanOrEqual(30);
        const n = nav.node(s.x, 0.15, s.z);
        expect(n !== null && nav.walkable(n), `${f.id} spawn (${s.x}, ${s.z}) walkable`).toBe(true);
      }
    }
  });

  it('puts every HQ spawn on walkable ground', () => {
    for (const hq of HARBOR.hqs) {
      for (const s of hq.spawns) {
        const n = nav.node(s.x, 0, s.z);
        expect(n !== null && nav.walkable(n), `${hq.team} spawn (${s.x}, ${s.z})`).toBe(true);
      }
    }
  });

  it('keeps buildings off the streets and inside the map', () => {
    for (const b of HARBOR.solids) {
      expect(Math.abs(b.x) <= HARBOR.half && Math.abs(b.z) <= HARBOR.half).toBe(true);
      for (const s of HARBOR.streets) {
        const overlap = b.x - b.w / 2 < s.rect.x1 - 0.01 && b.x + b.w / 2 > s.rect.x0 + 0.01 && b.z - b.d / 2 < s.rect.z1 - 0.01 && b.z + b.d / 2 > s.rect.z0 + 0.01;
        expect(overlap, `solid at ${b.x},${b.z} on street ${JSON.stringify(s.rect)}`).toBe(false);
      }
    }
    for (const p of HARBOR.props) expect(Math.abs(p.x) <= HARBOR.half && Math.abs(p.z) <= HARBOR.half, `${p.type} ${p.x},${p.z}`).toBe(true);
  });
});

describe('Kessel Harbor navigation', () => {
  it('connects every stair link', () => {
    expect(nav.brokenLinks).toEqual([]);
  });

  it('reaches every flag area and the enemy HQ from Blue HQ', () => {
    const blue = V(0, 164);
    for (const f of HARBOR.flags) expect(nav.findPath(blue, V(f.x, f.z)), f.id).not.toBeNull();
    expect(nav.findPath(blue, V(0, -164))).not.toBeNull();
  });

  it('has at least 2 separate routes between neighboring flags', () => {
    const pairs: [FlagId, FlagId][] = [['A', 'C'], ['B', 'C'], ['D', 'C'], ['E', 'C'], ['A', 'B'], ['A', 'D'], ['B', 'E']];
    for (const [a, b] of pairs) {
      const pa = V(flag(a).x, flag(a).z);
      const pb = V(flag(b).x, flag(b).z);
      const blocked = new Set<number>();
      for (let route = 1; route <= 2; route++) {
        const path = nav.findPath(pa, pb, blocked);
        expect(path, `${a}–${b} route ${route}`).not.toBeNull();
        const p = new THREE.Vector3();
        for (const n of path!) {
          nav.position(n, p);
          if (p.distanceTo(pa) < 25 || p.distanceTo(pb) < 25) continue;
          const { level, i, j } = nav.decode(n);
          for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii >= 0 && jj >= 0 && ii < level.w && jj < level.h) blocked.add(level.base + jj * level.w + ii);
          }
        }
      }
    }
  });

  it('generates cover, both low and high', () => {
    const cover = generateCoverPoints(built.volumes, nav);
    expect(cover.length).toBeGreaterThan(500);
    expect(cover.some((c) => c.high)).toBe(true);
    expect(cover.some((c) => !c.high)).toBe(true);
  });
});
