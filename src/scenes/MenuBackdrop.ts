import * as THREE from 'three';
import { MENU_BACKDROP as CFG } from '../data/menu';
import { disposeObject } from '../render/dispose';

/** Low-cost city fly-over shown behind the main menu and loadout screens. */
export class MenuBackdrop {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private angle = 0;

  constructor() {
    const c = CFG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 1, c.near, c.far);
    this.scene.background = new THREE.Color(CFG.sky);
    this.scene.fog = new THREE.Fog(CFG.sky, CFG.fogNear, CFG.fogFar);
    this.scene.add(new THREE.HemisphereLight(CFG.hemi.sky, CFG.hemi.ground, CFG.hemi.intensity));
    const sun = new THREE.DirectionalLight(CFG.sun.color, CFG.sun.intensity);
    sun.position.set(...CFG.sun.position);
    this.scene.add(sun);
    this.buildCity();
    this.update(0);
  }

  update(dt: number): void {
    const c = CFG.camera;
    this.angle += c.orbitSpeed * dt;
    this.camera.position.set(Math.sin(this.angle) * c.orbitRadius, c.height, Math.cos(this.angle) * c.orbitRadius);
    this.camera.lookAt(0, c.lookHeight, 0);
  }

  dispose(): void {
    disposeObject(this.scene);
  }

  private buildCity(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: CFG.groundColor, flatShading: true }),
    );
    this.scene.add(ground);

    const blocks: { x: number; z: number; size: number; height: number; color: number }[] = [];
    const n = CFG.gridHalfCount;
    let k = 0;
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        if (i === 0 || j === 0) continue; // avenues
        const size = CFG.footprints[k % CFG.footprints.length];
        const floors = CFG.floorPattern[(k * 5 + 3) % CFG.floorPattern.length];
        const color = CFG.colors[(k * 3 + 1) % CFG.colors.length];
        blocks.push({ x: i * CFG.blockSpacing, z: j * CFG.blockSpacing, size, height: floors * CFG.floorHeight, color });
        k++;
      }
    }

    const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const buildings = new THREE.InstancedMesh(
      unitBox,
      new THREE.MeshStandardMaterial({ flatShading: true }),
      blocks.length,
    );
    const sidewalks = new THREE.InstancedMesh(
      unitBox.clone(),
      new THREE.MeshStandardMaterial({ color: CFG.sidewalkColor, flatShading: true }),
      blocks.length,
    );
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    blocks.forEach((b, idx) => {
      m.makeScale(b.size, b.height, b.size).setPosition(b.x, 0, b.z);
      buildings.setMatrixAt(idx, m);
      buildings.setColorAt(idx, color.setHex(b.color));
      const walk = b.size + CFG.sidewalkMargin * 2;
      m.makeScale(walk, 0.15, walk).setPosition(b.x, 0, b.z);
      sidewalks.setMatrixAt(idx, m);
    });
    this.scene.add(buildings, sidewalks);
  }
}
