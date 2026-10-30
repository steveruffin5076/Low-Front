import type { WeaponId } from './weapons';

/**
 * First-person weapon and arm setup (plan section 8). Positions are in camera space
 * (meters, −Z forward, +Y up, +X right); rotations are Euler XYZ in radians.
 */
type V3 = readonly [number, number, number];

export interface PoseDef {
  /** Where the weapon's right-hand grip sits. */
  pos: V3;
  rot: V3;
}

export interface ViewmodelDef {
  hip: PoseDef;
  sprint: PoseDef;
  /** Field of view while aiming. */
  adsFov: number;
  /** Left hand style: on the rifle handguard, or supporting the pistol grip. */
  leftHand: 'handguard' | 'support';
  /** Pistol grip angle (rad around X; negative leans the grip bottom back). */
  gripTilt: number;
  /** Visual kick per shot: back (m), up (rad), roll jitter (rad). Halved while aiming. */
  kick: { back: number; up: number; roll: number };
  /** Bolt, charging handle or slide travel per shot (m). */
  cycleTravel: number;
  /** Magazine leaves the gun along this weapon-local direction. */
  magAxis: V3;
  /** Weapon offset during the magazine change, so the mag well is in view. */
  reloadPose: PoseDef;
  /** Left-hand pouch position in weapon space, off-screen, during reloads. */
  pouch: V3;
  /** Selector angle (rad, around the node's X axis) per fire mode. */
  selector: { auto: number; semi: number };
}

export const VIEWMODEL: Record<WeaponId, ViewmodelDef> = {
  m4a1: {
    hip: { pos: [0.13, -0.235, -0.3], rot: [0, 0.03, 0] },
    sprint: { pos: [0.08, -0.29, -0.26], rot: [-0.35, 0.75, 0.35] },
    adsFov: 55,
    leftHand: 'handguard',
    gripTilt: -0.33,
    kick: { back: 0.035, up: 0.05, roll: 0.02 },
    cycleTravel: 0.07,
    magAxis: [0, -1, -0.15],
    reloadPose: { pos: [-0.02, 0.07, -0.12], rot: [0.25, 0.6, 0] },
    pouch: [-0.12, -0.45, 0.1],
    selector: { semi: Math.PI / 2, auto: Math.PI },
  },
  ak47: {
    hip: { pos: [0.13, -0.235, -0.3], rot: [0, 0.03, 0] },
    sprint: { pos: [0.08, -0.29, -0.26], rot: [-0.35, 0.75, 0.35] },
    adsFov: 55,
    leftHand: 'handguard',
    gripTilt: -0.3,
    kick: { back: 0.045, up: 0.07, roll: 0.03 },
    cycleTravel: 0.1,
    magAxis: [0, -1, -0.35],
    reloadPose: { pos: [-0.02, 0.07, -0.12], rot: [0.25, 0.6, 0] },
    pouch: [-0.12, -0.45, 0.1],
    selector: { auto: -0.22, semi: -0.42 },
  },
  sr9: {
    hip: { pos: [0.12, -0.225, -0.3], rot: [0, 0.03, 0] },
    sprint: { pos: [0.08, -0.29, -0.26], rot: [-0.35, 0.75, 0.35] },
    adsFov: 60,
    leftHand: 'handguard',
    gripTilt: -0.3,
    kick: { back: 0.025, up: 0.035, roll: 0.015 },
    cycleTravel: 0.04,
    magAxis: [0, -1, -0.2],
    reloadPose: { pos: [-0.02, 0.07, -0.12], rot: [0.25, 0.6, 0] },
    pouch: [-0.12, -0.45, 0.1],
    selector: { semi: Math.PI / 2, auto: Math.PI },
  },
  m1911: {
    hip: { pos: [0.1, -0.17, -0.4], rot: [0, 0.04, 0] },
    sprint: { pos: [0.1, -0.3, -0.3], rot: [-0.9, 0.2, 0.1] },
    adsFov: 65,
    leftHand: 'support',
    gripTilt: -0.16,
    kick: { back: 0.03, up: 0.16, roll: 0.03 },
    cycleTravel: 0.035,
    magAxis: [0, -1, 0.16],
    reloadPose: { pos: [-0.06, 0.07, 0.04], rot: [0.5, 0.7, 0.2] },
    pouch: [-0.15, -0.3, 0.15],
    selector: { auto: 0, semi: 0 },
  },
};

/** Procedural motion amounts shared by all weapons. */
export const VIEWMODEL_MOTION = {
  /** Shoulder positions in camera space, and the elbow pole directions. */
  shoulders: {
    right: [0.2, -0.27, 0.12] as V3,
    left: [-0.17, -0.27, 0.0] as V3,
    rightPole: [1.2, -1.0, 0.3] as V3,
    leftPole: [-1.0, -1.2, 0.0] as V3,
  },
  upperArm: 0.3,
  forearm: 0.3,
  sprintBlendTime: 0.2,
  breathing: { rate: 1.7, pos: 0.0016, rot: 0.004 },
  sway: { perPixel: 0.0006, max: 0.06, posScale: 0.25, frequency: 10 },
  bob: {
    /** Meters of travel per full figure-8 cycle (two footsteps). */
    stride: 2.4,
    x: 0.01,
    y: 0.008,
    roll: 0.012,
    sprintScale: 2.2,
    adsScale: 0.15,
    crouchScale: 0.6,
  },
  kickFrequency: 22,
  jump: { impulse: 0.35, landPerSpeed: 0.05, maxLand: 0.6, frequency: 9, posScale: 0.08, rotScale: 0.15 },
  /** Holstered pose offset (lowered out of view). */
  holster: { pos: [0.0, -0.32, 0.06] as V3, rot: [-0.9, 0.2, 0] as V3 },
  muzzleFlashTime: 0.035,
  shell: { speed: [1.6, 1.4, 0.4] as V3, spread: 0.35, gravity: 9.81, life: 0.7, spin: 18, poolSize: 24 },
  /** Hit reaction and death camera (debug keys until damage exists). */
  hit: { shake: 0.012, shakeRoll: 0.02, time: 0.3, flashTime: 0.45 },
  death: { dropTime: 0.8, eyeHeight: 0.3, roll: 1.2, holdTime: 1.6 },
} as const;
