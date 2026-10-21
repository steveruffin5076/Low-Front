import * as THREE from 'three';
import { EFFECTS } from '../data/effects';
import { disposeObject } from '../render/dispose';
import type { Bullet } from './Ballistics';

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
const pos = new THREE.Vector3();
const dir = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

/** Glowing streaks for tracer rounds. They start at the muzzle and join the bullet's path. */
export class Tracers {
  readonly mesh: THREE.InstancedMesh;

  constructor() {
    // Unit box along +Z from 0 to 1, stretched to the tracer length behind the bullet.
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5);
    const mat = new THREE.MeshBasicMaterial({ color: EFFECTS.tracerColor, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, EFFECTS.maxTracers);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  /** `alpha` interpolates between the last two fixed steps. */
  update(bullets: readonly Bullet[], alpha: number): void {
    let n = 0;
    for (const b of bullets) {
      if (!b.active || !b.tracer || n >= EFFECTS.maxTracers) continue;
      pos.lerpVectors(b.prev, b.pos, alpha);
      const travelled = b.travelled + b.prev.distanceTo(pos);
      const join = Math.max(0, 1 - travelled / EFFECTS.tracerConverge);
      pos.addScaledVector(b.muzzleOffset, join);
      dir.copy(b.vel).normalize();
      const length = Math.min(EFFECTS.tracerLength, travelled + 0.3);
      q.setFromUnitVectors(Z, dir);
      m.compose(pos, q, s.set(EFFECTS.tracerWidth, EFFECTS.tracerWidth, length));
      this.mesh.setMatrixAt(n++, m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    disposeObject(this.mesh);
  }
}
