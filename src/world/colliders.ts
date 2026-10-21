import * as THREE from 'three';
import { COLLISION } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { volumeQuaternion, type Volume } from './Volume';

const q = new THREE.Quaternion();

/** One static Rapier cuboid per volume, tagged with its surface for impacts and footsteps. */
export function addVolumeColliders(physics: PhysicsWorld, volumes: readonly Volume[]): void {
  const { rapier, world } = physics;
  for (const v of volumes) {
    volumeQuaternion(v, q);
    const c = world.createCollider(
      rapier.ColliderDesc.cuboid(v.half.x, v.half.y, v.half.z)
        .setTranslation(v.center.x, v.center.y, v.center.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(COLLISION.world),
    );
    physics.tags.set(c.handle, { kind: 'surface', surface: v.surface });
  }
}
