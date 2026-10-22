import * as THREE from 'three';
import { DUMMY } from '../data/testRange';
import { HEALTH } from '../data/player';
import type { Hittable, ZoneHit } from '../physics/collision';
import { COLLISION } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { paletteMaterial } from '../render/Materials';
import { EASE } from '../anim/Easing';
import { Health } from './Health';
import { Hitboxes } from './Hitboxes';

/** Test range target: hitboxes and health; falls over when killed and stands up again. */
export class TargetDummy implements Hittable {
  readonly root = new THREE.Group();
  /** Dummies do not regenerate; they reset after dying. */
  readonly health = new Health(HEALTH.max, Infinity, 0);
  readonly label: string;
  lastHit: ZoneHit | null = null;
  private readonly hitboxes: Hitboxes;
  private downTime = -1;

  constructor(physics: PhysicsWorld, at: THREE.Vector3, distance: number) {
    this.label = `dummy ${distance} m`;
    this.root.position.copy(at);
    for (const p of DUMMY.parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), paletteMaterial(p.color));
      mesh.position.set(...p.pos);
      mesh.castShadow = true;
      this.root.add(mesh);
    }
    this.hitboxes = new Hitboxes(physics, this, DUMMY.parts, at);
    // A body collider so the player cannot walk through; bullets ignore it and use the hitboxes.
    const { rapier, world } = physics;
    world.createCollider(rapier.ColliderDesc.cuboid(0.3, 0.9, 0.15).setTranslation(at.x, 0.9, at.z).setCollisionGroups(COLLISION.body));
  }

  get dead(): boolean {
    return this.health.dead;
  }

  applyHit(hit: ZoneHit): void {
    if (this.health.dead) return;
    hit.killed = this.health.damage(hit.damage);
    hit.remainingHp = this.health.hp;
    this.lastHit = hit;
    if (hit.killed) {
      this.downTime = 0;
      this.hitboxes.setEnabled(false);
    }
  }

  update(dt: number): void {
    if (this.downTime < 0) return;
    this.downTime += dt;
    const fall = EASE.in(Math.min(1, this.downTime / DUMMY.fallTime));
    // Falls backward, away from the shooter.
    this.root.rotation.x = -fall * (Math.PI / 2);
    if (this.downTime >= DUMMY.fallTime + DUMMY.resetTime) this.reset();
  }

  /** Stands up with full health. */
  reset(): void {
    this.downTime = -1;
    this.root.rotation.x = 0;
    this.health.reset();
    this.hitboxes.setEnabled(true);
  }
}
