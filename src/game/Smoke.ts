import * as THREE from 'three';
import { SMOKE } from '../data/melee';
import { COLLISION, raycastSegment } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { disposeObject } from '../render/dispose';
import { paletteMaterial } from '../render/Materials';

interface Grenade {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  mesh: THREE.Object3D;
}

interface Cloud {
  center: THREE.Vector3;
  age: number;
  puffs: THREE.Sprite[];
  /** Each puff's offset from the center at full size, and its own size. */
  offsets: THREE.Vector3[];
  sizes: number[];
}

const PUFFS = 26;
const tmpNext = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/**
 * Smoke grenades (enhancement-1 §4.1.1): thrown canisters that bounce, then a cloud that blooms
 * to `SMOKE.radius`, lasts `SMOKE.life` and thins away. A cloud blocks sight both ways (bots
 * check `blocks`, players simply cannot see through it); bullets pass through.
 */
export class SmokeField {
  readonly root = new THREE.Group();
  private readonly grenades: Grenade[] = [];
  private readonly clouds: Cloud[] = [];
  private material: THREE.SpriteMaterial | null = null;

  constructor(private readonly physics: PhysicsWorld) {
    this.root.name = 'smoke';
  }

  /** Clouds and grenades in flight, for tests and the debug view. */
  get count(): { grenades: number; clouds: number } {
    return { grenades: this.grenades.length, clouds: this.clouds.length };
  }

  throw(from: THREE.Vector3, dir: THREE.Vector3, _team: 'blue' | 'red' | null): void {
    const d = dir.clone().normalize();
    d.y += SMOKE.throwLift;
    d.normalize();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), paletteMaterial(0x5b6a4a, { roughness: 0.7 }));
    mesh.position.copy(from);
    this.root.add(mesh);
    this.grenades.push({ pos: from.clone().addScaledVector(d, 0.4), vel: d.multiplyScalar(SMOKE.throwSpeed), age: 0, mesh });
  }

  fixedUpdate(dt: number): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.age += dt;
      g.vel.y -= SMOKE.gravity * dt;
      tmpNext.copy(g.pos).addScaledVector(g.vel, dt);
      const hit = raycastSegment(this.physics, g.pos, tmpNext, COLLISION.view);
      if (hit) {
        // Bounce off the surface, losing most of the speed.
        const n = hit.normal;
        g.vel.addScaledVector(n, -2 * g.vel.dot(n)).multiplyScalar(SMOKE.bounce);
        g.pos.copy(hit.point).addScaledVector(n, 0.05);
      } else {
        g.pos.copy(tmpNext);
      }
      g.mesh.position.copy(g.pos);
      if (g.age >= SMOKE.fuse) {
        this.grenades.splice(i, 1);
        g.mesh.removeFromParent();
        disposeObject(g.mesh);
        this.addCloud(g.pos);
      }
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.age += dt;
      if (c.age >= SMOKE.bloom + SMOKE.life + SMOKE.fade) {
        for (const p of c.puffs) p.removeFromParent();
        this.clouds.splice(i, 1);
      }
    }
  }

  /** Visuals: puffs grow while the cloud blooms, drift a little and thin out at the end. */
  update(dt: number): void {
    for (const c of this.clouds) {
      const grow = Math.min(1, c.age / SMOKE.bloom);
      const fade = THREE.MathUtils.clamp((SMOKE.bloom + SMOKE.life + SMOKE.fade - c.age) / SMOKE.fade, 0, 1);
      c.puffs.forEach((p, k) => {
        const o = c.offsets[k];
        p.position.copy(c.center).addScaledVector(o, 0.35 + 0.65 * grow);
        p.position.y += Math.sin(c.age * 0.4 + k) * 0.15;
        const s = c.sizes[k] * (0.3 + 0.7 * grow);
        p.scale.set(s, s, 1);
        (p.material as THREE.SpriteMaterial).opacity = 0.9 * fade;
      });
    }
    void dt;
  }

  /** Radius that blocks sight right now (0 when there is no cloud yet or it has thinned). */
  private blockingRadius(c: Cloud): number {
    const grow = Math.min(1, c.age / SMOKE.bloom);
    const left = SMOKE.bloom + SMOKE.life + SMOKE.fade - c.age;
    if (left < SMOKE.fade * 0.5) return 0;
    return SMOKE.radius * grow * 0.85;
  }

  /** True when a cloud stands between `a` and `b` (or either end is inside one). */
  blocks(a: THREE.Vector3, b: THREE.Vector3): boolean {
    for (const c of this.clouds) {
      const r = this.blockingRadius(c);
      if (r <= 0) continue;
      // Distance from the center to the segment.
      const ab = tmpA.subVectors(b, a);
      const len2 = ab.lengthSq();
      const t = len2 > 0 ? THREE.MathUtils.clamp(tmpB.subVectors(c.center, a).dot(ab) / len2, 0, 1) : 0;
      const closest = tmpB.copy(a).addScaledVector(ab, t);
      if (closest.distanceTo(c.center) < r) return true;
    }
    return false;
  }

  clear(): void {
    for (const g of this.grenades) disposeObject(g.mesh);
    this.grenades.length = 0;
    for (const c of this.clouds) for (const p of c.puffs) p.removeFromParent();
    this.clouds.length = 0;
  }

  dispose(): void {
    this.clear();
    this.material?.map?.dispose();
    this.material?.dispose();
    this.root.removeFromParent();
  }

  private addCloud(at: THREE.Vector3): void {
    const center = at.clone();
    center.y += SMOKE.radius * 0.35;
    const offsets: THREE.Vector3[] = [];
    const sizes: number[] = [];
    const puffs: THREE.Sprite[] = [];
    for (let k = 0; k < PUFFS; k++) {
      // Points in a flattened sphere: wider than tall, more near the ground.
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.2 - 0.6, Math.random() * 2 - 1);
      if (v.lengthSq() > 1) v.setLength(Math.random());
      offsets.push(v.multiplyScalar(SMOKE.radius * 0.75));
      sizes.push(SMOKE.radius * (0.55 + Math.random() * 0.35));
      const p = new THREE.Sprite(this.puffMaterial().clone());
      p.renderOrder = 2;
      puffs.push(p);
      this.root.add(p);
    }
    this.clouds.push({ center, age: 0, puffs, offsets, sizes });
  }

  /** A soft round gray puff (a canvas texture in the browser; a plain sprite in tests). */
  private puffMaterial(): THREE.SpriteMaterial {
    if (this.material) return this.material;
    let map: THREE.Texture | null = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      if (g) {
        const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.6, 'rgba(255,255,255,0.75)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        map = new THREE.CanvasTexture(c);
      }
    }
    this.material = new THREE.SpriteMaterial({ map, color: 0xb9bec4, transparent: true, depthWrite: false, opacity: 0.9 });
    return this.material;
  }
}
