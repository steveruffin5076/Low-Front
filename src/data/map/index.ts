import { PALETTE } from '../palette';
import { AREA_A, AREA_B, AREA_C, AREA_D, AREA_E, FLAG_NAMES, FLAG_POSITIONS } from './areas';
import { BUILDING_COLORS, fillBlock } from './blocks';
import { MAP } from './config';
import { mirror, withMirror } from './mirror';
import type { EnterableDef, FlagDef, FlagId, GroundArea, HQDef, MapData, PropDef, Rect, SolidBuildingDef, SpawnDef, StreetDef } from './types';

/**
 * "Verdan District" (plan section 10). Shared parts are authored for the south half and
 * mirrored with (x, z) → (−x, −z); themed flag areas and the plaza are authored whole.
 *
 *          NORTH — RED HQ (z = −164)
 *   D (−120, −120)          E (120, −120)
 *              C (0, 0) City Hall Plaza
 *   A (−120, 120)           B (120, 120)
 *          SOUTH — BLUE HQ (z = +164)
 */
const R = (x0: number, z0: number, x1: number, z1: number): Rect => ({ x0, z0, x1, z1 });
const p = (type: PropDef['type'], x: number, z: number, rotY = 0, extra: Partial<PropDef> = {}): PropDef => ({ type, x, z, rotY, ...extra });

// --- Streets (south half + full-length streets that are symmetric by construction) ---
const streetsHalf: StreetDef[] = [
  { rect: R(-10, 30, 10, 148), axis: 'z', marking: 'avenue' },
  { rect: R(-64, 140, 64, 148), axis: 'x', marking: 'street' },
  { rect: R(-180, -8, -64, 8), axis: 'x', marking: 'street' },
  { rect: R(-76, 0, -64, 180), axis: 'z', marking: 'street' },
  { rect: R(64, 0, 76, 180), axis: 'z', marking: 'street' },
  { rect: R(-180, 64, 180, 76), axis: 'x', marking: 'street' },
];

// --- Ground ---
const groundHalf: GroundArea[] = [
  { rect: R(-180, 8, -76, 64), kind: 'sidewalk', raised: true },
  { rect: R(76, 8, 180, 64), kind: 'sidewalk', raised: true },
  { rect: R(-64, 76, -10, 140), kind: 'sidewalk', raised: true },
  { rect: R(10, 76, 64, 140), kind: 'sidewalk', raised: true },
  { rect: R(-64, 16, -38, 64), kind: 'sidewalk', raised: true },
  { rect: R(-38, 30, -10, 64), kind: 'sidewalk', raised: true },
  { rect: R(38, 16, 64, 64), kind: 'sidewalk', raised: true },
  { rect: R(10, 30, 38, 64), kind: 'sidewalk', raised: true },
  { rect: R(-64, 148, 64, 180), kind: 'concrete', raised: false },
];
const groundWhole: GroundArea[] = [
  { rect: R(-38, -30, 38, 30), kind: 'plaza', raised: false },
  { rect: R(-64, 10, -38, 16), kind: 'plaza', raised: false },
  { rect: R(-64, -16, -38, -10), kind: 'plaza', raised: false },
  { rect: R(38, 10, 64, 16), kind: 'plaza', raised: false },
  { rect: R(38, -16, 64, -10), kind: 'plaza', raised: false },
  { rect: R(-180, 76, -76, 180), kind: 'asphalt', raised: false },
  { rect: R(76, -180, 180, -76), kind: 'gravel', raised: false },
  { rect: R(76, 76, 180, 180), kind: 'sidewalk', raised: true },
  { rect: R(100, 106, 150, 150), kind: 'grass', raised: false },
  { rect: R(-180, -180, -76, -76), kind: 'dirt', raised: false },
];

