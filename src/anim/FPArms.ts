import type { Team } from '../data/soldier';
import * as THREE from 'three';
import { FP_PALETTE } from '../data/palette';
import { VIEWMODEL_MOTION as M } from '../data/viewmodel';
import { paletteMaterial } from '../render/Materials';
import { disposeObject } from '../render/dispose';
import { Assembly, box, type V3 } from '../weapons/models/ModelKit';
import { solveTwoBone } from './TwoBoneIK';

export type HandStyle = 'grip' | 'handguard' | 'support';

/**
 * Hand shapes, built in the hand's frame (weapon axes; for grip styles the frame is
 * tilted so the grip runs along −Y). `wrist` is where the forearm attaches.
 */
interface HandDef {
  parts: { size: V3; pos: V3; rot?: V3 }[];
  wrist: V3;
}

const HANDS: Record<HandStyle, HandDef> = {
  // Right hand on a pistol grip: palm on the right, three fingers wrap the front, index on the trigger.
  grip: {
    parts: [
      { size: [0.024, 0.08, 0.075], pos: [0.026, -0.008, 0.014] },
      { size: [0.05, 0.017, 0.02], pos: [0.002, -0.002, -0.027] },
      { size: [0.05, 0.017, 0.02], pos: [0.002, -0.021, -0.025] },
      { size: [0.048, 0.016, 0.019], pos: [0.003, -0.04, -0.022] },
      { size: [0.014, 0.05, 0.03], pos: [-0.022, -0.02, -0.012] },
      { size: [0.016, 0.016, 0.055], pos: [0.02, 0.03, -0.035] },
      { size: [0.016, 0.017, 0.05], pos: [-0.02, 0.036, -0.002], rot: [0, 0.3, 0] },
    ],
    wrist: [0.035, 0.01, 0.075],
  },
  // Left hand under a rifle handguard: palm below, fingers up the right side, thumb on the left.
  handguard: {
    parts: [
      { size: [0.07, 0.022, 0.085], pos: [-0.006, -0.014, 0.0] },
      { size: [0.017, 0.046, 0.018], pos: [0.036, 0.008, -0.03] },
      { size: [0.017, 0.048, 0.018], pos: [0.037, 0.009, -0.01] },
      { size: [0.017, 0.046, 0.018], pos: [0.036, 0.008, 0.01] },
      { size: [0.017, 0.04, 0.017], pos: [0.034, 0.005, 0.029] },
      { size: [0.017, 0.04, 0.022], pos: [-0.042, 0.004, -0.02], rot: [0.3, 0, 0] },
    ],
    wrist: [-0.025, -0.045, 0.07],
  },
  // Left hand supporting a pistol: palm on the left of the grip, fingers over the right hand's fingers.
  support: {
    parts: [
      { size: [0.02, 0.07, 0.07], pos: [-0.008, -0.01, 0.004] },
      { size: [0.058, 0.016, 0.018], pos: [0.012, 0.01, -0.04] },
      { size: [0.058, 0.016, 0.018], pos: [0.012, -0.008, -0.041] },
      { size: [0.056, 0.016, 0.018], pos: [0.012, -0.026, -0.04] },
      { size: [0.054, 0.015, 0.017], pos: [0.012, -0.043, -0.037] },
      { size: [0.014, 0.015, 0.05], pos: [-0.004, 0.04, -0.035] },
    ],
    wrist: [-0.03, -0.04, 0.06],
  },
};

const SEGMENTS = 6;

class Arm {
  readonly upper = new THREE.Group();
  readonly lower = new THREE.Group();
  readonly hand = new THREE.Group();
  private handMesh: THREE.Object3D | null = null;
  private wristLocal = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly wrist = new THREE.Vector3();
  private readonly reached = new THREE.Vector3();
  private readonly shoulder: THREE.Vector3;
  private readonly pole: THREE.Vector3;

  constructor(parent: THREE.Object3D, shoulder: V3, pole: V3, team: Team) {
    this.shoulder = new THREE.Vector3(...shoulder);
    this.pole = new THREE.Vector3(...pole).add(this.shoulder);
    const sleeve = paletteMaterial(FP_PALETTE.sleeve[team]);
    const cuff = paletteMaterial(FP_PALETTE.cuff[team]);
    this.upper.add(limb(0.052, 0.045, M.upperArm, sleeve));
    this.lower.add(limb(0.044, 0.034, M.forearm - 0.05, sleeve), limb(0.036, 0.036, 0.05, cuff, M.forearm - 0.05));
    parent.add(this.upper, this.lower, this.hand);
  }

  setStyle(style: HandStyle): void {
    if (this.handMesh) {
      this.hand.remove(this.handMesh);
      disposeObject(this.handMesh);
    }
    const def = HANDS[style];
    const asm = new Assembly(`hand-${style}`);
    const glove = paletteMaterial(FP_PALETTE.glove);
    for (const p of def.parts) asm.add(glove, box(p.size, { pos: p.pos, rot: p.rot }));
    this.handMesh = asm.finishStatic();
    this.hand.add(this.handMesh);
    this.wristLocal.set(...def.wrist);
  }

  /** Places the hand at `frame` and solves the arm so the forearm meets the wrist. */
  solve(frame: THREE.Matrix4): void {
    frame.decompose(this.hand.position, this.hand.quaternion, this.hand.scale);
    this.hand.updateMatrix();
    this.wrist.copy(this.wristLocal).applyMatrix4(this.hand.matrix);
    solveTwoBone(this.shoulder, this.wrist, this.pole, M.upperArm, M.forearm, this.elbow, this.reached);
    this.upper.position.copy(this.shoulder);
    this.upper.lookAt(this.elbow);
    this.lower.position.copy(this.elbow);
    this.lower.lookAt(this.reached);
  }
}

/** A tapered 6-sided limb along +Z from `start`, for `lookAt`-driven bones. */
function limb(r0: number, r1: number, length: number, mat: THREE.Material, start = 0): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r1, r0, length, SEGMENTS).rotateX(Math.PI / 2).translate(0, 0, start + length / 2);
  return new THREE.Mesh(geo, mat);
}

/** Low-poly first-person arms: team-color sleeves, black gloves, IK to hand frames. */
export class FPArms {
  readonly root = new THREE.Group();
  private readonly right: Arm;
  private readonly left: Arm;

  constructor(team: Team = 'blue') {
    const s = M.shoulders;
    this.right = new Arm(this.root, s.right, s.rightPole, team);
    this.left = new Arm(this.root, s.left, s.leftPole, team);
    this.right.setStyle('grip');
  }

  setLeftStyle(style: 'handguard' | 'support'): void {
    this.left.setStyle(style);
  }

  update(rightFrame: THREE.Matrix4, leftFrame: THREE.Matrix4): void {
    this.right.solve(rightFrame);
    this.left.solve(leftFrame);
  }

  dispose(): void {
    disposeObject(this.root);
  }
}
