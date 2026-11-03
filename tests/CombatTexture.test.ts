import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';
import { CONQUEST } from '../src/data/conquest';
import { KNIFE, SMOKE } from '../src/data/melee';
import { VAULT } from '../src/data/player';
import { DUMMY } from '../src/data/testRange';
import { WEAPONS } from '../src/data/weapons';
import { PlayerController } from '../src/entities/PlayerController';
import { Hitboxes } from '../src/entities/Hitboxes';
import { Combat } from '../src/game/Combat';
import { COLLISION, type Hittable, type ZoneHit } from '../src/physics/collision';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { PlayerWeapons, type WeaponInput } from '../src/weapons/PlayerWeapons';

const idle: WeaponInput = {
  firePressed: false,
  fireHeld: false,
  reloadPressed: false,
  switchTo: null,
  fireModePressed: false,
  inspectPressed: false,
  canFire: true,
  sprinting: false,
  ads: false,
};

/** A target standing at `at`, facing `yaw`, that records the damage it takes. */
class Target implements Hittable {
  readonly label = 'target';
  taken: number[] = [];
  protected = false;
  constructor(
    readonly team: 'blue' | 'red',
    readonly yaw: number,
  ) {}
  applyHit(hit: ZoneHit): void {
    this.taken.push(hit.damage);
  }
}

async function world(): Promise<{ physics: PhysicsWorld; combat: Combat }> {
  const physics = await PhysicsWorld.create();
  const { rapier, world: w } = physics;
  w.createCollider(rapier.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setCollisionGroups(COLLISION.world));
  // Raycasts see colliders after a step.
  w.step();
  return { physics, combat: new Combat(physics, new THREE.Scene(), new AudioManager()) };
}

function place(physics: PhysicsWorld, t: Hittable, at: THREE.Vector3): void {
  new Hitboxes(physics, t, DUMMY.parts, at);
  physics.world.step();
}

const attacker = { id: 'me', team: 'blue' as const, owner: null };
const eye = new THREE.Vector3(0, 1.6, 0);
const ahead = new THREE.Vector3(0, -0.35, -1).normalize();

describe('quick knife', () => {
  it('hits an enemy in reach from the front for the base damage', async () => {
    const { physics, combat } = await world();
    // Facing the attacker (yaw π turns forward to +Z, toward the attacker at the origin).
    const t = new Target('red', Math.PI);
    place(physics, t, new THREE.Vector3(0, 0, -1.2));
    expect(combat.melee(attacker, eye, ahead)).toBe(true);
    expect(t.taken).toEqual([KNIFE.damage]);
  });

  it('does double damage from behind', async () => {
    const { physics, combat } = await world();
    const t = new Target('red', 0); // facing away, forward is −Z
    place(physics, t, new THREE.Vector3(0, 0, -1.2));
    combat.melee(attacker, eye, ahead);
    expect(t.taken).toEqual([KNIFE.damage * KNIFE.backMultiplier]);
  });

  it('misses out of reach, and does nothing to a teammate or a protected enemy', async () => {
    const { physics, combat } = await world();
    const far = new Target('red', Math.PI);
    place(physics, far, new THREE.Vector3(0, 0, -3));
    expect(combat.melee(attacker, eye, ahead)).toBe(false);
    const { physics: p2, combat: c2 } = await world();
    const mate = new Target('blue', Math.PI);
    place(p2, mate, new THREE.Vector3(0, 0, -1.2));
    c2.melee(attacker, eye, ahead);
    expect(mate.taken).toEqual([]);
    const { physics: p3, combat: c3 } = await world();
    const fresh = new Target('red', Math.PI);
    fresh.protected = true;
    place(p3, fresh, new THREE.Vector3(0, 0, -1.2));
    c3.melee(attacker, eye, ahead);
    expect(fresh.taken).toEqual([]);
  });

  it('is an action: strike at the right moment, no firing meanwhile', () => {
    const pw = new PlayerWeapons({ primary: 'm4a1', secondary: 'm1911' });
    pw.start();
    for (let t = 0; t < 1; t += 1 / 60) pw.update(1 / 60, idle);
    const events: string[] = [];
    pw.events.on('meleeStrike', () => events.push('strike'));
    pw.events.on('fired', () => events.push('fired'));
    pw.update(1 / 60, { ...idle, meleePressed: true });
    expect(pw.actionKind).toBe('melee');
    for (let t = 0; t < KNIFE.duration * 0.5; t += 1 / 60) pw.update(1 / 60, { ...idle, firePressed: true, fireHeld: true });
    expect(events).toEqual(['strike']);
    for (let t = 0; t < KNIFE.duration; t += 1 / 60) pw.update(1 / 60, idle);
    expect(pw.actionKind).toBe('ready');
  });
});

