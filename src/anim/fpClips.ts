import * as THREE from 'three';
import { VIEWMODEL_MOTION as M, type ViewmodelDef } from '../data/viewmodel';
import { WEAPON_TIMING } from '../data/weaponTiming';
import type { CycleNode, WeaponDef } from '../data/weapons';
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
/** Racking the charging handle on an empty reload: rifle rolled and turned so its right side (charging handle) faces the camera. */
const RACK_POSE = [0.3, 0, 1.2] as const;
type V = readonly number[];
const add = (a: THREE.Vector3, b: THREE.Vector3, k = 1): number[] => [a.x + b.x * k, a.y + b.y * k, a.z + b.z * k];

/** The part that cycles each shot (bolt carrier, charging handle, slide or pump). */
export function cycleNode(def: WeaponDef): CycleNode {
  return def.action.cycleNode;
}

/** One shot. On the last round a locking bolt or slide stays back (event `lock`). */
export function fireClip(c: ClipContext, lastRound: boolean): Clip {
  if (c.def.action.manual) return manualFireClip(c, lastRound);
  const interval = 60 / c.def.rpm;
  const d = Math.min(interval * 0.9, 0.12);
  const b = new ClipBuilder('fire', d);
  const node = cycleNode(c.def);
  const travel = c.vm.cycleTravel;
  const locks = lastRound && c.def.action.locksOnEmpty;
  b.key(`node.${node}.pos`, 0, ZERO3).key(`node.${node}.pos`, d * 0.4, [0, 0, travel], 'out');
  b.key(`node.${node}.pos`, d, locks ? [0, 0, travel] : ZERO3, 'in');
  if (c.def.action.hammer) {
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

/**
 * Shot from a manual action: trigger, then the shooter works the pump (left hand rides it back and
 * forward) or the bolt. Events: `cycleBack` (the case is thrown out), `slideClose`. After the last
 * round the action is still worked, so the gun is ready to load.
 */
function manualFireClip(c: ClipContext, _lastRound: boolean): Clip {
  const d = (60 / c.def.rpm) * 0.85;
  const b = new ClipBuilder('fire', d);
  if (c.vm.bolt) {
    b.key('node.trigger.rot', 0, ZERO3).key('node.trigger.rot', 0.04, [-0.3, 0, 0], 'out').key('node.trigger.rot', 0.15, ZERO3);
    addBoltCycle(b, c, d * 0.2, d * 0.8, true);
    return b.build();
  }
  const node = cycleNode(c.def);
  const travel = c.vm.cycleTravel;
  const back = d * 0.45;
  const fwd = d * 0.7;
  b.key('node.trigger.rot', 0, ZERO3).key('node.trigger.rot', 0.04, [-0.3, 0, 0], 'out').key('node.trigger.rot', 0.15, ZERO3);
  b.key(`node.${node}.pos`, 0, ZERO3).key(`node.${node}.pos`, d * 0.2, ZERO3);
  b.key(`node.${node}.pos`, back, [0, 0, travel], 'inOut').key(`node.${node}.pos`, fwd, ZERO3, 'inOut');
  // The support hand stays on the pump while it moves.
  const grip = c.leftGrip;
  b.key('leftHand.blend', 0, [1]).key('leftHand.blend', d, [1]);
  b.key('leftHand.pos', 0, grip.toArray()).key('leftHand.pos', d * 0.2, grip.toArray());
  b.key('leftHand.pos', back, add(grip, new THREE.Vector3(0, 0, travel)), 'inOut').key('leftHand.pos', fwd, grip.toArray(), 'inOut');
  // The weapon dips with the stroke.
  b.key('weapon.rot', d * 0.2, ZERO3).key('weapon.rot', back, [0.03, 0, -0.05], 'inOut').key('weapon.rot', d, ZERO3, 'inOut');
  return b.event(back, 'cycleBack').event(fwd, 'slideClose').build();
}

/**
 * Bolt worked by hand over `d` seconds from `t0`: the right hand leaves the grip for the knob, lifts
 * the handle, pulls the bolt back (case out), pushes it forward and turns it down. The rifle cants
 * toward the hand (`afterShot`; a reload already holds its own pose). Events: `cycleBack` (throws the
 * case out, after a shot) or `boltOpen` (empty chamber), then `slideClose`.
 */
function addBoltCycle(b: ClipBuilder, c: ClipContext, t0: number, d: number, afterShot: boolean): void {
  const bolt = c.vm.bolt!;
  const travel = c.vm.cycleTravel;
  const pivot = c.nodePos('bolt');
  const knob = new THREE.Vector3(...bolt.knob);
  const knobAt = (lift: number, back: number): number[] => {
    const k = knob.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), lift);
    return [pivot.x + k.x + 0.01, pivot.y + k.y - 0.01, pivot.z + k.z + back + 0.02];
  };
  const t = (f: number): number => t0 + d * f;
  const up: V = [0, 0, bolt.lift];
  b.key('rightHand.blend', t0, [0]).key('rightHand.blend', t(0.18), [1]).key('rightHand.blend', t(0.85), [1]).key('rightHand.blend', t(1), [0], 'inOut');
  b.key('rightHand.pos', t0, knobAt(0, 0)).key('rightHand.pos', t(0.18), knobAt(0, 0));
  b.key('rightHand.pos', t(0.32), knobAt(bolt.lift, 0), 'out').key('rightHand.pos', t(0.5), knobAt(bolt.lift, travel), 'inOut');
  b.key('rightHand.pos', t(0.68), knobAt(bolt.lift, 0), 'inOut').key('rightHand.pos', t(0.8), knobAt(0, 0), 'in');
  b.key('node.bolt.rot', t0, ZERO3).key('node.bolt.rot', t(0.18), ZERO3).key('node.bolt.rot', t(0.32), up, 'out');
  b.key('node.bolt.rot', t(0.68), up).key('node.bolt.rot', t(0.8), ZERO3, 'in');
  b.key('node.bolt.pos', t(0.32), ZERO3).key('node.bolt.pos', t(0.5), [0, 0, travel], 'inOut').key('node.bolt.pos', t(0.68), ZERO3, 'inOut');
  if (afterShot) {
    b.key('weapon.rot', t0, ZERO3).key('weapon.rot', t(0.2), [0.04, 0.05, 0.12], 'inOut').key('weapon.rot', t(0.8), [0.04, 0.05, 0.12]);
    b.key('weapon.rot', t(1), ZERO3, 'inOut');
  }
  b.event(t(0.5), afterShot ? 'cycleBack' : 'boltOpen').event(t(0.68), 'slideClose');
}

