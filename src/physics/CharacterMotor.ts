import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { MOVEMENT } from '../data/player';
import { COLLISION } from './collision';
import type { PhysicsWorld } from './PhysicsWorld';

const DOWN = new THREE.Vector3(0, -1, 0);
const tmpOrigin = new THREE.Vector3();
/** How far below the feet the floor probe looks, and how deep the feet may sink before correction (m). */
const FLOOR_PROBE = 0.05;
const FLOOR_TOLERANCE = 0.005;

/**
 * Capsule character on a kinematic body, moved by Rapier's character controller
 * (step climbing, slope limit, snap to ground). Positions are measured at the feet.
 */
export class CharacterMotor {
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;
  private height: number = MOVEMENT.standHeight;
  readonly feet = new THREE.Vector3();
  grounded = false;

  constructor(
    private readonly physics: PhysicsWorld,
    feet: THREE.Vector3,
  ) {
    const { rapier, world } = physics;
    this.feet.copy(feet);
    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(feet.x, feet.y + this.height / 2, feet.z),
    );
    this.collider = world.createCollider(
      rapier.ColliderDesc.capsule(this.halfSegment(this.height), MOVEMENT.radius).setCollisionGroups(COLLISION.player),
      this.body,
    );
    this.controller = world.createCharacterController(MOVEMENT.controllerOffset);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setMaxSlopeClimbAngle((MOVEMENT.maxSlopeDeg * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((MOVEMENT.maxSlopeDeg * Math.PI) / 180);
    this.controller.enableAutostep(MOVEMENT.stepHeight, MOVEMENT.stepMinWidth, false);
    this.controller.enableSnapToGround(MOVEMENT.snapToGround);
    this.controller.setApplyImpulsesToDynamicBodies(true);
  }

  /** Moves by `delta` with collisions. Returns the movement actually made. */
  move(delta: THREE.Vector3): THREE.Vector3 {
    this.controller.computeColliderMovement(this.collider, delta, this.physics.rapier.QueryFilterFlags.EXCLUDE_SENSORS, COLLISION.player);
    const m = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    this.feet.x += m.x;
    this.feet.y += m.y;
    this.feet.z += m.z;
    this.liftOutOfFloor(m);
    this.body.setNextKinematicTranslation({ x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z });
    return new THREE.Vector3(m.x, m.y, m.z);
  }

  /** A dead soldier's capsule stops blocking others. */
  setEnabled(on: boolean): void {
    this.collider.setEnabled(on);
  }

  /** Changes capsule height, keeping the feet in place. Returns false if there is no room to stand up. */
  setHeight(height: number): boolean {
    if (height === this.height) return true;
    if (height > this.height && !this.hasRoom(height)) return false;
    this.height = height;
    this.collider.setHalfHeight(this.halfSegment(height));
    const center = { x: this.feet.x, y: this.feet.y + height / 2, z: this.feet.z };
    this.body.setTranslation(center, true);
    this.body.setNextKinematicTranslation(center);
    return true;
  }

  /** Moves instantly, e.g. to respawn. */
  teleport(feet: THREE.Vector3): void {
    this.feet.copy(feet);
    const center = { x: feet.x, y: feet.y + this.height / 2, z: feet.z };
    this.body.setTranslation(center, true);
    this.body.setNextKinematicTranslation(center);
  }

  /** Distance to the first hit along a ray, ignoring this character, or null. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number | null {
    const { rapier, world } = this.physics;
    const hit = world.castRay(new rapier.Ray(origin, dir), maxDist, true, undefined, COLLISION.view, this.collider);
    return hit ? hit.timeOfImpact : null;
  }

  /**
   * Workaround for a Rapier character controller issue: standing within about 1 mm of the
   * center of a large box collider makes the capsule sink through it. A short ray down the
   * capsule axis finds the floor; if the feet are below it, they are lifted back on top.
   */
  private liftOutOfFloor(m: { y: number }): void {
    if (m.y > 0) return;
    const reach = MOVEMENT.radius;
    tmpOrigin.set(this.feet.x, this.feet.y + reach, this.feet.z);
    const hit = this.raycast(tmpOrigin, DOWN, reach + FLOOR_PROBE);
    if (hit === null) return;
    const floorY = tmpOrigin.y - hit;
    if (floorY > this.feet.y + FLOOR_TOLERANCE) {
      this.feet.y = floorY;
      this.grounded = true;
    }
  }

  private hasRoom(height: number): boolean {
    const { rapier, world } = this.physics;
    const shape = new rapier.Capsule(this.halfSegment(height), MOVEMENT.radius - MOVEMENT.controllerOffset);
    const pos = { x: this.feet.x, y: this.feet.y + height / 2 + MOVEMENT.controllerOffset, z: this.feet.z };
    const flags = rapier.QueryFilterFlags.EXCLUDE_SENSORS;
    return world.intersectionWithShape(pos, { x: 0, y: 0, z: 0, w: 1 }, shape, flags, COLLISION.player, this.collider) === null;
  }

  private halfSegment(height: number): number {
    return height / 2 - MOVEMENT.radius;
  }
}
