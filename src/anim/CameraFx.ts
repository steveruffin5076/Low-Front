import * as THREE from 'three';
import { VIEWMODEL_MOTION as M } from '../data/viewmodel';
import { EASE } from './Easing';

/**
 * Hit reaction (camera shake) and death (camera drops and tilts to the side).
 * Applied on top of the player camera each frame.
 *
 * Shake uses "trauma": each hit adds some, it fades linearly, and the shake is trauma² so light
 * hits barely move the view while several quick hits punch. The motion is summed sine waves
 * (smooth, not a random buzz each frame), scaled by the player's Screen shake setting.
 */
export class CameraFx {
  /** 0–1. */
  trauma = 0;
  /** Player setting, 0 (off) to 1 (full). */
  strength = 1;
  private t = 0;
  private deathTime = -1;

  get dead(): boolean {
    return this.deathTime >= 0;
  }

  /** True once the death camera has finished and the player should respawn. */
  get deathFinished(): boolean {
    return this.deathTime >= M.death.dropTime + M.death.holdTime;
  }

  hit(amount: number = M.hit.trauma): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  die(): void {
    if (!this.dead) this.deathTime = 0;
  }

  reset(): void {
    this.trauma = 0;
    this.deathTime = -1;
  }

  /** `eyeHeight` is the camera's current height above the feet. */
  apply(camera: THREE.Camera, dt: number, eyeHeight: number): void {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - M.hit.decay * dt);
      this.t += dt * M.hit.frequency;
      const k = this.trauma * this.trauma * this.strength;
      camera.position.x += M.hit.shake * k * wave(this.t, 1.7, 0.3);
      camera.position.y += M.hit.shake * k * wave(this.t, 2.3, 1.9);
      camera.rotation.z += M.hit.shakeRoll * k * wave(this.t, 1.1, 4.1);
    }
    if (this.dead) {
      this.deathTime += dt;
      const t = EASE.in(Math.min(1, this.deathTime / M.death.dropTime));
      camera.position.y -= (eyeHeight - M.death.eyeHeight) * t;
      camera.rotation.z += M.death.roll * t;
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, 0, t);
    }
  }
}

/** Smooth noise in about −1..1: two sine waves at unrelated rates. */
function wave(t: number, rate: number, phase: number): number {
  return 0.6 * Math.sin(t * rate + phase) + 0.4 * Math.sin(t * rate * 1.37 + phase * 1.7);
}
