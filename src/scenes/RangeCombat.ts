import * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { AUDIO } from '../data/audio';
import type { HitZone } from '../data/ballistics';
import { HEALTH } from '../data/player';
import { Health, fallDamage } from '../entities/Health';
import type { PlayerController } from '../entities/PlayerController';
import type { Combat } from '../game/Combat';
import type { DeathCause } from '../game/ConquestMatch';
import { COLLISION, raycastSegment, type Hittable, type Surface } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { BulletShooter } from '../weapons/Ballistics';
import { PlayerShooting } from '../weapons/PlayerShooting';
import type { PlayerWeapons } from '../weapons/PlayerWeapons';

/** A hit by the player's bullet on something with hitboxes. */
export interface TargetHit {
  target: Hittable;
  zone: HitZone;
  damage: number;
  distance: number;
  weapon: string;
  kill: boolean;
}

/** Who killed the player with a bullet. */
export interface KillerInfo {
  id: string;
  weapon: string;
  headshot: boolean;
  distance: number;
}

export interface CombatEvents {
  /** The player hit a target. */
  onHitTarget(hit: TargetHit): void;
  /** The player took damage; `angle` 0 = from the front, positive = from the right. */
  onPlayerDamaged(angle: number): void;
  /** `cause` is null when an enemy killed the player (`killer` then says who). */
  onPlayerDied(cause: DeathCause | null, killer: KillerInfo | null): void;
}

const down = new THREE.Vector3();

/**
 * The player's side of combat: shooting (spread, recoil, bullets into the shared `Combat`),
 * hit feedback, the player's health, fall damage, footsteps and the test damage keys.
 */
export class RangeCombat {
  readonly shooting: PlayerShooting;
  readonly health = new Health();
  /** Text for the readout, e.g. "AK47 → dummy 50 m · HEAD · 49.7 dmg at 50.1 m · HP 0 (kill)". */
  lastHit = '—';
  /** Cause of the damage that last hurt the player (null = an enemy), and who. */
  private lastCause: DeathCause | null = null;
  private lastKiller: KillerInfo | null = null;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly physics: PhysicsWorld,
    combat: Combat,
    private readonly player: PlayerController,
    weapons: PlayerWeapons,
    private readonly audio: AudioManager,
    camera: THREE.Camera,
    muzzle: (out: THREE.Vector3) => THREE.Vector3,
    private readonly events: CombatEvents,
    shooter: BulletShooter,
  ) {
    const sink = { fire: (...a: Parameters<Combat['ballistics']['fire']>) => combat.ballistics.fire(a[0], a[1], a[2], a[3], a[4], shooter) };
    this.shooting = new PlayerShooting(sink, weapons, player, () => camera.position.clone(), muzzle);
    weapons.events.on('fired', ({ weapon }) => audio.gunshot(weapon.def.id));
    this.unsubscribe.push(
      combat.events.on('hit', (h) => {
        if (h.shooter !== shooter || h.friendly) return;
        const hp = h.remainingHp === undefined ? '' : ` · HP ${h.remainingHp.toFixed(1)}`;
        this.lastHit =
          `${h.weapon} → ${h.target.label} · ${h.zone.toUpperCase()} · ${h.damage.toFixed(1)} dmg at ${h.distance.toFixed(1)} m` +
          `${hp}${h.kill ? ' (kill)' : ''}`;
        this.events.onHitTarget({ target: h.target, zone: h.zone, damage: h.damage, distance: h.distance, weapon: h.weapon, kill: h.kill });
        this.audio.hitMarker(h.kill);
      }),
      player.events.on('landed', ({ fallHeight }) => {
        audio.land();
        this.damagePlayer(fallDamage(fallHeight), null, 'fall');
      }),
      player.events.on('footstep', ({ crouched, sprinting }) => {
        const scale = crouched ? AUDIO.crouchStepScale : sprinting ? AUDIO.sprintStepScale : 1;
        audio.footstep(this.surfaceBelow(), scale);
      }),
    );
    this.health.events.on('died', () => events.onPlayerDied(this.lastCause, this.lastCause === null ? this.lastKiller : null));
  }

  fixedUpdate(dt: number): void {
    this.shooting.fixedUpdate(dt);
    this.player.clampPitch();
    this.health.update(dt);
  }

  /**
   * Damage to the player. `from` is the attacker's position (null: no direction); `cause` is
   * null for an enemy, who is then given by `killer`.
   */
  damagePlayer(amount: number, from: THREE.Vector3 | null, cause: DeathCause | null = null, killer: KillerInfo | null = null): void {
    if (amount <= 0 || this.health.dead) return;
    this.lastCause = cause;
    this.lastKiller = killer;
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
    this.lastHit = '—';
    this.lastKiller = null;
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
  }

  private surfaceBelow(): Surface {
    const feet = this.player.motor.feet;
    const from = feet.clone().add(down.set(0, 0.2, 0));
    const hit = raycastSegment(this.physics, from, feet.clone().add(down.set(0, -0.5, 0)), COLLISION.view);
    return hit?.tag?.kind === 'surface' ? hit.tag.surface : 'concrete';
  }
}
