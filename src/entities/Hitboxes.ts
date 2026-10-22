import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { HitZone } from '../data/ballistics';
import { COLLISION, type Hittable } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

export interface HitboxDef {
  zone: HitZone;
  size: readonly [number, number, number];
  /** Center, relative to `origin`. */
  pos: readonly [number, number, number];
}

/** Sensor colliders that only bullets see (plan section 9). Each is tagged with its owner and zone. */
export class Hitboxes {
  private readonly colliders: RAPIER.Collider[] = [];

  constructor(
    private readonly physics: PhysicsWorld,
    owner: Hittable,
    defs: readonly HitboxDef[],
    origin: THREE.Vector3,
  ) {
    const { rapier, world } = physics;
    for (const d of defs) {
      const c = world.createCollider(
        rapier.ColliderDesc.cuboid(d.size[0] / 2, d.size[1] / 2, d.size[2] / 2)
          .setTranslation(origin.x + d.pos[0], origin.y + d.pos[1], origin.z + d.pos[2])
          .setSensor(true)
          .setCollisionGroups(COLLISION.hitbox),
      );
      physics.tags.set(c.handle, { kind: 'hitbox', owner, zone: d.zone });
      this.colliders.push(c);
    }
  }

  /** Moves hitbox `index` (in definition order), e.g. to follow an animated bone. */
  place(index: number, pos: THREE.Vector3, rot: THREE.Quaternion): void {
    const c = this.colliders[index];
    c.setTranslation(pos);
    c.setRotation(rot);
  }

  setEnabled(enabled: boolean): void {
    for (const c of this.colliders) c.setEnabled(enabled);
  }

  dispose(): void {
    for (const c of this.colliders) {
      this.physics.tags.delete(c.handle);
      this.physics.world.removeCollider(c, false);
    }
    this.colliders.length = 0;
  }
}
