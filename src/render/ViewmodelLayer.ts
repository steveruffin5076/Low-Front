import * as THREE from 'three';
import { LIGHTING } from '../data/lighting';
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
    const v = LIGHTING.viewmodel;
    this.scene.add(new THREE.HemisphereLight(v.hemi.sky, v.hemi.ground, v.hemi.intensity));
    for (const l of [v.key, v.fill, v.rim]) {
      const light = new THREE.DirectionalLight(l.color, l.intensity);
      light.position.set(l.position[0], l.position[1], l.position[2]);
      this.scene.add(light);
    }
  }

  setFov(fov: number): void {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
}
