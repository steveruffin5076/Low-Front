/** Conquest mode rules (plan section 11). Times in seconds. */
export const CONQUEST = {
  startingTickets: 400,
  /** Tickets a team loses when one of its soldiers dies. */
  deathTicketCost: 1,
  /** A team holding at least `flags` flags makes the enemy lose 1 ticket every `interval` seconds. */
  bleed: [
    { flags: 5, interval: 2 },
    { flags: 3, interval: 4 },
  ],
  timeLimit: 25 * 60,
  capture: {
    /** 12 m cylinder, 6 m tall from the flag base. */
    radius: 12,
    height: 6,
    /** Neutral → owned (and owned → neutral) with one soldier. */
    time: 10,
    /** Speed scales with attackers minus defenders, up to this many times. */
    maxSpeed: 3,
  },
  hq: {
    /** Enemies inside an HQ get this long before they die. HQs cannot be captured. */
    enemyWarning: 5,
  },
  /**
   * Countdown before the battle: everyone stands at their HQ spawn point (looking around only),
   * nobody can fire; the clock, tickets and flags start after it. "GO" shows this long.
   */
  warmup: 20,
  goBanner: 1.5,
  respawnDelay: 10,
  /** The Deploy Screen opens this long after death (the death camera plays first). */
  deployScreenDelay: 1.6,
  /** Seconds between the match result and the End Screen. */
  endScreenDelay: 3,
  /** A spawn point is taken if a soldier stands this close (m). */
  spawnClearance: 1.5,
  score: {
    kill: 100,
    headshotBonus: 25,
    capture: 200,
    neutralize: 100,
    /** Killing an enemy inside a zone your team owns. */
    defendBonus: 50,
  },
} as const;
