import { MOVEMENT } from '../data/player';

/** Pure movement rules (plan section 9), kept separate from physics so they can be unit tested. */

/** Moves `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export interface SpeedState {
  sprinting: boolean;
  crouched: boolean;
  ads: boolean;
}

/** Top ground speed for the current stance, scaled by the weapon's move speed modifier. */
export function maxSpeed(s: SpeedState, weaponModifier: number): number {
  let speed: number = MOVEMENT.walkSpeed;
  if (s.sprinting) speed = MOVEMENT.sprintSpeed;
  else if (s.crouched && s.ads) speed = Math.min(MOVEMENT.crouchSpeed, MOVEMENT.adsSpeed);
  else if (s.crouched) speed = MOVEMENT.crouchSpeed;
  else if (s.ads) speed = MOVEMENT.adsSpeed;
  return speed * weaponModifier;
}

/** Upward speed that reaches `height` under `gravity`. */
export function jumpVelocity(height: number = MOVEMENT.jumpHeight, gravity: number = MOVEMENT.gravity): number {
  return Math.sqrt(2 * gravity * height);
}

/**
 * Horizontal acceleration toward a target velocity. Returns the new velocity (x, z).
 * The change in velocity is limited to `accel * dt` in total, not per axis.
 */
export function accelerate(vx: number, vz: number, tx: number, tz: number, accel: number, dt: number): [number, number] {
  const dx = tx - vx;
  const dz = tz - vz;
  const len = Math.hypot(dx, dz);
  const max = accel * dt;
  if (len <= max || len === 0) return [tx, tz];
  return [vx + (dx / len) * max, vz + (dz / len) * max];
}

/** Sprint stamina: drains over `staminaDuration`, refills over `staminaRecovery`. */
export class Stamina {
  /** 0–1 */
  value = 1;
  private exhausted = false;

  get canSprint(): boolean {
    return !this.exhausted && this.value > 0;
  }

  update(dt: number, sprinting: boolean): void {
    if (sprinting) {
      this.value = Math.max(0, this.value - dt / MOVEMENT.staminaDuration);
      if (this.value === 0) this.exhausted = true;
    } else {
      this.value = Math.min(1, this.value + dt / MOVEMENT.staminaRecovery);
      if (this.exhausted && this.value >= MOVEMENT.staminaRestart) this.exhausted = false;
    }
  }
}

export interface SprintCheck {
  wantsSprint: boolean;
  /** Forward input, −1 to 1, after normalizing the move vector. */
  forward: number;
  grounded: boolean;
  ads: boolean;
  /** The player pressed fire; sprint stops so the weapon can come up. */
  firing: boolean;
  canSprint: boolean;
}

export function shouldSprint(c: SprintCheck): boolean {
  return c.wantsSprint && c.forward >= MOVEMENT.sprintMinForward && c.grounded && !c.ads && !c.firing && c.canSprint;
}