describe('spawn protection', () => {
  it('bullets do no damage to a protected soldier', async () => {
    const { physics, combat } = await world();
    const t = new Target('red', 0);
    t.protected = true;
    place(physics, t, new THREE.Vector3(0, 0, -10));
    combat.ballistics.fire(eye.clone(), new THREE.Vector3(0, -0.05, -1).normalize(), WEAPONS.m4a1, false, new THREE.Vector3(), attacker);
    for (let i = 0; i < 30; i++) combat.fixedUpdate(1 / 60);
    expect(t.taken).toEqual([]);
    expect(CONQUEST.spawnProtection).toBeGreaterThan(1);
  });
});

describe('smoke', () => {
  it('a thrown grenade blooms into a cloud that blocks sight, then clears', async () => {
    const { combat } = await world();
    // Dropped close in front, so the cloud sits around z ≈ −2.
    combat.smoke.throw(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, -1, -0.15), 'blue');
    const a = new THREE.Vector3(-20, 1.5, -2);
    const b = new THREE.Vector3(20, 1.5, -2);
    for (let t = 0; t < SMOKE.fuse - 0.1; t += 1 / 60) combat.fixedUpdate(1 / 60);
    expect(combat.smoke.blocks(a, b)).toBe(false);
    for (let t = 0; t < SMOKE.bloom + 0.6; t += 1 / 60) combat.fixedUpdate(1 / 60);
    expect(combat.smoke.count.clouds).toBe(1);
    expect(combat.smoke.blocks(a, b)).toBe(true);
    // Far from the cloud: clear.
    expect(combat.smoke.blocks(new THREE.Vector3(-20, 1.5, 40), new THREE.Vector3(20, 1.5, 40))).toBe(false);
    for (let t = 0; t < SMOKE.life + SMOKE.fade + 0.5; t += 1 / 60) combat.fixedUpdate(1 / 60);
    expect(combat.smoke.count.clouds).toBe(0);
    expect(combat.smoke.blocks(a, b)).toBe(false);
  });

  it('two per life; throwing uses one, a resupply-style refill gives them back', () => {
    const pw = new PlayerWeapons({ primary: 'm4a1', secondary: 'm1911' });
    pw.start();
    for (let t = 0; t < 1; t += 1 / 60) pw.update(1 / 60, idle);
    let released = 0;
    pw.events.on('throwRelease', () => released++);
    for (let n = 0; n < 3; n++) {
      pw.update(1 / 60, { ...idle, throwPressed: true });
      for (let t = 0; t < SMOKE.throwTime + 0.1; t += 1 / 60) pw.update(1 / 60, idle);
    }
    expect(released).toBe(SMOKE.perLife);
    expect(pw.smokes).toBe(0);
    pw.start();
    expect(pw.smokes).toBe(SMOKE.perLife);
  });
});

describe('vault', () => {
  async function scene(height: number, depth: number): Promise<{ physics: PhysicsWorld; p: PlayerController }> {
    const physics = await PhysicsWorld.create();
    const { rapier, world: w } = physics;
    w.createCollider(rapier.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setCollisionGroups(COLLISION.world));
    // The obstacle's front face 0.7 m ahead of the player.
    w.createCollider(rapier.ColliderDesc.cuboid(2, height / 2, depth / 2).setTranslation(0, height / 2, -0.7 - depth / 2).setCollisionGroups(COLLISION.world));
    const p = new PlayerController(physics, new THREE.Vector3(0, 0, 0));
    return { physics, p };
  }
  const still = { strafe: 0, forward: 0, sprint: false, ads: false, firing: false, leanLeft: false, leanRight: false, crouchPressed: false, jumpPressed: false };
  const run = (physics: PhysicsWorld, p: PlayerController, seconds: number, jump = false): void => {
    for (let i = 0; i < seconds * 60; i++) {
      p.fixedUpdate(1 / 60, { ...still, jumpPressed: jump && i === 0 }, 1);
      physics.world.step();
    }
  };

  it('climbs over a thin waist-high wall', async () => {
    const { physics, p } = await scene(1.0, 0.3);
    run(physics, p, 1);
    run(physics, p, VAULT.duration + 0.5, true);
    expect(p.motor.feet.z).toBeLessThan(-1.0);
    expect(p.motor.feet.y).toBeLessThan(0.2);
  });

  it('climbs onto a deep low block', async () => {
    const { physics, p } = await scene(0.8, 3);
    run(physics, p, 1);
    run(physics, p, VAULT.duration + 0.5, true);
    expect(p.motor.feet.y).toBeGreaterThan(0.7);
  });

  it('does not vault a wall that is too high: a normal jump instead', async () => {
    const { physics, p } = await scene(2.0, 0.3);
    run(physics, p, 1);
    run(physics, p, 1.5, true);
    expect(p.motor.feet.z).toBeGreaterThan(-0.7);
  });
});
