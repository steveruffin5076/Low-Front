import * as THREE from 'three';
import { FP_PALETTE } from '../data/palette';
import type { Team } from '../data/soldier';
import { disposeObject } from '../render/dispose';
import { paletteMaterial } from '../render/Materials';
import { applyGameMaterials } from '../weapons/models/glbWeapon';
import { hasModel, instantiate } from '../weapons/models/modelLibrary';

export type GearItem = 'knife' | 'smoke';

/**
 * The free hand for the quick knife and a smoke throw: forearm, glove and the item, posed in
 * camera space by the clip channels `gear.pos`, `gear.rot` and `gear.show` (0 hides it).
 */
export class GearHand {
  readonly root = new THREE.Group();
  private readonly items: Record<GearItem, THREE.Object3D>;

  constructor(team: Team) {
    this.root.name = 'gear-hand';
    this.root.visible = false;
    const sleeve = paletteMaterial(FP_PALETTE.sleeve[team]);
    const glove = paletteMaterial(FP_PALETTE.glove);
    // The forearm runs back and down from the fist toward the elbow (+Z, tilted down).
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.037, 0.26, 6).rotateX(Math.PI / 2).translate(0, 0, 0.15).rotateX(0.55), sleeve);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.075), glove);
    this.root.add(arm, fist);
    this.items = { knife: this.item('knife'), smoke: this.item('smoke') };
    for (const i of Object.values(this.items)) this.root.add(i);
  }

  /** Which item the hand holds for the next clip. */
  hold(item: GearItem): void {
    for (const [k, o] of Object.entries(this.items)) o.visible = k === item;
  }

  apply(channels: Map<string, number[]>): void {
    const show = channels.get('gear.show');
    this.root.visible = !!show && show[0] >= 0.5;
    if (!this.root.visible) return;
    const p = channels.get('gear.pos');
    const r = channels.get('gear.rot');
    if (p) this.root.position.set(p[0], p[1], p[2]);
    if (r) this.root.rotation.set(r[0], r[1], r[2]);
  }

  /** The smoke canister leaves the hand. */
  release(): void {
    this.items.smoke.visible = false;
  }

  dispose(): void {
    disposeObject(this.root);
    this.root.removeFromParent();
  }

  private item(name: GearItem): THREE.Object3D {
    if (hasModel(`gear/${name}`)) {
      const o = instantiate(`gear/${name}`);
      applyGameMaterials(o);
      return o;
    }
    // Models did not load: a plain stand-in.
    const size: [number, number, number] = name === 'knife' ? [0.01, 0.025, 0.24] : [0.06, 0.06, 0.12];
    return new THREE.Mesh(new THREE.BoxGeometry(...size).translate(0, 0, -size[2] / 2 + 0.05), paletteMaterial(0x555a60));
  }
}
