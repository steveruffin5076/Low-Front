/**
 * Phase 6 performance test: 32 soldiers on the city map (plan section 15). Walkers follow nav-grid
 * paths between flags; the others stand at flag spawn points and cycle through their actions.
 * Replaced by the Conquest match and bots in Phases 7 and 8.
 */
export const CROWD = {
  perTeam: 16,
  /** Walkers per team; the rest stand. */
  walkersPerTeam: 8,
  seed: 1406,
  /** Flags each team's soldiers use (their half of the map plus the center). */
  flags: { blue: ['A', 'B', 'C'], red: ['D', 'E', 'C'] },
  /** Walker speeds (m/s) and gaits, cycled per walker. */
  gaits: [
    { speed: 2.8, sprint: false, crouch: false },
    { speed: 4.5, sprint: false, crouch: false },
    { speed: 6.5, sprint: true, crouch: false },
    { speed: 2.5, sprint: false, crouch: true },
  ],
  /** Radians per second a walker turns toward its path. */
  turnRate: 5,
  /** Stand-in actions: each lasts `actionTime` seconds, in this order (offset per soldier). */
  actions: ['idle', 'fire', 'crouch', 'reload', 'strafeLeft', 'strafeRight', 'backpedal', 'switch', 'jump', 'crouchFire', 'switch'] as const,
  actionTime: 3,
  /** Strafe and backpedal speed, and how far a stander may move from its spot. */
  stepSpeed: 2.8,
  stepRange: 1.6,
  fireInterval: 0.11,
  jump: { speed: 3.3, gravity: 18 },
  /** Small aim pitch so the upper bodies move. */
  pitchAmplitude: 0.25,
} as const;

export type CrowdAction = (typeof CROWD.actions)[number];
