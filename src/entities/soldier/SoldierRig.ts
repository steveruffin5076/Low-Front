import * as THREE from 'three';
import { POSE_BONES, type SoldierPose } from '../../anim/SoldierAnimator';
import { solveTwoBone } from '../../anim/TwoBoneIK';
import { ELBOW_POLES, FIRE_KICK, RELOAD, SOLDIER_DIMENSIONS, STOWED, type HoldPose } from '../../data/soldier';
import type { WeaponId, WeaponSlot } from '../../data/weapons';
import { buildWeaponModel } from '../../weapons/models/weaponModels';
import type { SoldierModel } from './SoldierModel';

/** Weapon points the rig needs, in the weapon frame (origin = right-hand grip). */
interface WeaponPoints {
  leftGrip: THREE.Vector3;
  /** Where the left hand takes hold of the magazine. */
  magGrab: THREE.Vector3;
}

const pointsCache = new Map<WeaponId, WeaponPoints>();

function weaponPoints(id: WeaponId): WeaponPoints {
  let p = pointsCache.get(id);
  if (!p) {
    const m = buildWeaponModel(id, 'tp');
    m.root.updateMatrixWorld(true);
    const magGrab = m.points.magWell.getWorldPosition(new THREE.Vector3());
    magGrab.y -= RELOAD.dropDepth;
    p = { leftGrip: m.points.leftHandGrip.getWorldPosition(new THREE.Vector3()), magGrab };
    pointsCache.set(id, p);
  }
  return p;
}

/** Left hand rests here (chest frame) while the weapons change hands. */
const LEFT_REST = new THREE.Vector3(-0.2, -0.28, -0.12);

const DOWN = new THREE.Vector3(0, -1, 0);
const euler = new THREE.Euler();
const m1 = new THREE.Matrix4();
const m2 = new THREE.Matrix4();
const held = new THREE.Matrix4();
const stowed = new THREE.Matrix4();
const rootInv = new THREE.Matrix4();
const chestInv = new THREE.Matrix4();
const weaponW = new THREE.Matrix4();
const weaponInv = new THREE.Matrix4();
const pA = new THREE.Vector3();
const pB = new THREE.Vector3();
const sA = new THREE.Vector3();
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const qWeaponChest = new THREE.Quaternion();
const qUpper = new THREE.Quaternion();
const qFore = new THREE.Quaternion();
const shoulder = new THREE.Vector3();
const target = new THREE.Vector3();
const pole = new THREE.Vector3();
const elbow = new THREE.Vector3();
const hand = new THREE.Vector3();
const dir = new THREE.Vector3();
const leftHandChest = new THREE.Vector3();

function poseMatrix(pos: readonly number[], rot: readonly number[], out: THREE.Matrix4): THREE.Matrix4 {
  euler.set(rot[0], rot[1], rot[2]);
  return out.makeRotationFromEuler(euler).setPosition(pos[0], pos[1], pos[2]);
}

/**
 * Applies a `SoldierPose` to a soldier's skeleton: body bone rotations, both weapons (in the
 * hands, on the back sling or in the hip holster) and the arms, solved with two-bone IK onto the
 * weapon's grips (and to the magazine and pouch during a reload).
 */
export class SoldierRig {
  private readonly points: Record<WeaponSlot, WeaponPoints>;

  constructor(private readonly model: SoldierModel) {
    this.points = { primary: weaponPoints(model.loadout.primary), secondary: weaponPoints(model.loadout.secondary) };
  }

  apply(pose: SoldierPose): void {
    const b = this.model.bones;
    for (const name of POSE_BONES) {
      const r = pose.rot[name];
      b[name].rotation.set(r[0], r[1], r[2]);
    }
    b.root.position.y = pose.rootY;
    b.hips.position.y = pose.hipsY;
    b.root.updateMatrixWorld(true);
    rootInv.copy(b.root.matrixWorld).invert();
    chestInv.copy(b.chest.matrixWorld).invert();

    // Weapons: the active one between the hold and its stowed spot, the other one stowed.
    const active = pose.active;
    for (const slot of ['primary', 'secondary'] as const) {
      this.stowedMatrix(slot, stowed);
      if (slot === active) {
        this.heldMatrix(pose.hold, pose.kick, held);
        if (pose.stow > 0) blend(held, stowed, pose.stow, weaponW);
        else weaponW.copy(held);
      } else {
        weaponW.copy(stowed);
      }
      m1.multiplyMatrices(rootInv, weaponW);
      m1.decompose(b[slot].position, b[slot].quaternion, sA);
      b[slot].updateMatrixWorld(true);
      if (slot === active) this.solveArms(pose, weaponW);
    }
    // Arms and magazines moved after the first update; hitboxes read these matrices.
    for (const bone of [b.upperArmL, b.upperArmR, b.primary, b.secondary]) bone.updateMatrixWorld(true);
  }

