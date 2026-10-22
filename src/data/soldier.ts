/**
 * Soldier model, rig and third-person animation settings (plan section 8.2).
 * Soldier space: meters, feet at the origin, +Y up, facing −Z, +X is the soldier's right.
 */
import type { HitZone } from './ballistics';
import { PALETTE, UI_PALETTE } from './palette';

export type Team = 'blue' | 'red';

export type BoneName =
  | 'root'
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'upperArmL'
  | 'forearmL'
  | 'handL'
  | 'upperArmR'
  | 'forearmR'
  | 'handR'
  | 'thighL'
  | 'shinL'
  | 'footL'
  | 'thighR'
  | 'shinR'
  | 'footR'
  | 'primary'
  | 'primaryMag'
  | 'secondary'
  | 'secondaryMag';

export interface BoneDef {
  name: BoneName;
  parent: BoneName | null;
  /** Rest position relative to the parent bone. */
  pos: readonly [number, number, number];
}

const ARM = { upper: 0.3, lower: 0.29 } as const;
const LEG = { thigh: 0.44, shin: 0.41, ankle: 0.07 } as const;
const HIP_HEIGHT = LEG.thigh + LEG.shin + LEG.ankle + 0.03;

/** Bones in parent-first order. Weapon bones hang off the root; the rig places them each frame. */
export const SOLDIER_BONES: readonly BoneDef[] = [
  { name: 'root', parent: null, pos: [0, 0, 0] },
  { name: 'hips', parent: 'root', pos: [0, HIP_HEIGHT, 0] },
  { name: 'spine', parent: 'hips', pos: [0, 0.1, 0] },
  { name: 'chest', parent: 'spine', pos: [0, 0.22, 0] },
  { name: 'neck', parent: 'chest', pos: [0, 0.27, 0] },
  { name: 'head', parent: 'neck', pos: [0, 0.07, 0] },
  { name: 'upperArmL', parent: 'chest', pos: [-0.21, 0.2, 0] },
  { name: 'forearmL', parent: 'upperArmL', pos: [0, -ARM.upper, 0] },
  { name: 'handL', parent: 'forearmL', pos: [0, -ARM.lower, 0] },
  { name: 'upperArmR', parent: 'chest', pos: [0.21, 0.2, 0] },
  { name: 'forearmR', parent: 'upperArmR', pos: [0, -ARM.upper, 0] },
  { name: 'handR', parent: 'forearmR', pos: [0, -ARM.lower, 0] },
  { name: 'thighL', parent: 'hips', pos: [-0.1, -0.03, 0] },
  { name: 'shinL', parent: 'thighL', pos: [0, -LEG.thigh, 0] },
  { name: 'footL', parent: 'shinL', pos: [0, -LEG.shin, 0] },
  { name: 'thighR', parent: 'hips', pos: [0.1, -0.03, 0] },
  { name: 'shinR', parent: 'thighR', pos: [0, -LEG.thigh, 0] },
  { name: 'footR', parent: 'shinR', pos: [0, -LEG.shin, 0] },
  { name: 'primary', parent: 'root', pos: [0, 0, 0] },
  { name: 'primaryMag', parent: 'primary', pos: [0, 0, 0] },
  { name: 'secondary', parent: 'root', pos: [0, 0, 0] },
  { name: 'secondaryMag', parent: 'secondary', pos: [0, 0, 0] },
];

export const SOLDIER_DIMENSIONS = { arm: ARM, leg: LEG, hipHeight: HIP_HEIGHT } as const;

export type PartColor = 'uniform' | 'trousers' | 'helmet' | 'vest' | 'pouch' | 'skin' | 'glove' | 'boots' | 'dark';

export interface TeamColors {
  uniform: number;
  trousers: number;
  helmet: number;
}

export const TEAM_COLORS: Record<Team, TeamColors> = {
  blue: { uniform: PALETTE.blueTeam, trousers: 0x2563b8, helmet: 0x1f4f8f },
  red: { uniform: PALETTE.redTeam, trousers: 0xb83a30, helmet: 0x8f2a22 },
};

