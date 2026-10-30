import * as THREE from 'three';
import { LIGHTING } from '../data/lighting';

/** Sun with a shadow camera that follows the player, plus hemisphere light and fog. */
export class Lighting {
  private readonly sun: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, fog = true) {
    const c = LIGHTING;
    scene.add(new THREE.HemisphereLight(c.hemi.sky, c.hemi.ground, c.hemi.intensity));
    this.sun = new THREE.DirectionalLight(c.sun.color, c.sun.intensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(c.sun.shadowMapSize, c.sun.shadowMapSize);
    const e = c.sun.shadowExtent;
    Object.assign(this.sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: c.sun.shadowFar });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    if (fog) scene.fog = new THREE.Fog(c.fog.color, c.fog.near, c.fog.far);
  }

  /** Graphics preset: sun shadows on or off, and the shadow map size. */
  setShadows(enabled: boolean, mapSize: number): void {
    const s = this.sun.shadow;
    this.sun.castShadow = enabled;
    if (s.mapSize.x === mapSize) return;
    s.mapSize.set(mapSize, mapSize);
    // The map is rebuilt at the new size on the next frame.
    s.map?.dispose();
    s.map = null;
  }

  follow(pos: THREE.Vector3): void {
    const o = LIGHTING.sun.offset;
    this.sun.target.position.copy(pos);
    this.sun.position.set(pos.x + o[0], pos.y + o[1], pos.z + o[2]);
  }
}
