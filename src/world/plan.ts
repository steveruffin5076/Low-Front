/**
 * Floor-plan description for enterable buildings (plan section 10.4). Local frame: origin at
 * the footprint center on the ground; sides n = −Z, s = +Z, e = +X, w = −X.
 */
export type Side = 'n' | 's' | 'e' | 'w';
export type FloorSel = 'all' | 'ground' | 'upper' | readonly number[];

export interface Opening {
  side: Side;
  /** Center along the side, measured from the side's center (+X for n/s, +Z for e/w). */
  u: number;
  width: number;
  /** Bottom above the floor surface, and height. Doors have bottom 0. */
  bottom: number;
  height: number;
  floors: FloorSel;
}

export interface InteriorWall {
  /** Axis-aligned segment. */
  from: readonly [number, number];
  to: readonly [number, number];
  /** Door centers, as distances from `from`. */
  doors?: readonly number[];
  floors?: FloorSel;
  /** Height above the floor; default the full storey. Low walls are cover. */
  height?: number;
}

export interface StairDef {
  /** Stairwell center. */
  x: number;
  z: number;
  /** Rotation in multiples of 90°. 0: flights run along Z and the entry faces −Z. */
  rot: number;
  /** First storey that has this stair (default 0). */
  from?: number;
  /** Continue up to a walkable roof. */
  toRoof?: boolean;
}

export interface Balcony {
  side: Side;
  us: readonly number[];
  width: number;
  depth: number;
  floors: readonly number[];
}

export interface Extra {
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  color: number;
  solid: boolean;
}

export interface FloorPlan {
  /** Size along X and Z. */
  w: number;
  d: number;
  floors: number;
  floorHeight: number;
  wallColor: number;
  trimColor: number;
  floorColor: number;
  openings: readonly Opening[];
  /** Regular windows on these sides, skipping places with an explicit opening. */
  windows?: { sides: readonly Side[]; spacing: number; width: number; bottom: number; height: number; floors: FloorSel };
  interiorWalls: readonly InteriorWall[];
  stairs: readonly StairDef[];
  /** 'access': walkable roof with a parapet and a stair house. 'none': open top (unfinished frame). */
  roof: 'flat' | 'access' | 'none';
  /** Unfinished concrete frame: columns instead of exterior walls. */
  frame?: boolean;
  balconies?: readonly Balcony[];
  extras?: readonly Extra[];
}
