import type { Surface } from '../../physics/collision';

/** Map data types (plan section 10). Meters; map center (0, 0); north = −Z, south = +Z. */

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export type GroundKind = 'asphalt' | 'sidewalk' | 'plaza' | 'grass' | 'dirt' | 'gravel' | 'concrete';

/** A ground surface. Raised areas are 0.15 m slabs with a curb (sidewalks, blocks). */
export interface GroundArea {
  rect: Rect;
  kind: GroundKind;
  raised: boolean;
}

export type StreetMarking = 'avenue' | 'street' | 'none';

export interface StreetDef {
  rect: Rect;
  /** Direction of travel. */
  axis: 'x' | 'z';
  marking: StreetMarking;
}

export interface SolidBuildingDef {
  x: number;
  z: number;
  /** Size along X and Z. */
  w: number;
  d: number;
  floors: number;
  color: number;
}

export type PlanId =
  | 'depotHall'
  | 'depotOffice'
  | 'apartment'
  | 'cityHall'
  | 'officeTower'
  | 'constructionFrame'
  | 'station'
  | 'cornerShop';

export interface EnterableDef {
  plan: PlanId;
  x: number;
  z: number;
  /** Multiples of 90° only. */
  rotY: number;
  color?: number;
}

export type PropType =
  | 'car'
  | 'burnedCar'
  | 'bus'
  | 'barrier'
  | 'sandbags'
  | 'crate'
  | 'dumpster'
  | 'container'
  | 'rubble'
  | 'busStop'
  | 'streetLight'
  | 'tree'
  | 'planter'
  | 'scaffolding'
  | 'trainCar'
  | 'crane'
  | 'pipes'
  | 'dirtMound'
  | 'fountain'
  | 'statue'
  | 'fuelIsland'
  | 'lowWall'
  | 'fence'
  | 'rails'
  | 'footbridge';

export interface PropDef {
  type: PropType;
  x: number;
  z: number;
  /** Height of the base (for stacked containers). */
  y?: number;
  rotY: number;
  /** Tint, e.g. car paint. */
  color?: number;
}

export type FlagId = 'A' | 'B' | 'C' | 'D' | 'E';

export interface FlagDef {
  id: FlagId;
  name: string;
  x: number;
  z: number;
  /** Ground height of the flag base. */
  y: number;
}

export interface SpawnDef {
  x: number;
  z: number;
  yaw: number;
}

export type TeamId = 'blue' | 'red';

export interface HQDef {
  team: TeamId;
  rect: Rect;
  spawns: SpawnDef[];
}

export interface MapData {
  name: string;
  /** Playable area is ±half on X and Z. */
  half: number;
  ground: GroundArea[];
  streets: StreetDef[];
  solids: SolidBuildingDef[];
  enterables: EnterableDef[];
  props: PropDef[];
  flags: FlagDef[];
  hqs: HQDef[];
  flagSpawns: Record<FlagId, SpawnDef[]>;
  /** Buildings and fences outside the playable area that make the edge look natural. */
  boundary: { solids: SolidBuildingDef[]; props: PropDef[] };
}

export type { Surface };
