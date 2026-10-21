import type { WeaponDef } from '../data/weapons';
import { approach } from '../entities/PlayerMovement';

/**
 * Camera recoil (plan section 7.1): each shot kicks the view up and sideways by the weapon's
 * pattern plus a random part. After a short pause the offset recovers toward zero.
 * Offsets are in degrees; positive pitch is up, positive yaw is right.
 */
export class Recoil {
  pitch = 0;
  yaw = 0;
  private shotIndex = 0;
  private sinceShot = Infinity;

  /** `scale` reduces recoil, e.g. while aiming. `rand` returns 0–1 and is injectable for tests. */
  kick(def: WeaponDef, scale = 1, rand: () => number = Math.random): { pitch: number; yaw: number } {
    const r = def.recoil;
    if (this.sinceShot > r.recoveryDelay * 4) this.shotIndex = 0;
    const pattern = r.pattern[this.shotIndex % r.pattern.length];
    const dp = r.verticalDeg * scale;
    const dy = r.horizontalDeg * (pattern + (rand() * 2 - 1) * r.random) * scale;
    this.pitch += dp;
    this.yaw += dy;
    this.shotIndex++;
    this.sinceShot = 0;
    return { pitch: dp, yaw: dy };
  }

  /** Returns how much the offset changed this step (to apply to the camera). */
  update(dt: number, def: WeaponDef): { pitch: number; yaw: number } {
    this.sinceShot += dt;
    if (this.sinceShot < def.recoil.recoveryDelay) return { pitch: 0, yaw: 0 };
    const len = Math.hypot(this.pitch, this.yaw);
    if (len === 0) return { pitch: 0, yaw: 0 };
    const next = approach(len, 0, def.recoil.recoveryDegPerSec * dt);
    const k = next / len;
    const dp = this.pitch * k - this.pitch;
    const dy = this.yaw * k - this.yaw;
    this.pitch += dp;
    this.yaw += dy;
    return { pitch: dp, yaw: dy };
  }

  /** The player moved the mouse against the recoil: that part no longer needs recovery. */
  compensate(dPitchDeg: number): void {
    if (this.pitch > 0 && dPitchDeg < 0) this.pitch = Math.max(0, this.pitch + dPitchDeg);
  }

  reset(): void {
    this.pitch = 0;
    this.yaw = 0;
    this.shotIndex = 0;
    this.sinceShot = Infinity;
  }
}