/** Gear colors shared by both teams. */
export const GEAR_COLORS: Record<Exclude<PartColor, keyof TeamColors>, number> = {
  vest: UI_PALETTE.vest,
  pouch: 0x4b5a48,
  skin: UI_PALETTE.skin,
  glove: 0x1b1c1f,
  boots: UI_PALETTE.boots,
  dark: 0x23272c,
};

/** Body boxes per bone, in the bone's frame. `lod` parts make the far model; the rest only the near one. */
export interface PartDef {
  bone: BoneName;
  size: readonly [number, number, number];
  pos: readonly [number, number, number];
  color: PartColor;
  /** Also used by the simplified (far) model. */
  lod?: boolean;
}

const mirror = (p: PartDef, bone: BoneName): PartDef => ({ ...p, bone, pos: [-p.pos[0], p.pos[1], p.pos[2]] });

const LEFT_SIDE: PartDef[] = [
  { bone: 'upperArmL', size: [0.12, 0.3, 0.13], pos: [0, -0.15, 0], color: 'uniform', lod: true },
  { bone: 'upperArmL', size: [0.14, 0.09, 0.15], pos: [0, -0.03, 0], color: 'uniform' },
  { bone: 'forearmL', size: [0.1, 0.27, 0.11], pos: [0, -0.135, 0], color: 'uniform', lod: true },
  { bone: 'forearmL', size: [0.11, 0.05, 0.12], pos: [0, -0.25, 0], color: 'glove' },
  { bone: 'handL', size: [0.07, 0.1, 0.06], pos: [0, -0.03, 0], color: 'glove', lod: true },
  { bone: 'thighL', size: [0.17, 0.44, 0.19], pos: [0, -0.22, 0], color: 'trousers', lod: true },
  { bone: 'thighL', size: [0.05, 0.13, 0.13], pos: [-0.1, -0.24, 0], color: 'pouch' },
  { bone: 'shinL', size: [0.15, 0.41, 0.16], pos: [0, -0.2, 0], color: 'trousers', lod: true },
  { bone: 'shinL', size: [0.13, 0.1, 0.04], pos: [0, -0.03, -0.095], color: 'dark' },
  { bone: 'footL', size: [0.16, 0.11, 0.27], pos: [0, -0.015, -0.045], color: 'boots', lod: true },
];

const MIRROR_BONE: Partial<Record<BoneName, BoneName>> = {
  upperArmL: 'upperArmR',
  forearmL: 'forearmR',
  handL: 'handR',
  thighL: 'thighR',
  shinL: 'shinR',
  footL: 'footR',
};

export const SOLDIER_PARTS: readonly PartDef[] = [
  // Hips: pelvis, belt, pistol holster on the right hip.
  { bone: 'hips', size: [0.36, 0.2, 0.23], pos: [0, -0.01, 0], color: 'trousers', lod: true },
  { bone: 'hips', size: [0.38, 0.06, 0.25], pos: [0, 0.08, 0], color: 'dark' },
  { bone: 'hips', size: [0.06, 0.17, 0.1], pos: [0.21, -0.03, 0.01], color: 'dark' },
  // Spine: belly.
  { bone: 'spine', size: [0.37, 0.22, 0.22], pos: [0, 0.08, 0], color: 'uniform', lod: true },
  // Chest: torso, vest, front pouches, radio, backpack.
  { bone: 'chest', size: [0.42, 0.34, 0.24], pos: [0, 0.12, 0], color: 'uniform' },
  { bone: 'chest', size: [0.45, 0.32, 0.29], pos: [0, 0.09, 0], color: 'vest', lod: true },
  { bone: 'chest', size: [0.09, 0.11, 0.06], pos: [-0.13, 0.01, -0.165], color: 'pouch' },
  { bone: 'chest', size: [0.09, 0.11, 0.06], pos: [0, 0.01, -0.165], color: 'pouch' },
  { bone: 'chest', size: [0.09, 0.11, 0.06], pos: [0.13, 0.01, -0.165], color: 'pouch' },
  { bone: 'chest', size: [0.07, 0.09, 0.05], pos: [-0.17, 0.17, -0.16], color: 'dark' },
  { bone: 'chest', size: [0.33, 0.38, 0.15], pos: [0, 0.12, 0.215], color: 'pouch', lod: true },
  { bone: 'chest', size: [0.29, 0.08, 0.13], pos: [0, 0.34, 0.215], color: 'dark' },
  // Neck and head: face toward −Z, eye band, helmet with brim and strap.
  { bone: 'neck', size: [0.11, 0.09, 0.11], pos: [0, 0.03, 0], color: 'skin' },
  { bone: 'head', size: [0.2, 0.22, 0.22], pos: [0, 0.1, 0], color: 'skin', lod: true },
  { bone: 'head', size: [0.16, 0.035, 0.012], pos: [0, 0.12, -0.112], color: 'dark' },
  { bone: 'head', size: [0.26, 0.12, 0.28], pos: [0, 0.22, 0.01], color: 'helmet', lod: true },
  { bone: 'head', size: [0.28, 0.03, 0.3], pos: [0, 0.165, 0.01], color: 'helmet' },
  ...LEFT_SIDE,
  ...LEFT_SIDE.map((p) => mirror(p, MIRROR_BONE[p.bone] ?? p.bone)),
];

