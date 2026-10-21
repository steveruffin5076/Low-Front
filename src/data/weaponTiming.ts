/** Weapon action timings in seconds (plan section 8.1). Reload lengths come from `weapons.ts`. */
export const WEAPON_TIMING = {
  holster: { primary: 0.35, secondary: 0.25 },
  draw: { primary: 0.45, secondary: 0.3 },
  /** The new magazine is seated at this fraction of the tactical reload, for both reload kinds. */
  magSeatFraction: 0.68,
  inspect: 3.2,
  fireModeToggle: 0.3,
  /** Minimum time between dry-fire clicks. */
  dryFireInterval: 0.25,
} as const;
