import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { BALLISTICS } from '../data/ballistics';
import type { WeaponDef } from '../data/weapons';
import { COLLISION, raycastSegment, type ColliderTag } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { stepProjectile } from './Projectile';

export interface Bullet {
  active: boolean;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  /** Meters flown so far, used for damage falloff. */
  travelled: number;
  def: WeaponDef;
  tracer: boolean;
  /** Offset from the eye to the muzzle at the moment of firing, for tracer visuals. */
  muzzleOffset: THREE.Vector3;
}

export interface BulletHit {
  def: WeaponDef;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  direction: THREE.Vector3;
  distance: number;
  tag: ColliderTag | undefined;
}

export interface BallisticsEvents {
  hit: BulletHit;
}

const p = [0, 0, 0];
const v = [0, 0, 0];

/**
 * Projectile bullets (plan section 7.1): velocity and gravity, and each fixed step the
 * segment from the old to the new position is raycast. Max lifetime 2 s. Pooled.
 */
export class Ballistics {
  readonly events = new EventBus<BallisticsEvents>();
  readonly bullets: Bullet[] = [];
  private next = 0;

  constructor(private readonly physics: PhysicsWorld) {
    for (let i = 0; i < BALLISTICS.maxBullets; i++) {
      this.bullets.push({
        active: false,
        pos: new THREE.Vector3(),
        prev: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        travelled: 0,
        def: undefined as unknown as WeaponDef,
        tracer: false,
        muzzleOffset: new THREE.Vector3(),
      });
    }
  }

  fire(origin: THREE.Vector3, direction: THREE.Vector3, def: WeaponDef, tracer: boolean, muzzleOffset: THREE.Vector3): void {
    const b = this.bullets[this.next];
    this.next = (this.next + 1) % this.bullets.length;
    b.active = true;
    b.pos.copy(origin);
    b.prev.copy(origin);
    b.vel.copy(direction).normalize().multiplyScalar(def.muzzleVelocity);
    b.age = 0;
    b.travelled = 0;
    b.def = def;
    b.tracer = tracer;
    b.muzzleOffset.copy(muzzleOffset);
  }

  fixedUpdate(dt: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.prev.copy(b.pos);
      b.pos.toArray(p);
      b.vel.toArray(v);
      stepProjectile(p, v, dt, BALLISTICS.gravity);
      b.pos.fromArray(p);
      b.vel.fromArray(v);
      b.age += dt;

      const hit = raycastSegment(this.physics, b.prev, b.pos, COLLISION.bullet);
      if (hit) {
        b.active = false;
        b.pos.copy(hit.point);
        this.events.emit('hit', {
          def: b.def,
          point: hit.point,
          normal: hit.normal,
          direction: b.vel.clone().normalize(),
          distance: b.travelled + hit.distance,
          tag: hit.tag,
        });
        continue;
      }
      b.travelled += b.prev.distanceTo(b.pos);
      if (b.age >= BALLISTICS.maxLife) b.active = false;
    }
  }

  clear(): void {
    for (const b of this.bullets) b.active = false;
  }
}
