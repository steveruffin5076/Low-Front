import * as THREE from 'three';
import { VIEWMODEL, type ViewmodelDef } from '../data/viewmodel';
import { approach } from '../entities/PlayerMovement';
import { disposeObject } from '../render/dispose';
import type { WeaponModel, NodeName } from '../weapons/models/WeaponModel';
import { buildWeaponModel } from '../weapons/models/weaponModels';
import type { WeaponState } from '../weapons/WeaponState';
import { cycleNode, type ClipContext } from './fpClips';

/** Persistent part poses (rad/s) — how fast the dust cover and selector move. */
const DUST_COVER_OPEN = -2.0;
const DUST_COVER_SPEED = 14;
const SELECTOR_SPEED = 10;
/** The M1911 is carried cocked: the hammer's rest pose is back. */
const HAMMER_COCKED = 0.9;
const SLIDE_STOP_UP = -0.25;

interface Rest {
  pos: THREE.Vector3;
  rot: THREE.Euler;
}

/** One first-person weapon: model, rest poses, part states that persist between clips. */
export class WeaponVisual {
  readonly model: WeaponModel;
  readonly vm: ViewmodelDef;
  readonly ctx: ClipContext;
  /** Sight anchor in weapon space; the ADS pose puts it at the camera. */
  readonly anchor: THREE.Vector3;
  /** Hand frames in weapon space. */
  readonly rightGrip = new THREE.Matrix4();
  readonly leftGrip = new THREE.Matrix4();
  readonly handRotation = { right: new THREE.Quaternion(), left: new THREE.Quaternion() };
  private readonly rest = new Map<NodeName, Rest>();

  dustCoverOpen = false;
  private dustCover = 0;
  private selector: number;
  /** Bolt (M4A1) or slide (M1911) held back after the last round. */
  locked = false;

  constructor(readonly weapon: WeaponState) {
    const id = weapon.def.id;
    this.vm = VIEWMODEL[id];
    this.model = buildWeaponModel(id, 'fp');
    for (const [name, node] of Object.entries(this.model.nodes) as [NodeName, THREE.Object3D][]) {
      this.rest.set(name, { pos: node.position.clone(), rot: node.rotation.clone() });
    }
    // The model root is at identity here, so world positions are weapon-space positions.
    this.model.root.updateMatrixWorld(true);
    const p = this.model.points;
    const local = (o: THREE.Object3D): THREE.Vector3 => o.getWorldPosition(new THREE.Vector3());
    this.anchor = local(p.sightAnchor);
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.vm.gripTilt);
    this.handRotation.right.copy(tilt);
    this.handRotation.left.copy(this.vm.leftHand === 'support' ? tilt : new THREE.Quaternion());
    this.rightGrip.compose(local(p.rightHandGrip), this.handRotation.right, new THREE.Vector3(1, 1, 1));
    this.leftGrip.compose(local(p.leftHandGrip), this.handRotation.left, new THREE.Vector3(1, 1, 1));
    this.selector = this.vm.selector[weapon.fireMode];
    // Record part positions now, while the model is at the origin; later it is posed in camera space.
    const nodePositions = new Map<string, THREE.Vector3>();
    for (const [name, node] of Object.entries(this.model.nodes)) nodePositions.set(name, local(node));
    this.ctx = {
      def: weapon.def,
      vm: this.vm,
      magWell: local(p.magWell),
      leftGrip: local(p.leftHandGrip),
      nodePos: (name) => {
        const pos = nodePositions.get(name);
        if (!pos) throw new Error(`${id} has no node ${name}`);
        return pos.clone();
      },
    };
  }

  /** Writes rest pose + persistent state + clip offsets onto every moving part. */
  applyNodes(dt: number, channels: Map<string, number[]>): void {
    this.dustCover = approach(this.dustCover, this.dustCoverOpen ? DUST_COVER_OPEN : 0, DUST_COVER_SPEED * dt);
    this.selector = approach(this.selector, this.vm.selector[this.weapon.fireMode], SELECTOR_SPEED * dt);
    const cycle = cycleNode(this.weapon.def);

    for (const [name, rest] of this.rest) {
      const node = this.model.nodes[name]!;
      node.position.copy(rest.pos);
      node.rotation.copy(rest.rot);
      if (name === 'dustCover') node.rotation.z += this.dustCover;
      if (name === 'selector') node.rotation.x += this.selector;
      if (name === 'hammer') node.rotation.x += HAMMER_COCKED;
      if (this.locked && name === cycle) node.position.z += this.vm.cycleTravel;
      if (this.locked && name === 'slideStop') node.rotation.x += SLIDE_STOP_UP;
      const p = channels.get(`node.${name}.pos`);
      if (p) node.position.set(node.position.x + p[0], node.position.y + p[1], node.position.z + p[2]);
      const r = channels.get(`node.${name}.rot`);
      if (r) node.rotation.set(node.rotation.x + r[0], node.rotation.y + r[1], node.rotation.z + r[2]);
    }
    const mag = this.model.nodes.magazine;
    const visible = channels.get('mag.visible');
    if (mag) mag.visible = !visible || visible[0] >= 0.5;
  }

  dispose(): void {
    disposeObject(this.model.root);
  }
}
