import * as THREE from 'three';
import { LIGHTING } from '../data/lighting';

/** Gradient sky dome that stays centered on the camera. Not affected by fog. */
export class Sky {
  readonly mesh: THREE.Mesh;

  constructor() {
    const c = LIGHTING.sky;
    const geo = new THREE.SphereGeometry(c.radius, 24, 12);
    const top = new THREE.Color(c.top);
    const horizon = new THREE.Color(c.horizon);
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / c.radius);
      col.lerpColors(horizon, top, Math.pow(t, 0.6));
      colors.set([col.r, col.g, col.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
