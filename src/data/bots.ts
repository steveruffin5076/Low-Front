/** Bot AI settings (plan section 12). Times in seconds, distances in meters, angles in degrees. */

export type Difficulty = 'easy' | 'normal' | 'hard';

/** The one global difficulty. No UI for it in v1. */
export const DIFFICULTY: Difficulty = 'normal';

export interface DifficultyPreset {
  /** Delay before the first shot after seeing a target. */
  reaction: { min: number; max: number };
  /** Aim error cone half-angle when a target is first seen, and the floor it shrinks to. */
  aimError: { start: number; min: number };
  /** Seconds of tracking to shrink the error from start to min. */
  aimSettle: number;
  /** Rounds per burst (automatic weapons), and the pause between bursts. */
  burst: { min: number; max: number };
  burstPause: { min: number; max: number };
  /** Chance per burst to aim at the head instead of the torso. */
  headChance: number;
  /** Fraction of recoil climb the bot pulls back down per shot. */
  recoilControl: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyPreset> = {
  easy: {
    reaction: { min: 0.5, max: 0.8 },
    aimError: { start: 7, min: 2.2 },
    aimSettle: 2.2,
    burst: { min: 2, max: 4 },
    burstPause: { min: 0.45, max: 0.8 },
    headChance: 0.05,
    recoilControl: 0.5,
  },
  normal: {
    reaction: { min: 0.3, max: 0.6 },
    aimError: { start: 5, min: 1.3 },
    aimSettle: 1.6,
    burst: { min: 3, max: 6 },
    burstPause: { min: 0.3, max: 0.6 },
    headChance: 0.12,
    recoilControl: 0.7,
  },
  hard: {
    reaction: { min: 0.2, max: 0.4 },
    aimError: { start: 3.5, min: 0.8 },
    aimSettle: 1.1,
    burst: { min: 4, max: 8 },
    burstPause: { min: 0.2, max: 0.4 },
    headChance: 0.2,
    recoilControl: 0.85,
  },
};

/** Eye, chest and head heights over the feet, standing and crouched (sight lines and aim points). */
export const BODY_POINTS = {
  eye: { stand: 1.62, crouch: 1.05 },
  chest: { stand: 1.25, crouch: 0.85 },
  head: { stand: 1.66, crouch: 1.1 },
} as const;

export const BOTS = {
  /** Bots per team: Blue has the player plus 15, Red has 16. */
  blue: 15,
  red: 16,
  /** Decisions per second, staggered across frames; movement and animation run every frame. */
  decisionRate: 10,
  perception: {
    fov: 110,
    sightRange: 90,
    hearingRange: 60,
    /** Line-of-sight raycasts allowed per frame across all bots. */
    raycastBudget: 20,
    /** A seen enemy stays "known" this long after losing sight. */
    memory: 8,
  },
  /** Where a bot's tracer starts: this far along the aim and this far below the eye (m). */
  muzzle: { forward: 0.6, down: 0.12 },
  /** A* searches started per frame across all bots, the heuristic weight (faster, slightly longer paths) and a cap on nodes expanded. */
  pathsPerFrame: 3,
  pathWeight: 1.6,
  pathMaxExpand: 60000,
  thresholds: {
    /** Reload when the magazine is under this fraction and no enemy is visible. */
    reloadFraction: 0.3,
    /** Retreat to cover under this HP while an enemy is visible. */
    retreatHp: 30,
    /** Search the last known enemy position for this long. */
    searchTime: 6,
    /** In the open, keep advancing on the objective while the enemy is farther than this. */
    advanceRange: 35,
    /** Take cover in combat if a cover point is this close. */
    coverRange: 8,
    /** Fight from one cover this long, then move on (no new cover for the max time). */
    coverHold: { min: 3, max: 7 },
    /** Attackers in the open walk toward an enemy farther than this. */
    engageRange: 20,
    /** Switch to the pistol when the primary is empty and the enemy is this close. */
    pistolRange: 15,
    /** No progress toward the next waypoint for this long counts as stuck. */
    stuckTime: 2,
    /** Waypoint reached within this distance (horizontal). */
    waypointRadius: 0.6,
    /** Walk instead of sprint this close to the objective or a known enemy. */
    walkNear: 20,
    /** Move between cover points in a held zone every this many seconds. */
    holdShuffle: { min: 4, max: 9 },
  },
  /** Objective scoring (higher is better). */
  objective: {
    notOwned: 40,
    enemyOwned: 25,
    /** Our flag being taken by the enemy: defend it. */
    underAttack: 55,
    /** Per meter of path distance. */
    distance: -0.12,
    /** Per teammate already heading there. */
    crowd: -14,
    /** Keep the current objective unless another is this much better. */
    stickiness: 15,
    /** Random spread added per decision so bots do not all agree. */
    noise: 10,
  },
  /** Bot names (plan section 12): 31, used in order. */
  names: [
    'Hawk', 'Viper', 'Ghost', 'Falcon', 'Rook', 'Bishop', 'Sable', 'Mako', 'Atlas', 'Orion', 'Kestrel',
    'Brick', 'Nomad', 'Raven', 'Tango', 'Echo', 'Saber', 'Jackal', 'Cobra', 'Moose', 'Ranger', 'Dingo',
    'Spartan', 'Wolf', 'Bandit', 'Lynx', 'Frost', 'Gunner', 'Badger', 'Comet', 'Drake',
  ],
} as const;