/** Sensor hitboxes that follow the bones (plan section 9). Sizes in meters, centers in the bone frame. */
export interface SoldierHitboxDef {
  bone: BoneName;
  zone: HitZone;
  size: readonly [number, number, number];
  pos: readonly [number, number, number];
}

export const SOLDIER_HITBOXES: readonly SoldierHitboxDef[] = [
  { bone: 'head', zone: 'head', size: [0.26, 0.3, 0.29], pos: [0, 0.13, 0] },
  { bone: 'chest', zone: 'torso', size: [0.46, 0.38, 0.32], pos: [0, 0.11, 0] },
  { bone: 'spine', zone: 'torso', size: [0.38, 0.22, 0.25], pos: [0, 0.07, 0] },
  { bone: 'hips', zone: 'torso', size: [0.38, 0.22, 0.25], pos: [0, -0.01, 0] },
  { bone: 'upperArmL', zone: 'arm', size: [0.13, 0.3, 0.14], pos: [0, -0.15, 0] },
  { bone: 'upperArmR', zone: 'arm', size: [0.13, 0.3, 0.14], pos: [0, -0.15, 0] },
  { bone: 'forearmL', zone: 'arm', size: [0.12, 0.29, 0.13], pos: [0, -0.14, 0] },
  { bone: 'forearmR', zone: 'arm', size: [0.12, 0.29, 0.13], pos: [0, -0.14, 0] },
  { bone: 'thighL', zone: 'leg', size: [0.18, 0.44, 0.2], pos: [0, -0.22, 0] },
  { bone: 'thighR', zone: 'leg', size: [0.18, 0.44, 0.2], pos: [0, -0.22, 0] },
  { bone: 'shinL', zone: 'leg', size: [0.16, 0.46, 0.17], pos: [0, -0.21, 0] },
  { bone: 'shinR', zone: 'leg', size: [0.16, 0.46, 0.17], pos: [0, -0.21, 0] },
];

/** Locomotion. Speeds are the player's (section 9); tiers blend by speed. Angles in radians. */
export const GAIT = {
  /** Ground speed of each animation tier (m/s). */
  walkSpeed: 2.8,
  runSpeed: 4.5,
  sprintSpeed: 6.5,
  /** Distance covered in one full cycle (two steps) per tier, and crouched. */
  stride: { walk: 1.5, run: 2.3, sprint: 2.9, crouch: 1.1 },
  /** Thigh swing amplitude. */
  swing: { walk: 0.42, run: 0.68, sprint: 0.9, crouch: 0.32 },
  /** Extra knee bend on the forward swing. */
  knee: { walk: 0.55, run: 1.05, sprint: 1.35, crouch: 0.35 },
  /** Hip bob height (twice per cycle). */
  bob: { walk: 0.025, run: 0.05, sprint: 0.065, crouch: 0.02 },
  /** Forward lean of the spine. */
  lean: { walk: 0.03, run: 0.09, sprint: 0.24, crouch: 0.0 },
  /** Below this speed the soldier stands still. */
  idleSpeed: 0.15,
  /** Seconds to blend into and out of sprint, crouch and the air pose. */
  blendTime: 0.2,
  /** Idle breathing. */
  breathRate: 1.7,
  breathAngle: 0.025,
} as const;

