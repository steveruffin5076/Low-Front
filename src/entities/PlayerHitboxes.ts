import * as THREE from 'three';
import { MOVEMENT, PLAYER_HITBOXES } from '../data/player';
import type { Hittable, ZoneHit } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Hitboxes } from './Hitboxes';

const pos = new THREE.Vector3();
const rot = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The player as a bullet target: hitboxes around the first-person capsule that follow its
 * position, facing and crouch. Hits go to `onHit` (the play session applies the damage).
 */
export class PlayerHitboxes implements Hittable {
  private readonly hitboxes: Hitboxes;

  constructor(
    physics: PhysicsWorld,
    readonly label: string,
    readonly team: 'blue' | 'red' | undefined,
    readonly combatantId: string | undefined,
    private readonly onHit: (hit: ZoneHit) => void,
  ) {
    this.hitboxes = new Hitboxes(physics, this, PLAYER_HITBOXES, new THREE.Vector3(0, -100, 0));
  }

  applyHit(hit: ZoneHit): void {
    this.onHit(hit);
  }

  /** Moves the boxes to the player: `crouch` is the 0–1 crouch blend. */
  follow(feet: THREE.Vector3, yaw: number, crouch: number): void {
    const scale = THREE.MathUtils.lerp(1, MOVEMENT.crouchHeight / MOVEMENT.standHeight, crouch);
    rot.setFromAxisAngle(UP, yaw);
    PLAYER_HITBOXES.forEach((h, i) => {
      pos.set(h.pos[0], h.pos[1] * scale, h.pos[2]).applyQuaternion(rot).add(feet);
      this.hitboxes.place(i, pos, rot);
    });
  }

  setEnabled(on: boolean): void {
    this.hitboxes.setEnabled(on);
  }

  dispose(): void {
    this.hitboxes.dispose();
  }
}
