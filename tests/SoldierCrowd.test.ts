import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CROWD } from '../src/data/crowd';
import { VERDAN } from '../src/data/map';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { SoldierCrowd } from '../src/scenes/SoldierCrowd';
import { addVolumeColliders } from '../src/world/colliders';
import { buildMap } from '../src/world/MapBuilder';
import { NavGrid } from '../src/world/NavGrid';

const DT = 1 / 60;
let crowd: SoldierCrowd;
let nav: NavGrid;
let physics: PhysicsWorld;
const camera = new THREE.PerspectiveCamera();

beforeAll(async () => {
  const built = buildMap(VERDAN);
  nav = new NavGrid(built.volumes, built.links, VERDAN.half);
  physics = await PhysicsWorld.create();
  addVolumeColliders(physics, built.volumes);
  crowd = new SoldierCrowd(physics, new THREE.Scene(), nav, VERDAN);
  camera.position.set(0, 1.7, 30);
});

describe('32-soldier crowd on the map', () => {
  it('spawns 16 soldiers per team', () => {
    expect(crowd.soldiers).toHaveLength(CROWD.perTeam * 2);
    expect(crowd.soldiers.filter((s) => s.team === 'blue')).toHaveLength(CROWD.perTeam);
  });

  it('walks, keeps everyone on walkable ground, and animates cheaply', () => {
    const start = crowd.soldiers.map((s) => s.position.clone());
    let worstFrameMs = 0;
    let totalMs = 0;
    const frames = 20 * 60;
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      crowd.fixedUpdate(DT);
      crowd.update(DT, camera);
      const ms = performance.now() - t0;
      totalMs += ms;
      if (f > 60) worstFrameMs = Math.max(worstFrameMs, ms);
      physics.world.step();
      if (f % 30 === 0) {
        for (const s of crowd.soldiers) {
          const n = nav.node(s.position.x, s.position.y, s.position.z);
          expect(n !== null && nav.walkable(n), `${s.label} at ${s.position.toArray().map((v) => v.toFixed(1))}`).toBe(true);
        }
      }
    }
    // Each team's first soldiers are its walkers.
    const walkers = [0, CROWD.perTeam].flatMap((first) => Array.from({ length: CROWD.walkersPerTeam }, (_, i) => first + i));
    const moved = walkers.filter((i) => crowd.soldiers[i].position.distanceTo(start[i]) > 20);
    expect(moved.length).toBe(walkers.length);
    console.log(`crowd update: ${(totalMs / frames).toFixed(2)} ms average, ${worstFrameMs.toFixed(2)} ms worst`);
    expect(totalMs / frames).toBeLessThan(4);
  }, 120_000);
});
