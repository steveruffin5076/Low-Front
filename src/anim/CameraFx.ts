import * as THREE from 'three';
import { VIEWMODEL_MOTION as M } from '../data/viewmodel';
import { EASE } from './Easing';

/**
 * Hit reaction (camera shake) and death (camera drops and tilts to the side).
 * Applied on top of the player camera each frame.
 */
export class CameraFx {
  private shake = 0;
  private deathTime = -1;

  get dead(): boolean {
    return this.deathTime >= 0;
  }

  /** True once the death camera has finished and the player should respawn. */
  get deathFinished(): boolean {
    return this.deathTime >= M.death.dropTime + M.death.holdTime;
  }

  hit(): void {
    this.shake = M.hit.time;
  }

  die(): void {
    if (!this.dead) this.deathTime = 0;
  }

  reset(): void {
    this.shake = 0;
    this.deathTime = -1;
  }

  /** `eyeHeight` is the camera's current height above the feet. */
  apply(camera: THREE.Camera, dt: number, eyeHeight: number): void {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const k = this.shake / M.hit.time;
      camera.position.x += (Math.random() - 0.5) * 2 * M.hit.shake * k;
      camera.position.y += (Math.random() - 0.5) * 2 * M.hit.shake * k;
      camera.rotation.z += (Math.random() - 0.5) * 2 * M.hit.shakeRoll * k;
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