// --- City blocks (south half) ---
const blocksHalf: SolidBuildingDef[] = [
  ...fillBlock({ rect: R(-180, 8, -76, 64), depth: 12, alleysX: [-128], alleysZ: [36], keepClear: [R(-94, 46, -76, 64)], minFloors: 2, maxFloors: 5, variant: 0 }),
  ...fillBlock({ rect: R(76, 8, 180, 64), depth: 12, alleysX: [128], alleysZ: [36], minFloors: 2, maxFloors: 5, variant: 3 }),
  ...fillBlock({ rect: R(-64, 76, -10, 140), depth: 12, alleysX: [-37], alleysZ: [108], minFloors: 3, maxFloors: 6, variant: 1 }),
  ...fillBlock({ rect: R(10, 76, 64, 140), depth: 12, alleysX: [37], alleysZ: [108], minFloors: 3, maxFloors: 6, variant: 4 }),
  ...fillBlock({ rect: R(-64, 16, -38, 64), depth: 10, alleysZ: [40], openSides: ['e'], minFloors: 2, maxFloors: 4, variant: 2 }),
  ...fillBlock({ rect: R(-38, 30, -10, 64), depth: 10, alleysX: [-24], openSides: ['w', 'n'], minFloors: 2, maxFloors: 4, variant: 5 }),
  ...fillBlock({ rect: R(38, 16, 64, 64), depth: 10, alleysZ: [40], openSides: ['w'], minFloors: 2, maxFloors: 4, variant: 6 }),
  ...fillBlock({ rect: R(10, 30, 38, 64), depth: 10, alleysX: [24], openSides: ['e', 'n'], minFloors: 2, maxFloors: 4, variant: 7 }),
];

/** Corner shop on the A–C flank route (mirrored onto the E–C flank). */
const shopHalf: EnterableDef[] = [{ plan: 'cornerShop', x: -85, z: 55, rotY: Math.PI }];

// --- Shells around the themed flag areas (mirrored A ↔ E, B ↔ D) ---
const shellA: SolidBuildingDef[] = [
  { x: -162, z: 84, w: 28, d: 12, floors: 3, color: PALETTE.slate },
  { x: -88, z: 162, w: 18, d: 30, floors: 4, color: PALETTE.cream },
  { x: -96, z: 82, w: 22, d: 8, floors: 2, color: PALETTE.terracotta },
];
const shellB: SolidBuildingDef[] = [
  { x: 158, z: 125, w: 16, d: 50, floors: 4, color: PALETTE.mint },
  { x: 91, z: 145, w: 14, d: 30, floors: 3, color: PALETTE.mustard },
  { x: 109, z: 159, w: 18, d: 14, floors: 3, color: PALETTE.terracotta },
  { x: 140, z: 159, w: 28, d: 14, floors: 3, color: PALETTE.cream },
];

// --- Street cover and dressing (south half) ---
const streetPropsHalf: PropDef[] = [
  // Avenue median planters with gaps for crossing.
  ...[38, 50, 62, 88, 100, 112, 124].map((z) => p('planter', 0, z, 0)),
  // Street lights along the avenue and side streets.
  ...[40, 64, 88, 112, 136].flatMap((z) => [p('streetLight', -11, z, Math.PI / 2), p('streetLight', 11, z, -Math.PI / 2)]),
  ...[-160, -130, -100, 100, 130, 160].map((x) => p('streetLight', x, 63, 0)),
  // Parked and burned cars, barriers, bus stops.
  p('car', -6.5, 46, 0),
  p('car', 6.5, 94, Math.PI),
  p('burnedCar', -4, 118, 0.5),
  p('car', -120, 70, Math.PI / 2),
  p('burnedCar', 98, 69, 1.4),
  p('car', 140, 72, -Math.PI / 2),
  p('car', -70, 28, 0),
  p('burnedCar', 70, 40, 0.3),
  p('car', -150, 4, Math.PI / 2),
  p('barrier', -40, 70, Math.PI / 2),
  p('barrier', 44, 70, Math.PI / 2),
  p('barrier', -70, 104, 0),
  p('barrier', 70, 118, 0),
  p('busStop', -12.5, 76 + 6, -Math.PI / 2),
  p('busStop', -90, 77, Math.PI),
  p('sandbags', -70, 132, 0),
  p('sandbags', 70, 90, 0),
  p('rubble', -110, 2, 0.8),
  p('rubble', 30, 70, 1.6),
  p('dumpster', -112, 30, 0),
  p('dumpster', 142, 40, Math.PI / 2),
  p('crate', -132, 44, 0.3),
  p('crate', 124, 30, 1.0),
  p('container', -40, 112, 0),
  p('container', 30, 98, Math.PI / 2),
  ...[-150, -100, 100, 150].map((x) => p('tree', x, 10.5)),
];

