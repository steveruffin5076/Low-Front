import * as THREE from 'three';
import { VIEWMODEL_MOTION as M, type ViewmodelDef } from '../data/viewmodel';
import { WEAPON_TIMING } from '../data/weaponTiming';
import type { WeaponDef } from '../data/weapons';
import { ClipBuilder, type Clip } from './Timeline';

/**
 * First-person clips (plan section 8.1). Channels:
 * - `weapon.pos` / `weapon.rot`: offsets added to the weapon pose (camera space).
 * - `node.<name>.pos` / `node.<name>.rot`: offsets added to a moving part's rest pose.
 * - `mag.visible`: 0 hides the magazine.
 * - `leftHand.blend` / `leftHand.pos` (and `rightHand.*`): hand target in weapon space, blended with the grip.
 * Events: `magOut`, `magIn`, `magSeated`, `slideClose`, `lock`.
 */
export interface ClipContext {
  def: WeaponDef;
  vm: ViewmodelDef;
  /** Weapon-space positions taken from the model. */
  magWell: THREE.Vector3;
  leftGrip: THREE.Vector3;
  nodePos: (name: string) => THREE.Vector3;
}

const ZERO3 = [0, 0, 0] as const;
/** AK47 empty reload: rifle rolled and turned so its right side (charging handle) faces the camera. */
const RACK_POSE = [0.3, 0, 1.2] as const;
type V = readonly number[];
const add = (a: THREE.Vector3, b: THREE.Vector3, k = 1): number[] => [a.x + b.x * k, a.y + b.y * k, a.z + b.z * k];

/** Bolt carrier (M4A1), charging handle (AK47) or slide (M1911): the part that cycles each shot. */
export function cycleNode(def: WeaponDef): 'bolt' | 'chargingHandle' | 'slide' {
  return def.id === 'm4a1' ? 'bolt' : def.id === 'ak47' ? 'chargingHandle' : 'slide';
}

/** One shot. On the last round the M4A1 bolt and M1911 slide stay back (event `lock`). */
export function fireClip(c: ClipContext, lastRound: boolean): Clip {
  const interval = 60 / c.def.rpm;
  const d = Math.min(interval * 0.9, 0.12);
  const b = new ClipBuilder('fire', d);
  const node = cycleNode(c.def);
  const travel = c.vm.cycleTravel;
  const locks = lastRound && c.def.id !== 'ak47';
  b.key(`node.${node}.pos`, 0, ZERO3).key(`node.${node}.pos`, d * 0.4, [0, 0, travel], 'out');
  b.key(`node.${node}.pos`, d, locks ? [0, 0, travel] : ZERO3, 'in');
  if (c.def.id === 'm1911') {
    // Hammer falls, then the slide cocks it again (rest pose is cocked).
    b.key('node.hammer.rot', 0, ZERO3).key('node.hammer.rot', d * 0.1, [-0.9, 0, 0], 'linear').key('node.hammer.rot', d * 0.5, ZERO3, 'out');
    b.key('node.trigger.pos', 0, ZERO3).key('node.trigger.pos', d * 0.15, [0, 0, 0.003], 'out').key('node.trigger.pos', d, ZERO3);
    if (locks) b.key('node.slideStop.rot', d * 0.5, ZERO3).key('node.slideStop.rot', d, [-0.25, 0, 0], 'out');
  } else {
    b.key('node.trigger.rot', 0, ZERO3).key('node.trigger.rot', d * 0.15, [-0.3, 0, 0], 'out').key('node.trigger.rot', d, ZERO3);
  }
  if (locks) b.event(d, 'lock');
  return b.build();
}

/** Empty trigger: small trigger movement only. */
export function dryFireClip(c: ClipContext): Clip {
  const d = 0.18;
  const b = new ClipBuilder('dryFire', d);
  if (c.def.id === 'm1911') b.key('node.trigger.pos', 0, ZERO3).key('node.trigger.pos', 0.05, [0, 0, 0.003]).key('node.trigger.pos', d, ZERO3);
  else b.key('node.trigger.rot', 0, ZERO3).key('node.trigger.rot', 0.05, [-0.3, 0, 0]).key('node.trigger.rot', d, ZERO3);
  return b.event(0.05, 'click').build();
}

export function holsterClip(duration: number): Clip {
  return new ClipBuilder('holster', duration)
    .key('weapon.pos', 0, ZERO3).key('weapon.pos', duration, M.holster.pos, 'in')
    .key('weapon.rot', 0, ZERO3).key('weapon.rot', duration, M.holster.rot, 'in')
    .build();
}

