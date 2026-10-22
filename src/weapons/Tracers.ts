import * as THREE from 'three';
import { EFFECTS } from '../data/effects';
import { disposeObject } from '../render/dispose';
import type { Bullet } from './Ballistics';

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
const head = new THREE.Vector3();
const tail = new THREE.Vector3();
const dir = new THREE.Vector3();
const mid = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

/** How much of the eye → muzzle offset is still applied after `travelled` meters (1 → 0). */
function join(travelled: number): number {
  return Math.max(0, 1 - travelled / EFFECTS.tracerConverge);
}

/** Glowing streaks for tracer rounds. They start at the muzzle and join the bullet's path. */
export class Tracers {
  readonly mesh: THREE.InstancedMesh;

  constructor() {
    // Unit box centered on the origin, stretched along +Z between the tail and the head.
    const geo = new THREE.BoxGeometry(1, 1, 1);
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
      // The visible streak follows a path that starts at the muzzle and joins the true
      // bullet path, so the shooter sees it travel toward the aim point.
      head.lerpVectors(b.prev, b.pos, alpha);
      const travelled = b.travelled + b.prev.distanceTo(head);
      const tailAt = Math.max(EFFECTS.tracerStart, travelled - EFFECTS.tracerLength);
      if (travelled <= tailAt) continue;
      dir.copy(b.vel).normalize();
      tail.copy(head).addScaledVector(dir, tailAt - travelled).addScaledVector(b.muzzleOffset, join(tailAt));
      head.addScaledVector(b.muzzleOffset, join(travelled));
      const span = head.distanceTo(tail);
      if (span < 1e-3) continue;
      dir.subVectors(head, tail).divideScalar(span);
      q.setFromUnitVectors(Z, dir);
      mid.addVectors(head, tail).multiplyScalar(0.5);
      m.compose(mid, q, s.set(EFFECTS.tracerWidth, EFFECTS.tracerWidth, span));
      this.mesh.setMatrixAt(n++, m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    disposeObject(this.mesh);
  }
}
