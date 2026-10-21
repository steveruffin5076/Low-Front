import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEAPONS } from '../src/data/weapons';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { COLLISION, type Hittable, type ZoneHit } from '../src/physics/collision';
import { Ballistics, type BulletHit } from '../src/weapons/Ballistics';
import { Hitboxes } from '../src/entities/Hitboxes';
import { hitDamage } from '../src/weapons/Damage';
import { CharacterMotor } from '../src/physics/CharacterMotor';

let physics: PhysicsWorld;
const hits: BulletHit[] = [];
const target: Hittable & { got: ZoneHit[] } = { label: 't', got: [], applyHit(h) { this.got.push(h); } };

beforeAll(async () => {
  physics = await PhysicsWorld.create();
  const { rapier, world } = physics;
  const wall = world.createCollider(rapier.ColliderDesc.cuboid(5, 5, 0.5).setTranslation(0, 0, -60.5).setCollisionGroups(COLLISION.world));
  physics.tags.set(wall.handle, { kind: 'surface', surface: 'metal' });
  new Hitboxes(physics, target, [
    { zone: 'head', size: [0.3, 0.3, 0.3], pos: [0, 1.6, 0] },
    { zone: 'torso', size: [0.5, 0.6, 0.3], pos: [0, 1.15, 0] },
  ], new THREE.Vector3(10, 0, -50));
  // The shooter's own capsule at the origin must not block bullets.
  new CharacterMotor(physics, new THREE.Vector3(0, 0, -1));
  world.step();
});

function shoot(from: THREE.Vector3, to: THREE.Vector3): BulletHit | undefined {
  const b = new Ballistics(physics);
  hits.length = 0;
  b.events.on('hit', (h) => hits.push(h));
  b.fire(from, to.clone().sub(from), WEAPONS.m4a1, false, new THREE.Vector3());
  for (let i = 0; i < 120 && hits.length === 0; i++) b.fixedUpdate(1 / 60);
  return hits[0];
}

describe('Ballistics', () => {
  it('hits the wall at the right distance with its surface tag', () => {
    const h = shoot(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -60));
    expect(h).toBeDefined();
    expect(h!.distance).toBeCloseTo(60, 1);
    expect(h!.tag).toEqual({ kind: 'surface', surface: 'metal' });
    // Bullet drop over 60 m at 880 m/s is about 2 cm.
    expect(h!.point.y).toBeLessThan(0);
    expect(h!.point.y).toBeGreaterThan(-0.05);
  });

  it('reports the hitbox zone and owner', () => {
    const from = new THREE.Vector3(10, 1.6, 0);
    const head = shoot(from, new THREE.Vector3(10, 1.6, -50));
    expect(head?.tag).toMatchObject({ kind: 'hitbox', zone: 'head', owner: target });
    const torso = shoot(new THREE.Vector3(10, 1.15, 0), new THREE.Vector3(10, 1.15, -50));
    expect(torso?.tag).toMatchObject({ kind: 'hitbox', zone: 'torso' });
    expect(hitDamage(WEAPONS.m4a1, torso!.distance, 'torso')).toBeCloseTo(26.1, 0);
  });

  it('expires after the max lifetime', () => {
    const b = new Ballistics(physics);
    b.fire(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, 1, 0), WEAPONS.m1911, false, new THREE.Vector3());
    for (let i = 0; i < 125; i++) b.fixedUpdate(1 / 60);
    expect(b.bullets.some((x) => x.active)).toBe(false);
  });
});
