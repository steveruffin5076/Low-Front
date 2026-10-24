/** Player profile rules (plan section 5.2). */
export const PROFILE = {
  nameMinLength: 3,
  nameMaxLength: 16,
  defaultName: 'Player',
  teamLabel: 'Blue Team',
  storageKey: 'lowfront.profile.v1',
} as const;

/** Player movement (plan section 9). Speeds in m/s, times in seconds. */
export const MOVEMENT = {
  walkSpeed: 4.5,
  sprintSpeed: 6.5,
  crouchSpeed: 2.5,
  adsSpeed: 2.8,
  /** Seconds of sprint from full stamina, and seconds to refill from empty. */
  staminaDuration: 6,
  staminaRecovery: 4,
  /** After running out, sprint is allowed again once stamina is back above this fraction. */
  staminaRestart: 0.25,
  jumpHeight: 0.6,
  gravity: 18,
  /** m/s² toward the target speed on the ground and in the air. */
  groundAccel: 45,
  airAccel: 8,
  stepHeight: 0.35,
  stepMinWidth: 0.2,
  maxSlopeDeg: 45,
  snapToGround: 0.3,
  /** Capsule size. Total standing height 1.8 m. */
  radius: 0.3,
  standHeight: 1.8,
  crouchHeight: 1.2,
  standEyeHeight: 1.65,
  crouchEyeHeight: 1.05,
  crouchTransition: 0.2,
  /** Lean: camera roll in degrees, sideways shift in meters, blend time. */
  leanAngleDeg: 15,
  leanOffset: 0.35,
  leanTime: 0.2,
  /** Lean stops this far from a wall. */
  leanWallMargin: 0.15,
  controllerOffset: 0.02,
  /** Sprint needs mostly forward input (dot with forward). */
  sprintMinForward: 0.5,
  /** Meters between footstep sounds. */
  stepDistance: 1.2,
  /** Ground speed under this counts as standing still for animation. */
  idleSpeed: 0.2,
  /** Radians of camera rotation per pixel of mouse movement. */
  mouseSensitivity: 0.0022,
  maxPitchDeg: 85,
  baseFov: 75,
} as const;

/** Health, regeneration and fall damage (plan section 9). */
export const HEALTH = {
  max: 100,
  /** Seconds without damage before regeneration starts. */
  regenDelay: 8,
  /** HP per second. */
  regenRate: 10,
  /** Falls higher than this (m) hurt; damage per meter above it. */
  fallThreshold: 4,
  fallDamagePerMeter: 20,
  /** Test key H: damage taken. */
  debugHitDamage: 20,
} as const;

/**
 * The player's hitboxes (plan section 9), in the feet frame while standing, facing −Z.
 * Crouching scales the heights by crouchHeight / standHeight.
 */
export const PLAYER_HITBOXES = [
  { zone: 'head', size: [0.26, 0.28, 0.28], pos: [0, 1.64, 0] },
  { zone: 'torso', size: [0.46, 0.62, 0.32], pos: [0, 1.19, 0] },
  { zone: 'arm', size: [0.13, 0.56, 0.15], pos: [-0.3, 1.18, -0.05] },
  { zone: 'arm', size: [0.13, 0.56, 0.15], pos: [0.3, 1.18, -0.05] },
  { zone: 'leg', size: [0.4, 0.86, 0.26], pos: [0, 0.45, 0] },
] as const;
