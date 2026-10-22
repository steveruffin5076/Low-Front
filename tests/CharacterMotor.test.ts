import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { COLLISION } from '../src/physics/collision';
import { PlayerController } from '../src/entities/PlayerController';

const idle = { strafe: 0, forward: 0, sprint: false, ads: false, firing: false, leanLeft: false, leanRight: false, crouchPressed: false, jumpPressed: false };

async function settle(spawn: THREE.Vector3, seconds: number): Promise<PlayerController> {
  const physics = await PhysicsWorld.create();
  const { rapier, world } = physics;
  world.createCollider(rapier.ColliderDesc.cuboid(130, 0.5, 130).setTranslation(0, -0.5, 0).setCollisionGroups(COLLISION.world));
  const p = new PlayerController(physics, spawn);
  for (let i = 0; i < seconds * 60; i++) {
    p.fixedUpdate(1 / 60, idle, 1);
    world.step();
  }
  return p;
}

describe('CharacterMotor', () => {
  // Rapier lets a capsule sink through a large box when it stands exactly above the box center.
  it('does not sink when standing over the center of a large ground box', async () => {
    const p = await settle(new THREE.Vector3(0, 0, 0), 10);
    expect(p.motor.feet.y).toBeGreaterThan(-0.02);
    expect(p.grounded).toBe(true);
  });

  it('stands on the ground elsewhere', async () => {
    const p = await settle(new THREE.Vector3(5, 0, 10), 5);
    expect(Math.abs(p.motor.feet.y)).toBeLessThan(0.03);
  });
});
