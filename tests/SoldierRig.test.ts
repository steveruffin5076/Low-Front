import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IDLE_INPUT, SoldierAnimator, type SoldierInput } from '../src/anim/SoldierAnimator';
import { GAIT } from '../src/data/soldier';
import type { Loadout } from '../src/data/weapons';
import { SoldierModel } from '../src/entities/soldier/SoldierModel';
import { SoldierRig } from '../src/entities/soldier/SoldierRig';
import { buildWeaponModel } from '../src/weapons/models/weaponModels';

const DT = 1 / 60;
const LOADOUTS: Loadout[] = [
  { primary: 'm4a1', secondary: 'm1911' },
  { primary: 'ak47', secondary: 'm1911' },
];

function posed(loadout: Loadout, input: Partial<SoldierInput>, setup?: (a: SoldierAnimator) => void, seconds = 1) {
  const model = new SoldierModel('blue', loadout);
  const rig = new SoldierRig(model);
  const anim = new SoldierAnimator();
  setup?.(anim);
  for (let t = 0; t < seconds; t += DT) rig.apply(anim.update(DT, { ...IDLE_INPUT, ...input }));
  model.root.updateMatrixWorld(true);
  return { model, anim };
}

const world = (o: THREE.Object3D): THREE.Vector3 => o.getWorldPosition(new THREE.Vector3());

function leftGripWorld(model: SoldierModel, slot: 'primary' | 'secondary'): THREE.Vector3 {
  const w = buildWeaponModel(model.loadout[slot], 'tp');
  w.root.updateMatrixWorld(true);
  return w.points.leftHandGrip.getWorldPosition(new THREE.Vector3()).applyMatrix4(model.bones[slot].matrixWorld);
}

const STANCES: [string, Partial<SoldierInput>][] = [
  ['idle', {}],
  ['walk', { moveForward: GAIT.walkSpeed }],
  ['crouch', { crouched: true }],
  ['aim up', { pitch: 0.6 }],
  ['aim down', { pitch: -0.6 }],
  ['sprint', { moveForward: GAIT.sprintSpeed, sprinting: true }],
];

describe('soldier rig', () => {
  for (const loadout of LOADOUTS) {
    for (const [name, input] of STANCES) {
      it(`${loadout.primary}: both hands reach their grips (${name})`, () => {
        const { model } = posed(loadout, input);
        expect(world(model.bones.handR).distanceTo(world(model.bones.primary))).toBeLessThan(0.02);
        expect(world(model.bones.handL).distanceTo(leftGripWorld(model, 'primary'))).toBeLessThan(0.02);
      });
    }
  }

  it('holds the pistol in both hands after a switch, with the rifle on the back', () => {
    const { model } = posed(LOADOUTS[0], {}, (a) => a.switchWeapon());
    const b = model.bones;
    expect(world(b.handR).distanceTo(world(b.secondary))).toBeLessThan(0.02);
    expect(world(b.handL).distanceTo(leftGripWorld(model, 'secondary'))).toBeLessThan(0.03);
    // The rifle is behind the chest (soldier faces −Z).
    expect(world(b.primary).z).toBeGreaterThan(world(b.chest).z);
  });

  it('points the rifle forward and the muzzle follows the aim pitch', () => {
    const level = posed(LOADOUTS[0], {}).model;
    const up = posed(LOADOUTS[0], { pitch: 0.6 }).model;
    const muzzleDir = (m: SoldierModel): THREE.Vector3 => new THREE.Vector3(0, 0, -1).applyQuaternion(m.bones.primary.getWorldQuaternion(new THREE.Quaternion()));
    expect(muzzleDir(level).z).toBeLessThan(-0.95);
    expect(muzzleDir(up).y).toBeGreaterThan(muzzleDir(level).y + 0.4);
  });

  it('carries the magazine to the pouch and back during a reload', () => {
    const model = new SoldierModel('red', LOADOUTS[1]);
    const rig = new SoldierRig(model);
    const anim = new SoldierAnimator();
    anim.reload(2);
    let maxOffset = 0;
    for (let t = 0; t < 2.2; t += DT) {
      rig.apply(anim.update(DT, IDLE_INPUT));
      maxOffset = Math.max(maxOffset, model.bones.primaryMag.position.length());
    }
    expect(maxOffset).toBeGreaterThan(0.15);
    expect(model.bones.primaryMag.position.length()).toBe(0);
  });
});
