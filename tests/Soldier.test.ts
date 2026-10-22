import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEATH } from '../src/data/soldier';
import { Soldier } from '../src/entities/soldier/Soldier';
import { COLLISION, raycastSegment, type ZoneHit } from '../src/physics/collision';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

const DT = 1 / 60;
let physics: PhysicsWorld;

beforeAll(async () => {
  physics = await PhysicsWorld.create();
});

/** A soldier at `at`, facing −Z, after `seconds` of animation with `crouched`. */
function soldierAt(at: THREE.Vector3, crouched = false, seconds = 0.6): Soldier {
  const s = new Soldier(physics, 'red', { primary: 'ak47', secondary: 'm1911' }, 'test soldier');
  s.spawn(at, 0);
  s.input.crouched = crouched;
  step(s, seconds);
  return s;
}

function step(s: Soldier, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    s.update(DT, new THREE.Vector3(0, 1.6, 100));
    s.fixedUpdate(DT);
    physics.world.step();
  }
}

/** Shoots a horizontal ray from 5 m in front of the soldier at height `y`, offset sideways by `x`. */
function shoot(s: Soldier, y: number, x = 0): string | null {
  const from = new THREE.Vector3(s.position.x + x, y, s.position.z - 5);
  const to = new THREE.Vector3(s.position.x + x, y, s.position.z + 5);
  const hit = raycastSegment(physics, from, to, COLLISION.bullet);
  return hit?.tag?.kind === 'hitbox' && hit.tag.owner === s ? hit.tag.zone : null;
}

describe('soldier hitboxes follow the bones', () => {
  it('hits head, torso, legs and arms on a standing soldier', () => {
    const s = soldierAt(new THREE.Vector3(0, 0, 0));
    expect(shoot(s, 1.72)).toBe('head');
    expect(shoot(s, 1.2)).toBe('torso');
    expect(shoot(s, 0.4, 0.1)).toBe('leg');
    // The left forearm reaches forward to the handguard, in front of the chest.
    const b = s.model.bones;
    const mid = b.forearmL.getWorldPosition(new THREE.Vector3()).lerp(b.handL.getWorldPosition(new THREE.Vector3()), 0.5);
    expect(shoot(s, mid.y, mid.x - s.position.x)).toBe('arm');
    s.dispose();
  });

  it('moves the head down when crouched', () => {
    const s = soldierAt(new THREE.Vector3(10, 0, 0), true);
    expect(shoot(s, 1.72)).toBeNull();
    const headY = s.model.bones.head.getWorldPosition(new THREE.Vector3()).y + 0.12;
    expect(headY).toBeLessThan(1.4);
    expect(shoot(s, headY)).toBe('head');
    s.dispose();
  });

  it('dies from a killing hit, falls the bullet\'s way, and stops taking hits', () => {
    const s = soldierAt(new THREE.Vector3(20, 0, 0));
    const hit: ZoneHit = { zone: 'head', damage: 200, distance: 5, point: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, 1) };
    s.applyHit(hit);
    expect(hit.killed).toBe(true);
    expect(s.dead).toBe(true);
    // A bullet travelling +Z hits a soldier facing −Z from the front: it falls backward.
    expect(Math.abs(s.anim.fallHeading)).toBeCloseTo(Math.PI, 5);
    step(s, 0.2);
    expect(shoot(s, 1.2)).toBeNull();
    step(s, DEATH.fallTime + DEATH.stayTime + DEATH.fadeTime);
    expect(s.gone).toBe(true);
    expect(s.model.root.visible).toBe(false);
    s.spawn(new THREE.Vector3(20, 0, 0), 0);
    step(s, 0.1);
    expect(shoot(s, 1.2)).toBe('torso');
    s.dispose();
  });

  it('turns the hit direction into its own frame', () => {
    const s = soldierAt(new THREE.Vector3(30, 0, 0));
    s.yaw = Math.PI / 2; // facing −X
    const hit: ZoneHit = { zone: 'torso', damage: 200, distance: 5, point: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1) };
    s.applyHit(hit);
    // Facing −X, a bullet travelling −Z pushes it to its right.
    expect(s.anim.fallHeading).toBeCloseTo(Math.PI / 2, 5);
    s.dispose();
  });
});
