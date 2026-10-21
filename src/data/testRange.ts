import type { HitZone } from './ballistics';
import { PALETTE, UI_PALETTE } from './palette';
import type { Surface } from '../physics/collision';

/**
 * Phase 3 test range: flat ground, walls, stairs, ramps, crates and target dummies.
 * Units are meters. The player spawns at `spawn` facing −Z, down the shooting lane.
 */
export interface RangeBox {
  size: readonly [number, number, number];
  /** Center position. */
  pos: readonly [number, number, number];
  color: number;
  /** Rotation around X in degrees (ramps). */
  tiltDeg?: number;
  /** Impact effect and footstep sound. Default concrete. */
  surface?: Surface;
}

const STEP_RISE = 0.25;
const STEP_RUN = 0.3;
const STEPS = 12;
const STAIRS_X = -14;
const STAIRS_Z = 0;
const PLATFORM_HEIGHT = STEP_RISE * STEPS;

function stairs(): RangeBox[] {
  const out: RangeBox[] = [];
  for (let i = 0; i < STEPS; i++) {
    const h = STEP_RISE * (i + 1);
    out.push({ size: [3, h, STEP_RUN], pos: [STAIRS_X, h / 2, STAIRS_Z - i * STEP_RUN], color: i % 2 ? PALETTE.cream : PALETTE.mustard });
  }
  // Landing platform at the top, with a low parapet on three sides.
  const pz = STAIRS_Z - STEPS * STEP_RUN - 2.5 + STEP_RUN / 2;
  out.push({ size: [6, PLATFORM_HEIGHT, 5], pos: [STAIRS_X, PLATFORM_HEIGHT / 2, pz], color: PALETTE.slate });
  out.push({ size: [6, 0.9, 0.2], pos: [STAIRS_X, PLATFORM_HEIGHT + 0.45, pz - 2.4], color: PALETTE.cream });
  out.push({ size: [0.2, 0.9, 5], pos: [STAIRS_X - 2.9, PLATFORM_HEIGHT + 0.45, pz], color: PALETTE.cream });
  out.push({ size: [0.2, 0.9, 5], pos: [STAIRS_X + 2.9, PLATFORM_HEIGHT + 0.45, pz], color: PALETTE.cream });
  return out;
}

/** A ramp of `length` meters climbing toward −Z at `deg` degrees, starting at (x, 0, z). */
function ramp(x: number, z: number, deg: number, length: number, color: number): RangeBox {
  const a = (deg * Math.PI) / 180;
  const thickness = 0.4;
  // Center so the low edge sits on the ground at z.
  const cy = (Math.sin(a) * length) / 2 - (Math.cos(a) * thickness) / 2 + 0.01;
  const cz = z - (Math.cos(a) * length) / 2 - (Math.sin(a) * thickness) / 2;
  return { size: [3, thickness, length], pos: [x, cy, cz], color, tiltDeg: deg, surface: 'metal' };
}

export const TEST_RANGE = {
  groundSize: 260,
  groundColor: PALETTE.grass,
  groundSurface: 'dirt' as Surface,
  laneColor: PALETTE.sidewalk,
  // Dummies stand at exactly 10, 50 and 100 m from the spawn.
  spawn: [0, 0, 0] as const,
  sky: 0x8ccbf0,
  fogNear: 80,
  fogFar: 240,
  sun: { color: 0xffffff, intensity: 2.4, offset: [25, 40, 15] as const, shadowMapSize: 2048, shadowExtent: 40 },
  hemi: { sky: 0xdff1ff, ground: PALETTE.grass, intensity: 1.1 },
  /** Shooting lane down −Z with dummies at 10, 50 and 100 m. */
  lane: { width: 4, length: 110 },
  /** Target dummies: distance down the lane and a sideways offset so near ones do not block far ones. */
  dummies: [
    { distance: 10, x: -1.5 },
    { distance: 50, x: 0 },
    { distance: 100, x: 1.5 },
  ] as const,
  dummyColor: PALETTE.redTeam,
  boxes: [
    ...stairs(),
    ramp(14, 2, 20, 6, PALETTE.teal),
    ramp(18, 2, 40, 5, PALETTE.coral),
    ramp(22, 2, 50, 4, PALETTE.terracotta),
    // Crates: 0.3 m steps up, 0.5 m needs a jump, 1.0 m blocks.
    { size: [1, 0.3, 1], pos: [6, 0.15, 2], color: PALETTE.mustard, surface: 'wood' },
    { size: [1, 0.5, 1], pos: [6, 0.25, -1], color: PALETTE.coral, surface: 'wood' },
    { size: [1, 1, 1], pos: [6, 0.5, -4], color: PALETTE.terracotta, surface: 'wood' },
    { size: [2, 2, 2], pos: [8.5, 1, -4], color: PALETTE.akWood, surface: 'wood' },
    // Walls and a corner for lean tests.
    { size: [6, 3, 0.4], pos: [-5, 1.5, -6], color: PALETTE.cream },
    { size: [0.4, 3, 6], pos: [-7.8, 1.5, -3.2], color: PALETTE.cream },
    { size: [8, 1.1, 0.4], pos: [4, 0.55, -14], color: PALETTE.slate, surface: 'metal' },
    { size: [10, 4, 0.5], pos: [-14, 2, 18], color: PALETTE.teal },
  ] as RangeBox[],
} as const;

/** Target dummy parts (meters, relative to the dummy's base; the front faces +Z). Each part is a hitbox. */
export interface DummyPart {
  zone: HitZone;
  size: readonly [number, number, number];
  pos: readonly [number, number, number];
  color: number;
}

export const DUMMY = {
  parts: [
    { zone: 'leg', size: [0.18, 0.85, 0.2], pos: [-0.11, 0.425, 0], color: PALETTE.redTeam },
    { zone: 'leg', size: [0.18, 0.85, 0.2], pos: [0.11, 0.425, 0], color: PALETTE.redTeam },
    { zone: 'torso', size: [0.46, 0.6, 0.26], pos: [0, 1.15, 0], color: PALETTE.redTeam },
    { zone: 'arm', size: [0.12, 0.55, 0.12], pos: [-0.3, 1.15, 0], color: PALETTE.redTeam },
    { zone: 'arm', size: [0.12, 0.55, 0.12], pos: [0.3, 1.15, 0], color: PALETTE.redTeam },
    { zone: 'head', size: [0.22, 0.24, 0.22], pos: [0, 1.6, 0], color: UI_PALETTE.skin },
    { zone: 'head', size: [0.26, 0.1, 0.26], pos: [0, 1.74, 0], color: UI_PALETTE.vest },
  ] as DummyPart[],
  standColor: PALETTE.slate,
  /** Seconds to fall over, and to stay down before resetting. */
  fallTime: 0.5,
  resetTime: 3,
} as const;