/** Crouch pose: legs fold so the feet stay on the ground (the hips height is solved from the legs). */
export const CROUCH = {
  thighL: 1.25,
  shinL: -2.05,
  thighR: 0.75,
  shinR: -1.85,
  spineLean: 0.28,
} as const;

/** Air poses. */
export const AIR = {
  rising: { thigh: 0.55, shin: -1.0 },
  falling: { thigh: 0.2, shin: -0.35 },
  /** Vertical speed (m/s) that counts as rising. */
  risingSpeed: 0.5,
} as const;

/** Aim pitch is shared out over these bones (sums to 1). */
export const AIM_SPLIT = { spine: 0.3, chest: 0.45, neck: 0.25 } as const;

/**
 * Weapon holds in the chest frame: the weapon's right-hand grip point and its rotation (XYZ Euler).
 * Rifles turn the chest to the right so the left shoulder comes forward; the weapon yaw undoes it.
 */
export interface HoldPose {
  pos: readonly [number, number, number];
  rot: readonly [number, number, number];
  /** Chest yaw for this hold. */
  chestYaw: number;
}

export const HOLDS: Record<'rifle' | 'rifleSprint' | 'pistol' | 'pistolSprint' | 'dead', HoldPose> = {
  rifle: { pos: [0.12, 0.08, -0.26], rot: [0, 0.4, 0], chestYaw: -0.4 },
  rifleSprint: { pos: [0.1, -0.02, -0.24], rot: [-0.55, 0.75, 0.3], chestYaw: -0.3 },
  pistol: { pos: [0.02, 0.1, -0.42], rot: [0, -0.05, 0], chestYaw: 0.05 },
  pistolSprint: { pos: [0.12, -0.12, -0.24], rot: [-0.9, 0, 0], chestYaw: 0 },
  /** While dying the weapon swings down along the body, so it lies flat beside the soldier. */
  dead: { pos: [0.24, -0.3, -0.12], rot: [-1.45, 0.15, 0], chestYaw: 0 },
};

/** Stowed weapons: the rifle slung on the back (chest frame), the pistol in the hip holster (hips frame). */
export const STOWED = {
  // Diagonal across the backpack, muzzle down to the left, top of the rifle facing out.
  rifle: { pos: [0.1, 0.29, 0.31], rot: [-1.571, 0.532, -3.142] },
  // Muzzle down, grip toward the back.
  pistol: { pos: [0.22, 0.06, 0.03], rot: [-Math.PI / 2, 0, 0] },
} as const;

/** Elbow pole targets in the chest frame (elbows bend down and out). */
export const ELBOW_POLES = { L: [-0.6, -0.5, 0.1], R: [0.6, -0.5, 0.2] } as const;

/** Reload hand path: the pouch the left hand visits (chest frame). */
export const RELOAD = {
  pouch: [-0.13, 0.0, -0.22],
  /** Magazine leaves the weapon this far below the magazine well (weapon frame). */
  dropDepth: 0.12,
} as const;

/** Fire kick, in the chest frame. */
export const FIRE_KICK = { back: 0.035, pitch: 0.06, recover: 14 } as const;

/** Death: fall over in the hit direction, stay down, then fade out (section 8.2). */
export const DEATH = {
  fallTime: 0.75,
  stayTime: 10,
  fadeTime: 1,
  /** Lifts the body as it lands so it lies on the ground rather than in it. */
  lieLift: 0.13,
  /** Sideways part of the fall, as a fraction of the hit's sideways direction. */
  twist: 0.5,
} as const;

/** Level of detail (section 14): the simple model beyond this distance, and how often it animates. */
export const SOLDIER_LOD = {
  distance: 40,
  /** Far soldiers update their pose this many times per second. */
  farUpdateRate: 20,
} as const;

/** Triangle budgets checked by the tests. */
export const SOLDIER_BUDGET = { full: 1100, lod: 300 } as const;

/** Blocking body (a capsule): stops the player walking through soldiers. Bullets use the hitboxes. */
export const SOLDIER_BODY = { radius: 0.3, halfHeight: 0.6, centerY: 0.9 } as const;
