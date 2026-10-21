import * as THREE from 'three';
import { PALETTE, UI_PALETTE } from '../data/palette';
import type { WeaponId } from '../data/weapons';
import { buildPlaceholderWeapon } from '../weapons/models/PlaceholderWeapon';
import { disposeObject } from '../render/dispose';

/** Blocky stand-in soldier (~1.8 m) used until the real soldier arrives in Phase 6. Faces +Z. */
type Part = { size: [number, number, number]; pos: [number, number, number]; color: number; rotX?: number };

const BODY: Record<string, Part> = {
  legL: { size: [0.16, 0.86, 0.18], pos: [-0.11, 0.43, 0], color: PALETTE.blueTeam },
  legR: { size: [0.16, 0.86, 0.18], pos: [0.11, 0.43, 0], color: PALETTE.blueTeam },
  bootL: { size: [0.17, 0.1, 0.26], pos: [-0.11, 0.05, 0.04], color: UI_PALETTE.boots },
  bootR: { size: [0.17, 0.1, 0.26], pos: [0.11, 0.05, 0.04], color: UI_PALETTE.boots },
};

/** Upper body parts are children of the chest pivot so the idle breath moves them together. */
const UPPER: Record<string, Part> = {
  torso: { size: [0.42, 0.56, 0.24], pos: [0, 0.28, 0], color: PALETTE.blueTeam },
  vest: { size: [0.44, 0.4, 0.28], pos: [0, 0.3, 0], color: UI_PALETTE.vest },
  pack: { size: [0.32, 0.4, 0.14], pos: [0, 0.3, -0.2], color: UI_PALETTE.vest },
  head: { size: [0.2, 0.22, 0.22], pos: [0, 0.69, 0], color: UI_PALETTE.skin },
  helmet: { size: [0.25, 0.12, 0.27], pos: [0, 0.81, -0.01], color: UI_PALETTE.helmet },
  armR: { size: [0.11, 0.42, 0.12], pos: [0.25, 0.36, 0.12], color: PALETTE.blueTeam, rotX: -1.1 },
  armL: { size: [0.11, 0.48, 0.12], pos: [-0.16, 0.36, 0.22], color: PALETTE.blueTeam, rotX: -1.35 },
};

const CHEST_HEIGHT = 0.86;
const WEAPON_POS: [number, number, number] = [0.08, 0.3, 0.32];

export class PlaceholderSoldier {
  readonly root = new THREE.Group();
  private readonly chest = new THREE.Group();
  private weapon: THREE.Group | null = null;

  constructor() {
    const materials = new Map<number, THREE.MeshStandardMaterial>();
    const add = (parent: THREE.Object3D, p: Part): void => {
      let mat = materials.get(p.color);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({ color: p.color, flatShading: true, roughness: 0.85 });
        materials.set(p.color, mat);
      }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), mat);
      mesh.position.set(...p.pos);
      if (p.rotX) mesh.rotation.x = p.rotX;
      parent.add(mesh);
    };
    for (const p of Object.values(BODY)) add(this.root, p);
    this.chest.position.y = CHEST_HEIGHT;
    for (const p of Object.values(UPPER)) add(this.chest, p);
    this.root.add(this.chest);
  }

  setWeapon(id: WeaponId): void {
    if (this.weapon) {
      this.chest.remove(this.weapon);
      disposeObject(this.weapon);
    }
    this.weapon = buildPlaceholderWeapon(id);
    this.weapon.position.set(...WEAPON_POS);
    this.chest.add(this.weapon);
  }

  /** Idle: slow breathing rise and a small sway. `t` is time in seconds. */
  idle(t: number, rate: number, breath: number, sway: number): void {
    this.chest.position.y = CHEST_HEIGHT + Math.sin(t * rate) * breath;
    this.chest.rotation.z = Math.sin(t * rate * 0.5) * sway;
  }
}
