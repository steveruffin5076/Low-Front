/** Navigation grid and cover point settings (plan section 10.6). Meters. */
export const NAV = {
  cell: 1,
  /** Soldier radius and height used for clearance. */
  radius: 0.3,
  height: 1.75,
  /** Highest step a soldier walks up (matches the character controller). */
  step: 0.4,
  /** Floors whose tops are within this of a level's height belong to that level. */
  levelTolerance: 0.3,
  bucket: 8,
  /** Link endpoints snap to the nearest walkable cell within this distance. */
  linkSnap: 2.5,
  /** An unreachable path goal snaps to a reachable cell within this many cells. */
  goalSnap: 8,
  cover: {
    lowMin: 0.8,
    highMin: 1.6,
    /** Distance from the cover face to the point. */
    standoff: 0.6,
    propSpacing: 1.5,
    wallSpacing: 3,
    dedupe: 1.0,
  },
} as const;
