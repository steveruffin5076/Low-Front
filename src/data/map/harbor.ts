import { fillBlock } from './blocks';
import { VERDAN } from './index';
import { mirror, withMirror } from './mirror';
import type { EnterableDef, FlagDef, FlagId, GroundArea, HQDef, MapData, PropDef, Rect, SolidBuildingDef, SpawnDef, StreetDef } from './types';

/**
 * "Kessel Harbor": a dockyard, the second map. Same rules as Verdan: south half authored and
 * mirrored with (x, z) → (−x, −z), so both teams get the same ground. More open than the city:
 * container lanes, low warehouses and long sight lines across the yards.
 *
 *          NORTH — RED HQ (z = −164)
 *   D North Warehouse (−125, −110)     E North Stacks (125, −110)
 *                    C Crane Yard (0, 0)
 *   A South Stacks (−125, 110)         B South Warehouse (125, 110)
 *          SOUTH — BLUE HQ (z = +164)
 */
const R = (x0: number, z0: number, x1: number, z1: number): Rect => ({ x0, z0, x1, z1 });
const p = (type: PropDef['type'], x: number, z: number, rotY = 0, extra: Partial<PropDef> = {}): PropDef => ({ type, x, z, rotY, ...extra });
/** A container with another stacked on top. */
const stack = (x: number, z: number, rotY = 0): PropDef[] => [p('container', x, z, rotY), p('container', x, z, rotY, { y: 2.6 })];

/** Spawns face the flag. */
function spawnsFacing(fx: number, fz: number, points: [number, number][]): SpawnDef[] {
  return points.map(([x, z]) => ({ x, z, yaw: Math.atan2(-(fx - x), -(fz - z)) }));
}

export const HARBOR_FLAGS: Record<FlagId, { pos: [number, number]; name: string }> = {
  A: { pos: [-125, 110], name: 'South Stacks' },
  B: { pos: [125, 110], name: 'South Warehouse' },
  C: { pos: [0, 0], name: 'Crane Yard' },
  D: { pos: [-125, -110], name: 'North Warehouse' },
  E: { pos: [125, -110], name: 'North Stacks' },
};

// --- Streets (south half) ---
const streetsHalf: StreetDef[] = [
  { rect: R(-8, 24, 8, 148), axis: 'z', marking: 'avenue' },
  { rect: R(-64, 140, 64, 148), axis: 'x', marking: 'street' },
  { rect: R(-180, 66, 180, 76), axis: 'x', marking: 'street' },
  { rect: R(-82, 0, -72, 180), axis: 'z', marking: 'street' },
  { rect: R(72, 0, 82, 180), axis: 'z', marking: 'street' },
  { rect: R(-180, -5, -40, 5), axis: 'x', marking: 'none' },
];

// --- Ground ---
const groundHalf: GroundArea[] = [
  { rect: R(-64, 148, 64, 180), kind: 'concrete', raised: false },
  { rect: R(-180, 76, -82, 180), kind: 'gravel', raised: false },
  { rect: R(82, 76, 180, 180), kind: 'asphalt', raised: false },
  { rect: R(-64, 84, -14, 136), kind: 'sidewalk', raised: true },
  { rect: R(14, 84, 64, 136), kind: 'sidewalk', raised: true },
  { rect: R(-180, 12, -90, 58), kind: 'sidewalk', raised: true },
  { rect: R(90, 12, 180, 58), kind: 'sidewalk', raised: true },
  { rect: R(-72, 5, 72, 66), kind: 'gravel', raised: false },
];
const groundWhole: GroundArea[] = [{ rect: R(-40, -40, 40, 40), kind: 'concrete', raised: false }];

// --- Low warehouse blocks (south half) ---
const blocksHalf: SolidBuildingDef[] = [
  ...fillBlock({ rect: R(-64, 84, -14, 136), depth: 12, alleysX: [-40], alleysZ: [110], minFloors: 1, maxFloors: 3, variant: 0 }),
  ...fillBlock({ rect: R(14, 84, 64, 136), depth: 12, alleysX: [40], alleysZ: [110], minFloors: 1, maxFloors: 3, variant: 2 }),
  ...fillBlock({ rect: R(-180, 12, -90, 58), depth: 12, alleysX: [-135], alleysZ: [35], minFloors: 1, maxFloors: 3, variant: 4 }),
  ...fillBlock({ rect: R(90, 12, 180, 58), depth: 12, alleysX: [135], alleysZ: [35], minFloors: 1, maxFloors: 3, variant: 5 }),
];

// --- A: South Stacks (−125, 110): container lanes around an open middle ---
const areaA = {
  props: [
    ...stack(-162, 88),
    p('container', -154, 88),
    ...stack(-162, 132),
    p('container', -154, 132),
    p('container', -100, 88),
    ...stack(-92, 88),
    p('container', -100, 132),
    ...stack(-92, 132),
    p('container', -140, 100, Math.PI / 2),
    p('container', -110, 120, Math.PI / 2),
    p('crane', -125, 158),
    p('trainCar', -172, 110),
    p('crate', -128, 104, 0.3),
    p('crate', -121, 116, 0.8),
    p('sandbags', -133, 116, Math.PI / 2),
    p('sandbags', -117, 104, Math.PI / 2),
    p('pipes', -148, 150, Math.PI / 2),
    p('dumpster', -104, 152, 0),
    p('barrier', -136, 76 + 6, 0),
  ],
  spawns: spawnsFacing(-125, 110, [
    [-125, 88],
    [-125, 132],
    [-147, 112],
    [-104, 108],
    [-140, 128],
    [-110, 92],
  ]),
};