  private heldMatrix(hold: HoldPose, kick: number, out: THREE.Matrix4): void {
    poseMatrix(
      [hold.pos[0], hold.pos[1], hold.pos[2] + FIRE_KICK.back * kick],
      [hold.rot[0] + FIRE_KICK.pitch * kick, hold.rot[1], hold.rot[2]],
      m2,
    );
    out.multiplyMatrices(this.model.bones.chest.matrixWorld, m2);
  }

  private stowedMatrix(slot: WeaponSlot, out: THREE.Matrix4): void {
    const rifle = slot === 'primary';
    const s = rifle ? STOWED.rifle : STOWED.pistol;
    poseMatrix(s.pos, s.rot, m2);
    out.multiplyMatrices((rifle ? this.model.bones.chest : this.model.bones.hips).matrixWorld, m2);
  }

  private solveArms(pose: SoldierPose, weapon: THREE.Matrix4): void {
    const b = this.model.bones;
    const pts = this.points[pose.active];
    // Everything below is in the chest frame.
    m1.multiplyMatrices(chestInv, weapon);
    m1.decompose(pA, qWeaponChest, sA);

    // Right hand on the grip (the weapon origin).
    const rightTarget = pA.clone();
    // Left hand: support grip → magazine → pouch, and off the weapon while switching.
    const grip = pB.copy(pts.leftGrip).applyMatrix4(m1);
    leftHandChest.copy(grip).lerp(target.copy(pts.magGrab).applyMatrix4(m1), pose.toMag);
    leftHandChest.lerp(target.set(RELOAD.pouch[0], RELOAD.pouch[1], RELOAD.pouch[2]), pose.toPouch);
    if (pose.stow > 0) leftHandChest.lerp(LEFT_REST, Math.min(1, pose.stow * 2));

    this.solveArm('R', rightTarget);
    this.solveArm('L', leftHandChest);

    // The magazine rides in the left hand between "out" and "in".
    const mag = pose.active === 'primary' ? b.primaryMag : b.secondaryMag;
    const other = pose.active === 'primary' ? b.secondaryMag : b.primaryMag;
    other.position.set(0, 0, 0);
    if (pose.magInHand) {
      weaponInv.copy(m1).invert();
      mag.position.copy(target.copy(leftHandChest).applyMatrix4(weaponInv)).sub(pts.magGrab);
    } else {
      mag.position.set(0, 0, 0);
    }
  }

  private solveArm(side: 'L' | 'R', handTarget: THREE.Vector3): void {
    const b = this.model.bones;
    const upper = side === 'L' ? b.upperArmL : b.upperArmR;
    const fore = side === 'L' ? b.forearmL : b.forearmR;
    const handBone = side === 'L' ? b.handL : b.handR;
    const p = ELBOW_POLES[side];
    shoulder.copy(this.model.restPos[side === 'L' ? 'upperArmL' : 'upperArmR']);
    pole.set(p[0], p[1], p[2]);
    const arm = SOLDIER_DIMENSIONS.arm;
    solveTwoBone(shoulder, handTarget, pole, arm.upper, arm.lower, elbow, hand);
    qUpper.setFromUnitVectors(DOWN, dir.subVectors(elbow, shoulder).normalize());
    upper.quaternion.copy(qUpper);
    dir.subVectors(hand, elbow).normalize().applyQuaternion(qA.copy(qUpper).invert());
    qFore.setFromUnitVectors(DOWN, dir);
    fore.quaternion.copy(qFore);
    // The hand takes the weapon's orientation.
    handBone.quaternion.copy(qB.multiplyQuaternions(qUpper, qFore).invert().multiply(qWeaponChest));
  }
}

const bp = new THREE.Vector3();
const bq = new THREE.Quaternion();
const bs = new THREE.Vector3();
const cp = new THREE.Vector3();
const cq = new THREE.Quaternion();

/** Blends two rigid transforms (position lerp, rotation slerp). */
function blend(a: THREE.Matrix4, b: THREE.Matrix4, t: number, out: THREE.Matrix4): void {
  a.decompose(bp, bq, bs);
  b.decompose(cp, cq, bs);
  bp.lerp(cp, t);
  bq.slerp(cq, t);
  out.compose(bp, bq, bs.set(1, 1, 1));
}
