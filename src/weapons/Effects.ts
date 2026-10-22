import * as THREE from 'three';
import { FP_PALETTE } from '../data/palette';
import { VIEWMODEL_MOTION as M } from '../data/viewmodel';
import type { WeaponId } from '../data/weapons';
import { paletteMaterial } from '../render/Materials';

/** Shell casing size per weapon: radius and length in meters. */
const SHELL_SIZE: Record<WeaponId, [number, number]> = {
  m4a1: [0.0048, 0.045],
  ak47: [0.0056, 0.039],
  m1911: [0.006, 0.023],
};

interface Shell {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
}

const tmp = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** First-person muzzle flash and ejected shells, in viewmodel (camera) space. Pooled. */
export class FPEffects {
  readonly root = new THREE.Group();
  private readonly flash: THREE.Group;
  private flashTime = 0;
  private readonly shells: Shell[] = [];
  private next = 0;
  private readonly geometries: Record<WeaponId, THREE.CylinderGeometry>;

  constructor() {
    this.flash = buildFlash();
    this.flash.visible = false;
    this.root.add(this.flash);
    this.geometries = {
      m4a1: shellGeometry('m4a1'),
      ak47: shellGeometry('ak47'),
      m1911: shellGeometry('m1911'),
    };
    const brass = paletteMaterial(FP_PALETTE.brass, { roughness: 0.4, metalness: 0.6 });
    for (let i = 0; i < M.shell.poolSize; i++) {
      const mesh = new THREE.Mesh(this.geometries.m4a1, brass);
      mesh.visible = false;
      this.root.add(mesh);
      this.shells.push({ mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0 });
    }
  }

  /** Shows the flash at the muzzle (world = camera space) with a random roll. */
  muzzleFlash(muzzle: THREE.Object3D, scale: number): void {
    muzzle.getWorldPosition(this.flash.position);
    muzzle.getWorldQuaternion(this.flash.quaternion);
    this.flash.rotateZ(Math.random() * Math.PI * 2);
    this.flash.scale.setScalar(scale * (0.8 + Math.random() * 0.4));
    this.flash.visible = true;
    this.flashTime = M.muzzleFlashTime;
  }

  /** Ejects a shell from the port: to the weapon's right, up and slightly back, spinning. */
  ejectShell(id: WeaponId, port: THREE.Object3D): void {
    const s = this.shells[this.next];
    this.next = (this.next + 1) % this.shells.length;
    s.mesh.geometry = this.geometries[id];
    port.getWorldPosition(s.mesh.position);
    port.getWorldQuaternion(tmpQ);
    s.mesh.quaternion.copy(tmpQ);
    const sp = M.shell.speed;
    const j = M.shell.spread;
    tmp.set(sp[0] * (1 + (Math.random() - 0.5) * j), sp[1] * (1 + (Math.random() - 0.5) * j), sp[2]);
    s.velocity.copy(tmp.applyQuaternion(tmpQ));
    s.spin.set((Math.random() - 0.5) * M.shell.spin, M.shell.spin, (Math.random() - 0.5) * M.shell.spin);
    s.age = 0;
    s.mesh.visible = true;
  }

  update(dt: number): void {
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flash.visible = false;
    }
    for (const s of this.shells) {
      if (!s.mesh.visible) continue;
      s.age += dt;
      if (s.age > M.shell.life) {
        s.mesh.visible = false;
        continue;
      }
      s.velocity.y -= M.shell.gravity * dt;
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
    }
  }

  dispose(): void {
    for (const g of Object.values(this.geometries)) g.dispose();
    this.flash.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}

function shellGeometry(id: WeaponId): THREE.CylinderGeometry {
  const [r, l] = SHELL_SIZE[id];
  return new THREE.CylinderGeometry(r, r, l, 6).rotateX(Math.PI / 2);
}

/** Star-shaped flash: crossed flat petals plus a forward cone, additive and unlit. */
function buildFlash(): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.MeshBasicMaterial({ color: FP_PALETTE.flashOuter, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const core = new THREE.MeshBasicMaterial({ color: FP_PALETTE.flashCore, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const petal = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.01), new THREE.Vector2(0.075, 0), new THREE.Vector2(0, -0.01)]));
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(petal, outer);
    m.rotation.z = (i / 5) * Math.PI * 2;
    g.add(m);
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.11, 6, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.055), core);
  g.add(cone);
  return g;
}