// --- HQs ---
/** 32 points (4 rows of 8), so all 16 soldiers of a side start on their own spot. */
const blueSpawns: SpawnDef[] = [-28, -20, -12, -4, 4, 12, 20, 28].flatMap((x) => [155, 161, 167, 173].map((z) => ({ x, z, yaw: 0 })));
const hqBlueProps: PropDef[] = [
  ...[-52, -40, 40, 52].map((x) => p('sandbags', x, 150, Math.PI / 2)),
  p('container', -54, 166, 0),
  p('container', -54, 166, 0, { y: 2.6 }),
  p('container', 54, 168, 0),
  p('barrier', -20, 150, Math.PI / 2),
  p('barrier', 20, 150, Math.PI / 2),
  p('car', -36, 174, Math.PI / 2),
  p('car', 36, 174, Math.PI / 2),
];
const hqBlue: HQDef = { team: 'blue', rect: R(-64, 148, 64, 180), spawns: blueSpawns };
const hqRed: HQDef = { team: 'red', rect: mirror.rect(hqBlue.rect), spawns: blueSpawns.map(mirror.spawn) };

// --- Boundary ring just outside the playable area ---
function boundaryRing(): SolidBuildingDef[] {
  const out: SolidBuildingDef[] = [];
  const widths = [18, 24, 14, 20, 26, 16];
  const depth = 14;
  const inner = MAP.half + 1.5;
  let k = 0;
  // South edge (and its mirror for the north), then the east edge (and its mirror for the west).
  for (let x = -MAP.half - depth; x < MAP.half + depth; ) {
    const w = Math.min(widths[k % widths.length], MAP.half + depth - x);
    out.push({ x: x + w / 2, z: inner + depth / 2, w, d: depth, floors: 5 + (k % 4), color: BUILDING_COLORS[(k * 3) % BUILDING_COLORS.length] });
    x += w;
    k++;
  }
  for (let z = -MAP.half; z < MAP.half; ) {
    const w = Math.min(widths[k % widths.length], MAP.half - z);
    out.push({ x: inner + depth / 2, z: z + w / 2, w: depth, d: w, floors: 5 + (k % 4), color: BUILDING_COLORS[(k * 3) % BUILDING_COLORS.length] });
    z += w;
    k++;
  }
  return withMirror(out, mirror.solid);
}

const flags: FlagDef[] = (Object.keys(FLAG_POSITIONS) as FlagId[]).map((id) => ({
  id,
  name: FLAG_NAMES[id],
  x: FLAG_POSITIONS[id][0],
  z: FLAG_POSITIONS[id][1],
  y: 0,
}));

export const VERDAN: MapData = {
  name: 'Verdan District',
  half: MAP.half,
  ground: [...withMirror(groundHalf, mirror.ground), ...groundWhole],
  streets: withMirror(streetsHalf, mirror.street),
  solids: [
    ...withMirror(blocksHalf, mirror.solid),
    ...withMirror(shellA, mirror.solid),
    ...withMirror(shellB, mirror.solid),
  ],
  enterables: [...AREA_A.enterables, ...AREA_B.enterables, ...AREA_C.enterables, ...AREA_D.enterables, ...AREA_E.enterables, ...withMirror(shopHalf, mirror.enterable)],
  props: [
    ...withMirror(streetPropsHalf, mirror.prop),
    ...withMirror(hqBlueProps, mirror.prop),
    ...AREA_A.props,
    ...AREA_B.props,
    ...AREA_C.props,
    ...AREA_D.props,
    ...AREA_E.props,
  ],
  flags,
  hqs: [hqBlue, hqRed],
  flagSpawns: { A: AREA_A.spawns, B: AREA_B.spawns, C: AREA_C.spawns, D: AREA_D.spawns, E: AREA_E.spawns },
  boundary: { solids: boundaryRing(), props: [] },
};