/** Empty trigger: small trigger movement only. */
export function dryFireClip(c: ClipContext): Clip {
  const d = 0.18;
  const b = new ClipBuilder('dryFire', d);
  if (c.def.action.trigger === 'slide') b.key('node.trigger.pos', 0, ZERO3).key('node.trigger.pos', 0.05, [0, 0, 0.003]).key('node.trigger.pos', d, ZERO3);
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

/**
 * Shell-by-shell reload. `shellStartClip` tilts the gun and loads the first shell; each
 * `shellInsertClip` loads one more; `shellEndClip` returns to the hip. All three share the
 * loading pose at their ends, so they follow each other without blending. Event: `magIn` per shell.
 */
export function shellStartClip(c: ClipContext): Clip {
  const sr = c.def.shellReload!;
  const b = new ClipBuilder('shellStart', sr.start + sr.perShell);
  const pose = c.vm.reloadPose;
  b.key('weapon.rot', 0, ZERO3).key('weapon.rot', sr.start, pose.rot, 'inOut');
  b.key('weapon.pos', 0, ZERO3).key('weapon.pos', sr.start, pose.pos, 'inOut');
  b.key('leftHand.blend', 0, [0]).key('leftHand.blend', sr.start * 0.6, [1]);
  b.key('leftHand.pos', 0, c.leftGrip.toArray()).key('leftHand.pos', sr.start, c.vm.pouch, 'inOut');
  addShellInsert(b, c, sr.start, sr.perShell);
  return b.build();
}

export function shellInsertClip(c: ClipContext): Clip {
  const sr = c.def.shellReload!;
  const b = new ClipBuilder('shellInsert', sr.perShell);
  addShellInsert(b, c, 0, sr.perShell);
  return b.build();
}

export function shellEndClip(c: ClipContext): Clip {
  const sr = c.def.shellReload!;
  const b = new ClipBuilder('shellEnd', sr.end);
  const pose = c.vm.reloadPose;
  b.key('weapon.rot', 0, pose.rot).key('weapon.rot', sr.end, ZERO3, 'inOut');
  b.key('weapon.pos', 0, pose.pos).key('weapon.pos', sr.end, ZERO3, 'inOut');
  b.key('leftHand.blend', 0, [1]).key('leftHand.blend', sr.end, [0], 'inOut');
  b.key('leftHand.pos', 0, c.vm.pouch).key('leftHand.pos', sr.end, c.leftGrip.toArray(), 'inOut');
  return b.build();
}

/** Hand brings a shell from the pouch to the loading port and thumbs it in, then goes back for the next. */
function addShellInsert(b: ClipBuilder, c: ClipContext, t0: number, d: number): void {
  const pose = c.vm.reloadPose;
  const axis = new THREE.Vector3(...c.vm.magAxis).normalize();
  const mw = c.magWell;
  const pouch = new THREE.Vector3(...c.vm.pouch);
  const below = add(mw, axis, 0.05);
  const fromPouch: V = [pouch.x - mw.x, pouch.y - mw.y, pouch.z - mw.z];
  const t = (f: number): number => t0 + d * f;
  b.key('weapon.rot', t0, pose.rot).key('weapon.rot', t(1), pose.rot);
  b.key('weapon.pos', t0, pose.pos).key('weapon.pos', t(0.62), pose.pos);
  b.key('weapon.pos', t(0.7), [pose.pos[0], pose.pos[1] - 0.008, pose.pos[2]], 'out').key('weapon.pos', t(1), pose.pos);
  b.key('leftHand.blend', t0, [1]).key('leftHand.blend', t(1), [1]);
  b.key('leftHand.pos', t0, pouch.toArray()).key('leftHand.pos', t(0.45), below, 'inOut');
  b.key('leftHand.pos', t(0.65), mw.toArray(), 'in').key('leftHand.pos', t(1), pouch.toArray(), 'inOut');
  // The shell rides in the hand from the pouch and is pushed through the port into the tube.
  b.key('node.magazine.pos', t0, fromPouch, 'hold').key('node.magazine.pos', t(0.45), axis.clone().multiplyScalar(0.05).toArray(), 'inOut');
  b.key('node.magazine.pos', t(0.65), ZERO3, 'in');
  b.key('mag.visible', t0, [1]).key('mag.visible', t(1), [1]);
  b.event(t(0.65), 'magIn');
}

/** After seating: press the bolt release, rack the charging handle, or drop the slide stop. */
function addEmptyAction(b: ClipBuilder, c: ClipContext, seat: number, D: number, locked: boolean): void {
  const travel = c.vm.cycleTravel;
  const node = cycleNode(c.def);
  const start = locked ? [0, 0, travel] : ZERO3;
  const kind = c.def.action.emptyReload;
  if (kind === 'boltRelease') {
    const release = c.nodePos('boltRelease');
    const press = [release.x - 0.035, release.y - 0.01, release.z + 0.01];
    b.key('leftHand.pos', seat + 0.25, press, 'inOut').key('leftHand.pos', seat + 0.42, press);
    b.key('node.boltRelease.pos', seat + 0.3, ZERO3).key('node.boltRelease.pos', seat + 0.34, [0.0025, 0, 0]).key('node.boltRelease.pos', seat + 0.45, ZERO3);
    b.key(`node.${node}.pos`, 0, start).key(`node.${node}.pos`, seat + 0.33, start).key(`node.${node}.pos`, seat + 0.37, ZERO3, 'in');
    b.event(seat + 0.37, 'slideClose');
  } else if (kind === 'rack') {
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
  } else if (kind === 'bolt') {
    addBoltCycle(b, c, seat + 0.1, D - seat - 0.25, false);
  } else {
    // Thumb presses the slide stop, the slide snaps closed.
    b.key('node.slideStop.rot', 0, locked ? [-0.25, 0, 0] : ZERO3).key('node.slideStop.rot', seat + 0.12, locked ? [-0.25, 0, 0] : ZERO3);
    b.key('node.slideStop.rot', seat + 0.18, ZERO3);
    b.key(`node.${node}.pos`, 0, start).key(`node.${node}.pos`, seat + 0.16, start).key(`node.${node}.pos`, seat + 0.22, ZERO3, 'in');
    b.event(seat + 0.22, 'slideClose');
  }
}
