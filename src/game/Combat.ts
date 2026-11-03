import * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import type { HitZone } from '../data/ballistics';
import { KNIFE } from '../data/melee';
import { COLLISION, raycastSegment, type ColliderTag, type Hittable, type Surface, type ZoneHit } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Ballistics, type BulletHit, type BulletShooter } from '../weapons/Ballistics';
import { hitDamage } from '../weapons/Damage';
import { Impacts } from '../weapons/Impacts';
import { SmokeField } from './Smoke';
import { Tracers } from '../weapons/Tracers';

const UP = new THREE.Vector3(0, 1, 0);
const tmpRight = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpEnd = new THREE.Vector3();

/** A bullet (or knife) that hit someone's hitbox. */
export interface CombatHit {
  shooter: BulletShooter | null;
  target: Hittable;
  zone: HitZone;
  damage: number;
  distance: number;
  weapon: string;
  kill: boolean;
  /** The target's HP after the hit, when it reports it. */
  remainingHp?: number;
  /** Same team: the bullet stops but does no damage. */
  friendly: boolean;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  origin: THREE.Vector3;
}

export interface CombatEvents {
  hit: CombatHit;
}

/**
 * Bullets for everyone (player and bots) in one world: projectiles, impacts and tracers, and
 * damage to whatever hitbox a bullet meets, with the damage table and no friendly fire.
 */
export class Combat {
  readonly events = new EventBus<CombatEvents>();
  readonly ballistics: Ballistics;
  readonly impacts = new Impacts();
  readonly tracers = new Tracers();
  readonly smoke: SmokeField;

  constructor(
    private readonly physics: PhysicsWorld,
    scene: THREE.Scene,
    private readonly audio: AudioManager,
  ) {
    this.ballistics = new Ballistics(physics);
    this.smoke = new SmokeField(physics);
    scene.add(this.impacts.root, this.tracers.mesh, this.smoke.root);
    this.ballistics.events.on('hit', (h) => this.onBulletHit(h));
  }

  fixedUpdate(dt: number): void {
    this.ballistics.fixedUpdate(dt);
    this.smoke.fixedUpdate(dt);
  }

  update(dt: number, alpha: number): void {
    this.impacts.update(dt);
    this.smoke.update(dt);
    this.tracers.update(this.ballistics.bullets, alpha);
  }

  dispose(): void {
    this.smoke.dispose();
    this.impacts.dispose();
    this.tracers.dispose();
  }

  /**
   * A knife strike from `eye` along `dir`: the nearest enemy hitbox within reach (with a few
   * forgiving rays around the aim). Double damage from behind. Reported like a bullet hit, so the
   * kill feed, no friendly fire and spawn protection all apply. Returns whether it hit someone.
   */
  melee(attacker: BulletShooter, eye: THREE.Vector3, dir: THREE.Vector3): boolean {
    const k = KNIFE;
    const right = tmpRight.crossVectors(dir, UP).normalize();
    const own = attacker.owner;
    const accept = (tag: ColliderTag | undefined): boolean => tag?.kind !== 'hitbox' || tag.owner !== own;
    let best: { hit: NonNullable<ReturnType<typeof raycastSegment>>; d: THREE.Vector3 } | null = null;
    for (const [side, down] of [[0, 0], [-1, 0], [1, 0], [0, 1]] as const) {
      const d = tmpDir.copy(dir).addScaledVector(right, side * k.spread).addScaledVector(UP, -down * k.spread).normalize().clone();
      const hit = raycastSegment(this.physics, eye, tmpEnd.copy(eye).addScaledVector(d, k.reach), COLLISION.bullet, accept);
      if (hit?.tag?.kind === 'hitbox' && (!best || hit.distance < best.hit.distance)) best = { hit, d };
    }
    this.audio.play('swing');
    if (!best || best.hit.tag?.kind !== 'hitbox') return false;
    const tag = best.hit.tag;
    const target = tag.owner;
    const friendly = attacker.team !== null && target.team !== undefined && attacker.team === target.team;
    const blocked = friendly || target.protected === true;
    // From behind: the victim faces the same way the knife moves.
    const yaw = target.yaw;
    const behind = yaw !== undefined && -Math.sin(yaw) * best.d.x - Math.cos(yaw) * best.d.z > k.backCos;
    const damage = blocked ? 0 : k.damage * (behind ? k.backMultiplier : 1);
    const zoneHit: ZoneHit = {
      zone: tag.zone,
      damage,
      distance: best.hit.distance,
      point: best.hit.point,
      direction: best.d.clone(),
      attackerId: attacker.id,
      from: eye.clone(),
      weapon: k.name,
    };
    if (!blocked) target.applyHit(zoneHit);
    this.events.emit('hit', {
      shooter: attacker,
      target,
      zone: tag.zone,
      damage,
      distance: best.hit.distance,
      weapon: k.name,
      kill: zoneHit.killed ?? false,
      remainingHp: zoneHit.remainingHp,
      friendly,
      point: best.hit.point,
      direction: best.d.clone(),
      origin: eye.clone(),
    });
    this.audio.impact('flesh', best.hit.point);
    return true;
  }

  private onBulletHit(h: BulletHit): void {
    const tag = h.tag;
    if (tag?.kind === 'hitbox') {
      const target = tag.owner;
      const shooterTeam = h.shooter?.team ?? null;
      const friendly = shooterTeam !== null && target.team !== undefined && shooterTeam === target.team;
      const blocked = friendly || target.protected === true;
      const damage = blocked ? 0 : hitDamage(h.def, h.distance, tag.zone);
      const zoneHit: ZoneHit = {
        zone: tag.zone,
        damage,
        distance: h.distance,
        point: h.point,
        direction: h.direction,
        attackerId: h.shooter?.id,
        from: h.origin,
        weapon: h.def.name,
      };
      if (!blocked) target.applyHit(zoneHit);
      this.events.emit('hit', {
        shooter: h.shooter,
        target,
        zone: tag.zone,
        damage,
        distance: h.distance,
        weapon: h.def.name,
        kill: zoneHit.killed ?? false,
        remainingHp: zoneHit.remainingHp,
        friendly,
        point: h.point,
        direction: h.direction,
        origin: h.origin,
      });
      this.impacts.spawn(h.point, h.direction.clone().negate(), 'flesh');
      this.audio.impact('flesh', h.point);
      return;
    }
    const surface: Surface = tag?.kind === 'surface' ? tag.surface : 'concrete';
    this.impacts.spawn(h.point, h.normal, surface);
    this.audio.impact(surface, h.point);
  }
}