// --- B: South Warehouse (125, 110): the flag inside a big hall, an office beside it ---
const areaB = {
  enterables: [
    { plan: 'depotHall', x: 125, z: 110, rotY: 0 },
    { plan: 'depotOffice', x: 160, z: 110, rotY: Math.PI },
  ] as EnterableDef[],
  props: [
    p('bus', 113, 111, 0, { color: 0x6c7a89 }),
    p('bus', 137, 108, 0, { color: 0x8a6d4f }),
    p('car', 96, 140, 0),
    p('car', 104, 140, 0),
    p('burnedCar', 150, 140, 1.2),
    p('container', 172, 140, 0),
    ...stack(172, 84),
    p('fuelIsland', 112, 150, 0),
    p('fuelIsland', 140, 150, 0),
    p('crate', 120, 92, 0.4),
    p('crate', 132, 128, 1.1),
    p('sandbags', 125, 91, Math.PI / 2),
    p('sandbags', 125, 129, Math.PI / 2),
    p('barrier', 92, 108, 0),
    p('dumpster', 150, 92, Math.PI / 2),
  ],
  spawns: spawnsFacing(125, 110, [
    [125, 86],
    [99, 100],
    [145, 128],
    [109, 134],
    [148, 92],
    [125, 136],
  ]),
};

// --- C: Crane Yard (0, 0) and the container yard between the side roads (south half) ---
const yardHalf: PropDef[] = [
  p('crane', 18, 18),
  ...stack(-24, 12),
  p('container', -12, 26, Math.PI / 2),
  p('container', 6, 30, Math.PI / 2),
  p('trainCar', 30, 8),
  p('pipes', -8, 14, Math.PI / 2),
  p('crate', 4, 12, 0.2),
  p('crate', 10, 10.5, 0.9),
  p('sandbags', -4, 20, 0),
  p('sandbags', 14, 4, Math.PI / 2),
  // Approach yard toward the warehouses.
  ...stack(-50, 30),
  p('container', -36, 46, Math.PI / 2),
  p('container', 48, 40),
  p('container', 30, 52, Math.PI / 2),
  p('container', 56, 20),
  p('crate', -58, 50, 0.5),
  p('crate', 22, 44, 0.1),
  p('barrier', -20, 58, 0),
  p('barrier', 20, 60, 0),
  p('dumpster', 62, 52, 0),
];

// --- Street dressing (south half) ---
const streetPropsHalf: PropDef[] = [
  ...[40, 64, 88, 112, 136].flatMap((z) => [p('streetLight', -9, z, Math.PI / 2), p('streetLight', 9, z, -Math.PI / 2)]),
  ...[-150, -110, 110, 150].map((x) => p('streetLight', x, 65, 0)),
  p('car', -4, 54, 0),
  p('burnedCar', 4, 100, 0.5),
  p('barrier', -77, 40, 0),
  p('barrier', 77, 120, 0),
  p('container', -77, 100),
];

// --- HQs (same as Verdan: 32 spawn points) ---
const blueHq = VERDAN.hqs.find((h) => h.team === 'blue')!;
const hqBlue: HQDef = { team: 'blue', rect: blueHq.rect, spawns: blueHq.spawns };
const hqRed: HQDef = { team: 'red', rect: mirror.rect(hqBlue.rect), spawns: hqBlue.spawns.map(mirror.spawn) };
const hqBlueProps: PropDef[] = [
  ...[-52, -40, 40, 52].map((x) => p('sandbags', x, 150, Math.PI / 2)),
  ...stack(-54, 166),
  p('container', 54, 168),
  p('barrier', -20, 150, Math.PI / 2),
  p('barrier', 20, 150, Math.PI / 2),
  p('crane', 0, 176),
];

const flags: FlagDef[] = (Object.keys(HARBOR_FLAGS) as FlagId[]).map((id) => ({
  id,
  name: HARBOR_FLAGS[id].name,
  x: HARBOR_FLAGS[id].pos[0],
  z: HARBOR_FLAGS[id].pos[1],
  y: 0,
}));

const cSpawns = spawnsFacing(0, 0, [
  [0, 22],
  [0, -22],
  [24, 0],
  [-24, 0],
  [17, -17],
  [-17, 17],
]);

export const HARBOR: MapData = {
  name: 'Kessel Harbor',
  half: VERDAN.half,
  ground: [...withMirror(groundHalf, mirror.ground), ...groundWhole],
  streets: withMirror(streetsHalf, mirror.street),
  solids: withMirror(blocksHalf, mirror.solid),
  enterables: withMirror(areaB.enterables, mirror.enterable),
  props: [
    ...withMirror(areaA.props, mirror.prop),
    ...withMirror(areaB.props, mirror.prop),
    ...withMirror(yardHalf, mirror.prop),
    ...withMirror(streetPropsHalf, mirror.prop),
    ...withMirror(hqBlueProps, mirror.prop),
  ],
  flags,
  hqs: [hqBlue, hqRed],
  flagSpawns: {
    A: areaA.spawns,
    B: areaB.spawns,
    C: cSpawns,
    D: areaB.spawns.map(mirror.spawn),
    E: areaA.spawns.map(mirror.spawn),
  },
  boundary: VERDAN.boundary,
};