export function drawClip(duration: number): Clip {
  return new ClipBuilder('draw', duration)
    .key('weapon.pos', 0, M.holster.pos).key('weapon.pos', duration, ZERO3, 'out')
    .key('weapon.rot', 0, M.holster.rot).key('weapon.rot', duration, ZERO3, 'out')
    .build();
}

/** Weapon rolls slightly while the thumb flips the selector. */
export function fireModeClip(duration: number): Clip {
  return new ClipBuilder('fireMode', duration)
    .key('weapon.rot', 0, ZERO3).key('weapon.rot', duration * 0.35, [0.04, -0.05, -0.12], 'out').key('weapon.rot', duration, ZERO3)
    .event(duration * 0.35, 'click')
    .build();
}

/** Inspect: turn to show the left side, then the right side, then back. */
export function inspectClip(duration: number): Clip {
  const t = (f: number): number => duration * f;
  return new ClipBuilder('inspect', duration)
    .key('weapon.pos', 0, ZERO3).key('weapon.pos', t(0.15), [-0.07, 0.05, -0.03])
    .key('weapon.pos', t(0.4), [-0.07, 0.05, -0.03]).key('weapon.pos', t(0.55), [-0.04, 0.03, -0.02])
    .key('weapon.pos', t(0.8), [-0.04, 0.03, -0.02]).key('weapon.pos', duration, ZERO3)
    .key('weapon.rot', 0, ZERO3).key('weapon.rot', t(0.15), [0.15, 0.95, 0.45])
    .key('weapon.rot', t(0.4), [0.2, 1.0, 0.5]).key('weapon.rot', t(0.55), [0.1, -0.8, -0.55])
    .key('weapon.rot', t(0.8), [0.12, -0.85, -0.6]).key('weapon.rot', duration, ZERO3)
    .build();
}

/**
 * Reload. The magazine change is the same for both kinds; the empty reload adds the
 * weapon's bolt action after the magazine is seated (plan section 8.1).
 */
export function reloadClip(c: ClipContext, kind: 'tactical' | 'empty', startsLocked: boolean): Clip {
  const T = c.def.reload.tactical;
  const D = c.def.reload[kind];
  const seat = T * WEAPON_TIMING.magSeatFraction;
  const f = (x: number): number => T * x;
  const b = new ClipBuilder(`reload-${kind}`, D);

  const axis = new THREE.Vector3(...c.vm.magAxis).normalize();
  const mw = c.magWell;
  const grabDepth = c.vm.leftHand === 'support' ? 0.04 : 0.09;
  const onMag = (offset: number): number[] => add(mw, axis, grabDepth + offset);
  const pouch = new THREE.Vector3(...c.vm.pouch);
  const pouchMagOffset: V = [pouch.x - mw.x - axis.x * grabDepth, pouch.y - mw.y - axis.y * grabDepth, pouch.z - mw.z - axis.z * grabDepth];
  const handEnd = kind === 'tactical' ? 0.9 : (D - 0.2) / T;

  // Weapon tilts toward the left hand, gets a tap when seated, and returns.
  const tilt = c.vm.reloadPose.rot;
  const lift = c.vm.reloadPose.pos;
  const tap: number[] = [lift[0], lift[1] - 0.012, lift[2]];
  b.key('weapon.rot', 0, ZERO3).key('weapon.rot', f(0.15), tilt).key('weapon.rot', seat, tilt);
  b.key('weapon.pos', 0, ZERO3).key('weapon.pos', f(0.15), lift).key('weapon.pos', seat, lift);
  b.key('weapon.pos', seat + 0.05, tap, 'out').key('weapon.pos', seat + 0.12, lift);

  // Left hand: to the magazine, down to the pouch, back with a new magazine, then to the grip.
  b.key('leftHand.blend', 0, [0]).key('leftHand.blend', f(0.12), [1]).key('leftHand.blend', f(handEnd) - 0.18, [1]);
  b.key('leftHand.blend', f(handEnd), [0], 'inOut');
  b.key('leftHand.pos', f(0.12), onMag(0)).key('leftHand.pos', f(0.22), onMag(0));
  b.key('leftHand.pos', f(0.42), pouch.toArray(), 'inOut').key('leftHand.pos', f(0.48), pouch.toArray());
  b.key('leftHand.pos', f(0.6), onMag(0.08), 'inOut').key('leftHand.pos', seat, onMag(0), 'back');

  // Magazine: drops out and disappears, reappears in the hand, slides in and seats.
  b.key('node.magazine.pos', f(0.22), ZERO3).key('node.magazine.pos', f(0.25), axis.clone().multiplyScalar(0.03).toArray(), 'out');
  b.key('node.magazine.pos', f(0.36), axis.clone().multiplyScalar(0.6).toArray(), 'in');
  b.key('node.magazine.pos', f(0.37), pouchMagOffset, 'hold').key('node.magazine.pos', f(0.48), pouchMagOffset);
  b.key('node.magazine.pos', f(0.6), axis.clone().multiplyScalar(0.08).toArray(), 'inOut').key('node.magazine.pos', seat, ZERO3, 'back');
  b.key('mag.visible', 0, [1]).key('mag.visible', f(0.36), [1]).key('mag.visible', f(0.37), [0], 'hold').key('mag.visible', f(0.42), [0]).key('mag.visible', f(0.43), [1], 'hold');
  b.event(f(0.24), 'magOut').event(seat, 'magIn').event(seat, 'magSeated');

  if (kind === 'empty') addEmptyAction(b, c, seat, D, startsLocked);
  b.key('weapon.rot', D - 0.15, tilt.map((v) => v * 0.3)).key('weapon.rot', D, ZERO3);
  b.key('weapon.pos', D, ZERO3);
  return b.build();
}

