import * as THREE from 'three';
import { BALLISTICS } from '../data/ballistics';
import type { PlayerController } from '../entities/PlayerController';
import type { Ballistics } from './Ballistics';
import type { PlayerWeapons } from './PlayerWeapons';
import { Recoil } from './Recoil';
import { Spread, spreadDirection } from './Spread';
import type { WeaponState } from './WeaponState';

const DEG = Math.PI / 180;
const forward = new THREE.Vector3();
const dir = new THREE.Vector3();
const euler = new THREE.Euler();

/**
 * Turns the player's shots into bullets: aim direction from the view plus spread, camera
 * recoil on the player's pitch and yaw, and every Nth round a tracer (plan section 7.1).
 */
export class PlayerShooting {
  readonly recoil = new Recoil();
  private readonly spreads = new Map<WeaponState, Spread>();
  private shots = 0;
  /** 0–1, set each frame by the session. */
  ads = 0;

  constructor(
    private readonly ballistics: Ballistics,
    private readonly weapons: PlayerWeapons,
    private readonly player: PlayerController,
    /** Eye position (bullet origin) and the muzzle in world space (tracer start). */
    private readonly eye: () => THREE.Vector3,
    private readonly muzzle: (out: THREE.Vector3) => THREE.Vector3,
  ) {
    for (const w of Object.values(weapons.weapons)) this.spreads.set(w, new Spread(w.def));
    weapons.events.on('fired', ({ weapon }) => this.fire(weapon));
  }

  /** Current spread cone of the active weapon, in degrees. */
  get cone(): number {
    return this.spreadOf(this.weapons.active).cone(this.spreadState());
  }

  fixedUpdate(dt: number): void {
    for (const s of this.spreads.values()) s.update(dt);
    const back = this.recoil.update(dt, this.weapons.active.def);
    this.player.pitch += back.pitch * DEG;
    this.player.yaw -= back.yaw * DEG;
  }

  /** Mouse movement against the recoil counts as recovery already done. */
  onLook(dPitchRad: number): void {
    this.recoil.compensate(dPitchRad / DEG);
  }

  reset(): void {
    this.recoil.reset();
    for (const s of this.spreads.values()) s.bloom = 0;
    this.shots = 0;
  }

  private fire(weapon: WeaponState): void {
    const spread = this.spreadOf(weapon);
    euler.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
    forward.set(0, 0, -1).applyEuler(euler);
    spreadDirection(forward, spread.cone(this.spreadState()), dir);
    const origin = this.eye();
    const muzzleOffset = this.muzzle(new THREE.Vector3()).sub(origin);
    this.shots++;
    this.ballistics.fire(origin, dir, weapon.def, this.shots % BALLISTICS.tracerEvery === 0, muzzleOffset);
    spread.onShot();

    const kick = this.recoil.kick(weapon.def, THREE.MathUtils.lerp(1, BALLISTICS.adsRecoilScale, this.ads));
    this.player.pitch += kick.pitch * DEG;
    this.player.yaw -= kick.yaw * DEG;
  }

  private spreadState(): { ads: number; speed: number; grounded: boolean } {
    return { ads: this.ads, speed: this.player.horizontalSpeed, grounded: this.player.grounded };
  }

  private spreadOf(w: WeaponState): Spread {
    return this.spreads.get(w)!;
  }
}
