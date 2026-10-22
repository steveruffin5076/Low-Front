import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VERDAN } from '../src/data/map';
import type { FlagId } from '../src/data/map/types';
import { generateCoverPoints } from '../src/ai/CoverPoints';
import { buildMap, type BuiltMap } from '../src/world/MapBuilder';
import { NavGrid } from '../src/world/NavGrid';

let built: BuiltMap;
let nav: NavGrid;
const V = (x: number, z: number, y = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);

beforeAll(() => {
  built = buildMap(VERDAN);
  nav = new NavGrid(built.volumes, built.links, VERDAN.half);
});

/** A walkable spot inside a flag's capture area (the C flag stands in the fountain). */
function flagArea(id: FlagId): THREE.Vector3 {
  const f = VERDAN.flags.find((x) => x.id === id)!;
  return id === 'C' ? V(f.x, f.z + 8) : V(f.x, f.z);
}

describe('map data', () => {
  it('places the flags point-symmetric (A↔E, B↔D, C in the center)', () => {
    const at = (id: FlagId) => VERDAN.flags.find((f) => f.id === id)!;
    expect([at('A').x, at('A').z]).toEqual([-at('E').x, -at('E').z]);
    expect([at('B').x, at('B').z]).toEqual([-at('D').x, -at('D').z]);
    expect([at('C').x, at('C').z]).toEqual([0, 0]);
  });

  it('has 8 different enterable buildings', () => {
    expect(new Set(VERDAN.enterables.map((e) => e.plan)).size).toBe(8);
  });

  it('gives each flag 6 spawn points 15–30 m away, on walkable ground', () => {
    for (const f of VERDAN.flags) {
      const spawns = VERDAN.flagSpawns[f.id];
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

  it('mirrors the HQs and puts every HQ spawn on walkable ground', () => {
    const [blue, red] = VERDAN.hqs;
    expect(red.rect).toEqual({ x0: -blue.rect.x1, z0: -blue.rect.z1, x1: -blue.rect.x0, z1: -blue.rect.z0 });
    for (const hq of VERDAN.hqs) {
      for (const s of hq.spawns) {
        const n = nav.node(s.x, 0, s.z);
        expect(n !== null && nav.walkable(n), `${hq.team} spawn (${s.x}, ${s.z})`).toBe(true);
      }
    }
  });

  it('keeps everything except the boundary ring inside the playable area', () => {
    const inside = (x: number, z: number) => Math.abs(x) <= VERDAN.half && Math.abs(z) <= VERDAN.half;
    for (const b of VERDAN.solids) expect(inside(b.x, b.z), `solid ${b.x},${b.z}`).toBe(true);
    for (const p of VERDAN.props) expect(inside(p.x, p.z), `${p.type} ${p.x},${p.z}`).toBe(true);
    for (const b of VERDAN.boundary.solids) expect(inside(b.x, b.z), `boundary ${b.x},${b.z}`).toBe(false);
  });

  it('keeps buildings off the streets', () => {
    for (const b of VERDAN.solids) {
      for (const s of VERDAN.streets) {
        const overlap = b.x - b.w / 2 < s.rect.x1 - 0.01 && b.x + b.w / 2 > s.rect.x0 + 0.01 && b.z - b.d / 2 < s.rect.z1 - 0.01 && b.z + b.d / 2 > s.rect.z0 + 0.01;
        expect(overlap, `solid at ${b.x},${b.z} on street ${JSON.stringify(s.rect)}`).toBe(false);
      }
    }
  });
});

describe('navigation', () => {
  it('connects every stair and bridge link', () => {
    expect(nav.brokenLinks).toEqual([]);
    expect(built.links.length).toBeGreaterThan(15);
  });

  it('reaches every flag and the enemy HQ from Blue HQ', () => {
    const blue = V(0, 164);
    for (const f of VERDAN.flags) expect(nav.findPath(blue, flagArea(f.id)), f.id).not.toBeNull();
    expect(nav.findPath(blue, V(0, -164))).not.toBeNull();
  });

  it('reaches every upper floor and roof that has stairs', () => {
    const blue = V(0, 164);
    for (const l of built.links) expect(nav.findPath(blue, l.b), `link top ${l.b.toArray()}`).not.toBeNull();
  });

  it('has at least 3 separate routes between neighboring flags', () => {
    const pairs: [FlagId, FlagId][] = [['A', 'C'], ['B', 'C'], ['D', 'C'], ['E', 'C'], ['A', 'B'], ['D', 'E'], ['A', 'D'], ['B', 'E']];
    for (const [a, b] of pairs) {
      const pa = flagArea(a);
      const pb = flagArea(b);
      const blocked = new Set<number>();
      for (let route = 1; route <= 3; route++) {
        const path = nav.findPath(pa, pb, blocked);
        expect(path, `${a}–${b} route ${route}`).not.toBeNull();
        // Block a corridor around this route (outside the flag areas) to force a different one.
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

  it('generates cover points, both low and high', () => {
    const cover = generateCoverPoints(built.volumes, nav);
    expect(cover.length).toBeGreaterThan(1000);
    expect(cover.some((c) => c.high)).toBe(true);
    expect(cover.some((c) => !c.high)).toBe(true);
    for (const c of cover.slice(0, 200)) {
      const n = nav.node(c.pos.x, c.pos.y, c.pos.z);
      expect(n !== null && nav.walkable(n)).toBe(true);
    }
  });
});