/** After seating: M4A1 bolt release, AK47 charging handle rack, M1911 slide stop. */
function addEmptyAction(b: ClipBuilder, c: ClipContext, seat: number, D: number, locked: boolean): void {
  const travel = c.vm.cycleTravel;
  const node = cycleNode(c.def);
  const start = locked ? [0, 0, travel] : ZERO3;
  if (c.def.id === 'm4a1') {
    const release = c.nodePos('boltRelease');
    const press = [release.x - 0.035, release.y - 0.01, release.z + 0.01];
    b.key('leftHand.pos', seat + 0.25, press, 'inOut').key('leftHand.pos', seat + 0.42, press);
    b.key('node.boltRelease.pos', seat + 0.3, ZERO3).key('node.boltRelease.pos', seat + 0.34, [0.0025, 0, 0]).key('node.boltRelease.pos', seat + 0.45, ZERO3);
    b.key(`node.${node}.pos`, 0, start).key(`node.${node}.pos`, seat + 0.33, start).key(`node.${node}.pos`, seat + 0.37, ZERO3, 'in');
    b.event(seat + 0.37, 'slideClose');
  } else if (c.def.id === 'ak47') {
    // Right hand reaches over the top and racks the charging handle.
    const ch = c.nodePos('chargingHandle');
    const grab = [ch.x + 0.012, ch.y, ch.z + 0.01];
    const pulled = [grab[0], grab[1], grab[2] + travel];
    b.key('rightHand.blend', seat + 0.05, [0]).key('rightHand.blend', seat + 0.3, [1]).key('rightHand.blend', D - 0.25, [1]).key('rightHand.blend', D - 0.05, [0]);
    b.key('rightHand.pos', seat + 0.3, grab).key('rightHand.pos', seat + 0.5, pulled, 'in').key('rightHand.pos', D - 0.25, pulled);
    b.key(`node.${node}.pos`, seat + 0.3, ZERO3).key(`node.${node}.pos`, seat + 0.5, [0, 0, travel], 'in').key(`node.${node}.pos`, seat + 0.56, ZERO3, 'in');
    // Turn the right side toward the camera so the rack is visible.
    b.key('weapon.rot', seat + 0.25, RACK_POSE).key('weapon.rot', seat + 0.6, RACK_POSE);
    b.event(seat + 0.56, 'slideClose');
  } else {
    // Thumb presses the slide stop, the slide snaps closed.
    b.key('node.slideStop.rot', 0, locked ? [-0.25, 0, 0] : ZERO3).key('node.slideStop.rot', seat + 0.12, locked ? [-0.25, 0, 0] : ZERO3);
    b.key('node.slideStop.rot', seat + 0.18, ZERO3);
    b.key(`node.${node}.pos`, 0, start).key(`node.${node}.pos`, seat + 0.16, start).key(`node.${node}.pos`, seat + 0.22, ZERO3, 'in');
    b.event(seat + 0.22, 'slideClose');
  }
}
