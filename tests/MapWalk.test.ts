import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VERDAN } from '../src/data/map';
import { PlayerController, type PlayerIntent } from '../src/entities/PlayerController';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { addVolumeColliders } from '../src/world/colliders';
import { buildMap, type BuiltMap } from '../src/world/MapBuilder';
import { NavGrid } from '../src/world/NavGrid';
import { smoothPath } from '../src/world/NavPaths';

/**
 * Walks the real player controller (Rapier character controller, same code as the game)
 * along nav-grid paths across the map. Fails on stuck spots (no progress) and holes (falling
 * below the ground), and checks that every staircase leads up to its floor.
 */
let built: BuiltMap;
let nav: NavGrid;
let physics: PhysicsWorld;
const DT = 1 / 60;
const V = (x: number, z: number, y = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);

beforeAll(async () => {
  built = buildMap(VERDAN);
  nav = new NavGrid(built.volumes, built.links, VERDAN.half);
  physics = await PhysicsWorld.create();
  addVolumeColliders(physics, built.volumes);
  physics.world.step();
});

interface WalkResult {
  ok: boolean;
  reason: string;
  at: THREE.Vector3;
  seconds: number;
}

function walk(from: THREE.Vector3, to: THREE.Vector3, smooth = false): WalkResult {
  const path = nav.findPath(from, to);
  if (!path) return { ok: false, reason: 'no nav path', at: from, seconds: 0 };
  const points = smooth ? smoothPath(nav, path) : nav.pathPoints(path);
  const player = new PlayerController(physics, points[0].clone());
  const idle: PlayerIntent = { strafe: 0, forward: 1, sprint: false, ads: false, firing: false, leanLeft: false, leanRight: false, crouchPressed: false, jumpPressed: false };
  let target = 1;
  let bestTarget = 0;
  let bestD = Infinity;
  let sinceProgress = 0;
  const feet = player.motor.feet;
  let length = 0;
  for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
  const limit = (length * 1.3 + 30) / 4.5 + 20;
  try {
    for (let t = 0; t < limit; t += DT) {
      // Advance the target along the path once it is reached (no look-ahead: cutting a corner
      // would test the walker, not the map; path smoothing comes with the bots).
      while (target < points.length - 1 && Math.hypot(points[target].x - feet.x, points[target].z - feet.z) < 0.5 && Math.abs(points[target].y - feet.y) < 1.2) target++;
      const p = points[target];
      const d = Math.hypot(p.x - feet.x, p.z - feet.z);
      if (target === points.length - 1 && d < 1.0 && Math.abs(p.y - feet.y) < 0.6) return { ok: true, reason: '', at: feet.clone(), seconds: t };
      player.yaw = Math.atan2(-(p.x - feet.x), -(p.z - feet.z));
      player.fixedUpdate(DT, idle, 1);
      physics.world.step();
      if (feet.y < -1) return { ok: false, reason: 'fell through the floor', at: feet.clone(), seconds: t };
      // Progress: a later waypoint, or closer to the current one.
      if (target > bestTarget || d < bestD - 0.05) {
        if (target > bestTarget) bestD = Infinity;
        bestTarget = target;
        bestD = Math.min(bestD, d);
        sinceProgress = 0;
      } else if ((sinceProgress += DT) > 3) {
        return { ok: false, reason: `stuck heading to waypoint ${target}/${points.length} at ${p.toArray().map((v) => v.toFixed(1))}`, at: feet.clone(), seconds: t };
      }
    }
    return { ok: false, reason: 'timed out', at: feet.clone(), seconds: limit };
  } finally {
    physics.world.removeRigidBody((player.motor as unknown as { body: Parameters<typeof physics.world.removeRigidBody>[0] }).body);
  }
}

const describeRoute = (r: WalkResult): string => `${r.reason} at (${r.at.x.toFixed(1)}, ${r.at.y.toFixed(1)}, ${r.at.z.toFixed(1)})`;

describe('walking the map with the real player controller', () => {
  it('walks from Blue HQ to every flag and on to Red HQ', () => {
    const stops = [V(0, 164), V(-120, 96), V(0, 8), V(120, 141), V(120, -96), V(-120, -141), V(0, -164)];
    for (let i = 1; i < stops.length; i++) {
      const r = walk(stops[i - 1], stops[i]);
      expect(r.ok, `leg ${i}: ${describeRoute(r)}`).toBe(true);
    }
  }, 120_000);

  it('walks the smoothed paths the bots use', () => {
    const stops = [V(0, 164), V(-120, 96), V(0, 8), V(120, 141), V(120, -96), V(-120, -141), V(0, -164)];
    for (let i = 1; i < stops.length; i++) {
      const r = walk(stops[i - 1], stops[i], true);
      expect(r.ok, `smoothed leg ${i}: ${describeRoute(r)}`).toBe(true);
    }
  }, 120_000);

  it('climbs every staircase to its floor', () => {
    for (const l of built.links) {
      const start = l.a.clone();
      const r = walk(start, l.b);
      expect(r.ok, `stairs ${l.a.toArray().map((v) => v.toFixed(1))} → ${l.b.toArray().map((v) => v.toFixed(1))}: ${describeRoute(r)}`).toBe(true);
    }
  }, 120_000);

  it('walks down every staircase', () => {
    for (const l of built.links) {
      const r = walk(l.b.clone(), l.a);
      expect(r.ok, `stairs down ${l.b.toArray().map((v) => v.toFixed(1))} → ${l.a.toArray().map((v) => v.toFixed(1))}: ${describeRoute(r)}`).toBe(true);
    }
  }, 120_000);
});
