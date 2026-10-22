import type * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import type { HitZone } from '../data/ballistics';
import type { Hittable, Surface, ZoneHit } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Ballistics, type BulletHit, type BulletShooter } from '../weapons/Ballistics';
import { hitDamage } from '../weapons/Damage';
import { Impacts } from '../weapons/Impacts';
import { Tracers } from '../weapons/Tracers';

/** A bullet that hit someone's hitbox. */
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

  constructor(
    physics: PhysicsWorld,
    scene: THREE.Scene,
    private readonly audio: AudioManager,
  ) {
    this.ballistics = new Ballistics(physics);
    scene.add(this.impacts.root, this.tracers.mesh);
    this.ballistics.events.on('hit', (h) => this.onBulletHit(h));
  }

  fixedUpdate(dt: number): void {
    this.ballistics.fixedUpdate(dt);
  }

  update(dt: number, alpha: number): void {
    this.impacts.update(dt);
    this.tracers.update(this.ballistics.bullets, alpha);
  }

  dispose(): void {
    this.impacts.dispose();
    this.tracers.dispose();
  }

  private onBulletHit(h: BulletHit): void {
    const tag = h.tag;
    if (tag?.kind === 'hitbox') {
      const target = tag.owner;
      const shooterTeam = h.shooter?.team ?? null;
      const friendly = shooterTeam !== null && target.team !== undefined && shooterTeam === target.team;
      const damage = friendly ? 0 : hitDamage(h.def, h.distance, tag.zone);
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
      if (!friendly) target.applyHit(zoneHit);
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
