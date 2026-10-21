import * as THREE from 'three';
import { LIGHTING } from '../data/lighting';
import { MAP } from '../data/map/config';
import type { FlagDef } from '../data/map/types';

/** Flag pole, cloth and the capture-radius ring on the ground. Owner color changes in Phase 7. */
export class FlagVisual {
  readonly root = new THREE.Group();
  private readonly cloth: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private time = Math.random() * 10;

  constructor(readonly def: FlagDef) {
    this.root.position.set(def.x, def.y, def.z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, MAP.flagPoleHeight, 6).translate(0, MAP.flagPoleHeight / 2, 0),
      new THREE.MeshStandardMaterial({ color: 0xd8dde2, flatShading: true, metalness: 0.4, roughness: 0.4 }),
    );
    pole.castShadow = true;
    this.cloth = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.3, 2.2).translate(0, 0, 1.1),
      new THREE.MeshStandardMaterial({ color: LIGHTING.flag.neutral, flatShading: true }),
    );
    this.cloth.position.set(0, MAP.flagPoleHeight - 0.8, 0);
    this.cloth.castShadow = true;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(MAP.flagRadius - 0.35, MAP.flagRadius, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: LIGHTING.flag.neutral, transparent: true, opacity: LIGHTING.flag.ringOpacity, depthWrite: false }),
    );
    this.ring.position.y = 0.2;
    this.root.add(pole, this.cloth, this.ring);
  }

  setColor(color: number): void {
    (this.cloth.material as THREE.MeshStandardMaterial).color.set(color);
    (this.ring.material as THREE.MeshBasicMaterial).color.set(color);
  }

  /** The cloth swings a little in the wind. */
  update(dt: number): void {
    this.time += dt;
    this.cloth.rotation.y = Math.sin(this.time * 1.3) * 0.25;
  }
}
