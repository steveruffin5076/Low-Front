/** Bullets, spread and damage zones (plan sections 7.1 and 9). Angles in degrees, times in seconds. */
export const BALLISTICS = {
  gravity: 9.81,
  /** Bullets are removed after this many seconds. */
  maxLife: 2,
  /** Shotgun pellets count too: 9 per shot from several bots at once. */
  maxBullets: 384,
  /** Every Nth round is a tracer. */
  tracerEvery: 3,
  /** Camera recoil is scaled by this while aiming. */
  adsRecoilScale: 0.8,
} as const;

export const SPREAD = {
  /** Extra cone per m/s of horizontal speed, capped. */
  movePerSpeed: 0.3,
  moveMax: 2.0,
  /** Extra cone while airborne. */
  air: 3.0,
  /** Bloom added per shot, its cap, and how fast it shrinks (deg/s). */
  bloomPerShot: 0.3,
  bloomMax: 3.0,
  bloomRecovery: 4.0,
  /** While aiming, movement and bloom count this much. */
  adsMoveScale: 0.15,
  adsBloomScale: 0.25,
} as const;

export type HitZone = 'head' | 'torso' | 'arm' | 'leg';
