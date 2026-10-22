import * as THREE from 'three';
import { MOVEMENT } from '../data/player';

/**
 * Separate scene for the first-person weapon and arms. Its camera sits at the origin
 * looking down −Z, so everything in it is in camera space. Drawn after the world with
 * a cleared depth buffer (`Renderer.renderLayer`).
 */
export class ViewmodelLayer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(MOVEMENT.baseFov, 1, 0.01, 10);

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xeef6ff, 0x55606a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-1, 2, 1.5);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(1.5, 0.5, -1);
    this.scene.add(key, fill);
  }

  setFov(fov: number): void {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
}
