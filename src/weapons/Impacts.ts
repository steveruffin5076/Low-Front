import * as THREE from 'three';
import { EFFECTS, IMPACTS, type ImpactStyle } from '../data/effects';
import type { Surface } from '../physics/collision';
import { disposeObject } from '../render/dispose';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  style: ImpactStyle;
}

interface Decal {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  age: number;
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
const color = new THREE.Color();
const Z = new THREE.Vector3(0, 0, 1);
const rand = new THREE.Vector3();

/** World-space bullet impacts: particles per surface and bullet-hole decals. Pooled and instanced. */
export class Impacts {
  readonly root = new THREE.Group();
  private readonly particleMesh: THREE.InstancedMesh;
  private readonly decalMesh: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly decals: Decal[] = [];

  constructor() {
    this.particleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), EFFECTS.maxParticles);
    const decalMat = new THREE.MeshBasicMaterial({
      color: EFFECTS.decalColor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      depthWrite: false,
    });
    this.decalMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 6), decalMat, EFFECTS.maxDecals);
    for (const mesh of [this.particleMesh, this.decalMesh]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.root.add(mesh);
    }
    // instanceColor is created on first setColorAt.
    this.particleMesh.setColorAt(0, color.set(0xffffff));
  }

  spawn(point: THREE.Vector3, normal: THREE.Vector3, surface: Surface | 'flesh'): void {
    const style = IMPACTS[surface];
    for (let i = 0; i < style.count; i++) {
      if (this.particles.length >= EFFECTS.maxParticles) this.particles.shift();
      rand.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiplyScalar(style.spread);
      const vel = normal.clone().add(rand).normalize().multiplyScalar(style.speed * (0.5 + Math.random() * 0.7));
      this.particles.push({ pos: point.clone().addScaledVector(normal, 0.02), vel, age: Math.random() * 0.05, style });
    }
    if (style.decal) {
      if (this.decals.length >= EFFECTS.maxDecals) this.decals.shift();
      this.decals.push({
        pos: point.clone().addScaledVector(normal, EFFECTS.decalOffset),
        quat: new THREE.Quaternion().setFromUnitVectors(Z, normal).multiply(q.setFromAxisAngle(Z, Math.random() * Math.PI)),
        age: 0,
      });
    }
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.style.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.style.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      const k = p.style.size * (1 - p.age / p.style.life);
      m.compose(p.pos, q.identity(), s.set(k, k, k));
      this.particleMesh.setMatrixAt(n, m);
      this.particleMesh.setColorAt(n, color.set(p.style.color));
      n++;
    }
    this.particleMesh.count = n;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    let d = 0;
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const decal = this.decals[i];
      decal.age += dt;
      if (decal.age >= EFFECTS.decalLife) {
        this.decals.splice(i, 1);
        continue;
      }
      m.compose(decal.pos, decal.quat, s.set(EFFECTS.decalSize, EFFECTS.decalSize, 1));
      this.decalMesh.setMatrixAt(d++, m);
    }
    this.decalMesh.count = d;
    this.decalMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    disposeObject(this.root);
  }
}
