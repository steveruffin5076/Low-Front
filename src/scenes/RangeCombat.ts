import * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { AUDIO } from '../data/audio';
import { HEALTH } from '../data/player';
import { Health, fallDamage } from '../entities/Health';
import type { PlayerController } from '../entities/PlayerController';
import type { HitZone } from '../data/ballistics';
import type { DeathCause } from '../game/ConquestMatch';
import { COLLISION, raycastSegment, type Hittable, type Surface, type ZoneHit } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Ballistics, type BulletHit } from '../weapons/Ballistics';
import { hitDamage } from '../weapons/Damage';
import { Impacts } from '../weapons/Impacts';
import { PlayerShooting } from '../weapons/PlayerShooting';
import type { PlayerWeapons } from '../weapons/PlayerWeapons';
import { Tracers } from '../weapons/Tracers';

/** A hit by the player's bullet on something with hitboxes. */
export interface TargetHit {
  target: Hittable;
  zone: HitZone;
  damage: number;
  distance: number;
  weapon: string;
  kill: boolean;
}

export interface CombatEvents {
  /** The player hit a target. */
  onHitTarget(hit: TargetHit): void;
  /** The player took damage; `angle` 0 = from the front, positive = from the right. */
  onPlayerDamaged(angle: number): void;
  /** `cause` is null when an enemy killed the player. */
  onPlayerDied(cause: DeathCause | null): void;
}

const down = new THREE.Vector3();

/**
 * Test range combat: the player's bullets, spread and recoil, hits on targets (with the
 * damage table), impacts and tracers, and the player's own health, fall damage and test damage.
 */
export class RangeCombat {
  readonly ballistics: Ballistics;
  readonly shooting: PlayerShooting;
  readonly impacts = new Impacts();
  readonly tracers = new Tracers();
  readonly health = new Health();
  /** Text for the readout, e.g. "AK47 → dummy 50 m · HEAD · 49.7 dmg at 50.1 m · HP 0 (kill)". */
  lastHit = '—';
  /** Cause of the damage that last hurt the player (null = an enemy). */
  private lastCause: DeathCause | null = null;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly physics: PhysicsWorld,
    scene: THREE.Scene,
    private readonly player: PlayerController,
    weapons: PlayerWeapons,
    private readonly audio: AudioManager,
    camera: THREE.Camera,
    muzzle: (out: THREE.Vector3) => THREE.Vector3,
    private readonly events: CombatEvents,
  ) {
    this.ballistics = new Ballistics(physics);
    this.shooting = new PlayerShooting(this.ballistics, weapons, player, () => camera.position.clone(), muzzle);
    scene.add(this.impacts.root, this.tracers.mesh);
    this.ballistics.events.on('hit', (h) => this.onBulletHit(h));
    weapons.events.on('fired', ({ weapon }) => audio.gunshot(weapon.def.id));
    this.unsubscribe.push(
      player.events.on('landed', ({ fallHeight }) => {
        audio.land();
        this.damagePlayer(fallDamage(fallHeight), null, 'fall');
      }),
      player.events.on('footstep', ({ crouched, sprinting }) => {
        const scale = crouched ? AUDIO.crouchStepScale : sprinting ? AUDIO.sprintStepScale : 1;
        audio.footstep(this.surfaceBelow(), scale);
      }),
    );
    this.health.events.on('died', () => events.onPlayerDied(this.lastCause));
  }

  fixedUpdate(dt: number): void {
    this.shooting.fixedUpdate(dt);
    this.player.clampPitch();
    this.ballistics.fixedUpdate(dt);
    this.health.update(dt);
  }

  update(dt: number, alpha: number): void {
    this.impacts.update(dt);
    this.tracers.update(this.ballistics.bullets, alpha);
  }

  /** Damage to the player. `from` is the attacker's position (null: no direction); `cause` is null for an enemy. */
  damagePlayer(amount: number, from: THREE.Vector3 | null, cause: DeathCause | null = null): void {
    if (amount <= 0 || this.health.dead) return;
    this.lastCause = cause;
    this.health.damage(amount);
    if (this.health.dead) return;
    let angle = Math.PI;
    if (from) {
      const feet = this.player.motor.feet;
      // Bearing of the source relative to where the player looks.
      const bearing = Math.atan2(from.x - feet.x, -(from.z - feet.z));
      angle = THREE.MathUtils.euclideanModulo(bearing + this.player.yaw + Math.PI, Math.PI * 2) - Math.PI;
    }
    this.events.onPlayerDamaged(angle);
  }

  /** Test key H: damage from a random direction 20 m away. */
  debugHit(): void {
    const a = Math.random() * Math.PI * 2;
    const feet = this.player.motor.feet;
    this.damagePlayer(HEALTH.debugHitDamage, new THREE.Vector3(feet.x + Math.sin(a) * 20, feet.y, feet.z - Math.cos(a) * 20), 'suicide');
  }

  reset(): void {
    this.health.reset();
    this.shooting.reset();
    this.ballistics.clear();
    this.lastHit = '—';
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.impacts.dispose();
    this.tracers.dispose();
  }

  private onBulletHit(h: BulletHit): void {
    const tag = h.tag;
    if (tag?.kind === 'hitbox') {
      const damage = hitDamage(h.def, h.distance, tag.zone);
      const zoneHit: ZoneHit = { zone: tag.zone, damage, distance: h.distance, point: h.point, direction: h.direction };
      tag.owner.applyHit(zoneHit);
      const killed = zoneHit.killed ?? false;
      const hp = zoneHit.remainingHp === undefined ? '' : ` · HP ${zoneHit.remainingHp.toFixed(1)}`;
      this.lastHit =
        `${h.def.name} → ${tag.owner.label} · ${tag.zone.toUpperCase()} · ${damage.toFixed(1)} dmg at ${h.distance.toFixed(1)} m` +
        `${hp}${killed ? ' (kill)' : ''}`;
      this.events.onHitTarget({ target: tag.owner, zone: tag.zone, damage, distance: h.distance, weapon: h.def.name, kill: killed });
      this.audio.hitMarker(killed);
      this.impacts.spawn(h.point, h.direction.clone().negate(), 'flesh');
      this.audio.impact('flesh', h.point);
      return;
    }
    const surface: Surface = tag?.kind === 'surface' ? tag.surface : 'concrete';
    this.impacts.spawn(h.point, h.normal, surface);
    this.audio.impact(surface, h.point);
  }

  private surfaceBelow(): Surface {
    const feet = this.player.motor.feet;
    const from = feet.clone().add(down.set(0, 0.2, 0));
    const hit = raycastSegment(this.physics, from, feet.clone().add(down.set(0, -0.5, 0)), COLLISION.view);
    return hit?.tag?.kind === 'surface' ? hit.tag.surface : 'concrete';
  }
}

