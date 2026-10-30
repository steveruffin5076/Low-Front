/** Resupply crates at the flags (Phase 10 add-on). Distances in meters, times in seconds. */
export const RESUPPLY = {
  /** How far from its flag a crate sits; tried in 8 directions until one is walkable. */
  offset: 6,
  /** Standing this close (horizontal) to a crate resupplies, if your team owns its flag. */
  radius: 1.6,
  /** Feet must be within this height of the crate's base. */
  maxDy: 1.5,
  /** After a resupply, no crate works for that soldier again for this long. */
  cooldown: 20,
  /** Bots go to an owned crate this close when low on ammo and nothing is in sight. */
  botRange: 60,
  /** Crate model: base box size (m), and colors (owner stripe is grey while neutral). */
  model: {
    size: [1.0, 0.55, 0.6] as const,
    body: 0x4f5b3a,
    lid: 0x5d6b45,
    cross: 0xf1f3f5,
    stripeNeutral: 0xb8bcc2,
  },
  /** How long the "Resupplied" notice stays on screen. */
  noticeTime: 1.6,
} as const;
