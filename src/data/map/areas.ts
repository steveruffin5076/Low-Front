import type { EnterableDef, FlagId, PropDef, SolidBuildingDef, SpawnDef } from './types';

/**
 * Themed flag areas and the central plaza (plan section 10.2). Each themed area is authored
 * on its own; A ↔ E and B ↔ D share a mirrored shell of perimeter buildings (see index.ts)
 * so both teams get the same size, height and cover around their nearest flags.
 */
const E = 0;
const p = (type: PropDef['type'], x: number, z: number, rotY = 0, extra: Partial<PropDef> = {}): PropDef => ({ type, x, z, rotY, ...extra });
const row = (type: PropDef['type'], x0: number, z0: number, dx: number, dz: number, n: number, rotY = 0): PropDef[] =>
  Array.from({ length: n }, (_, i) => p(type, x0 + dx * i, z0 + dz * i, rotY));

export interface Area {
  enterables: EnterableDef[];
  solids: SolidBuildingDef[];
  props: PropDef[];
  spawns: SpawnDef[];
}

/** Spawns face the flag. */
function spawnsFacing(fx: number, fz: number, points: [number, number][]): SpawnDef[] {
  return points.map(([x, z]) => ({ x, z, yaw: Math.atan2(-(fx - x), -(fz - z)) }));
}

// --- A: Bus Depot (−120, +120) ---
export const AREA_A: Area = {
  enterables: [
    { plan: 'depotHall', x: -120, z: 120, rotY: 0 },
    { plan: 'depotOffice', x: -150, z: 120, rotY: 0 },
  ],
  solids: [],
  props: [
    // Buses in the side bays, the middle bay keeps the flag clear.
    p('bus', -132, 121, 0),
    p('bus', -108, 118, 0),
    p('bus', -160, 150, Math.PI / 2),
    p('bus', -96, 98, 0.15),
    p('fuelIsland', -104, 150, 0),
    p('fuelIsland', -136, 150, 0),
    ...row('lowWall', -168, 92, 4.5, 0, 4, Math.PI / 2),
    ...row('lowWall', -108, 92, 4.5, 0, 4, Math.PI / 2),
    ...row('lowWall', -168, 164, 4.5, 0, 6, Math.PI / 2),
    p('burnedCar', -128, 96, 0.4),
    p('car', -88, 140, 0),
    p('car', -88, 132, 0),
    p('container', -168, 104, 0),
    p('container', -168, 136, 0),
    p('container', -168, 136, 0, { y: 2.6 }),
    p('sandbags', -120, 101, Math.PI / 2),
    p('sandbags', -120, 139, Math.PI / 2),
    p('crate', -126, 104, 0.3),
    p('crate', -114, 136, 0.7),
    p('crate', -100, 112, 0.2),
    p('dumpster', -146, 104, Math.PI / 2),
    p('barrier', -90, 112, 0),
    p('barrier', -150, 140, Math.PI / 2),
    p('rubble', -140, 160, 0.4),
  ],
  spawns: spawnsFacing(-120, 120, [
    [-120, 96],
    [-146, 110],
    [-98, 140],
    [-136, 144],
    [-95, 108],
    [-120, 147],
  ]),
};

// --- B: Apartment Block (+120, +120), flag in the courtyard ---
export const AREA_B: Area = {
  enterables: [{ plan: 'apartment', x: 124, z: 100, rotY: 0 }],
  solids: [],
  props: [
    ...row('tree', 106, 112, 10, 0, 2),
    p('tree', 144, 140),
    p('tree', 104, 146),
    ...row('planter', 112, 132, 0, 0, 1, Math.PI / 2),
    p('planter', 132, 108, Math.PI / 2),
    p('car', 140, 116, 0.2),
    p('car', 104, 128, Math.PI / 2),
    p('burnedCar', 134, 134, 2.4),
    p('sandbags', 120, 112, Math.PI / 2),
    p('sandbags', 128, 124, 0),
    p('sandbags', 112, 124, 0),
    p('lowWall', 120, 140, Math.PI / 2),
    p('lowWall', 144, 126, 0),
    p('dumpster', 98, 112, 0),
    p('crate', 146, 112, 0.4),
    p('rubble', 112, 140, 1.2),
  ],
  spawns: spawnsFacing(120, 120, [
    [120, 141],
    [102, 120],
    [143, 118],
    [106, 140],
    [141, 141],
    [98, 104],
  ]),
};

// --- D: Construction Site (−120, −120) ---
export const AREA_D: Area = {
  enterables: [{ plan: 'constructionFrame', x: -124, z: -100, rotY: Math.PI }],
  solids: [],
  props: [
    p('crane', -150, -132, 0.6),
    p('scaffolding', -124, -111.6, Math.PI / 2),
    p('pipes', -104, -128, 0),
    p('pipes', -138, -140, Math.PI / 2),
    p('dirtMound', -110, -140, 0),
    p('dirtMound', -132, -124, 1.1),
    p('dirtMound', -96, -116, 2.0),
    p('rubble', -120, -132, 0.3),
    p('rubble', -144, -112, 1.4),
    p('container', -100, -146, Math.PI / 2),
    p('container', -100, -146, Math.PI / 2, { y: 2.6 }),
    p('container', -160, -112, 0),
    p('crate', -114, -126, 0.2),
    p('crate', -126, -138, 0.9),
    p('sandbags', -120, -108, Math.PI / 2),
    ...row('fence', -168, -88, 4.2, 0, 6, Math.PI / 2),
    ...row('fence', -100, -88, 4.2, 0, 4, Math.PI / 2),
  ],
  spawns: spawnsFacing(-120, -120, [
    [-120, -141],
    [-102, -120],
    [-143, -118],
    [-106, -140],
    [-142, -138],
    [-98, -104],
  ]),
};

// --- E: Rail Yard (+120, −120): tracks along X at z −128 and −112 ---
const TRACKS_Z = [-128, -112];
export const AREA_E: Area = {
  enterables: [{ plan: 'station', x: 124, z: -150, rotY: Math.PI }],
  solids: [],
  props: [
    ...TRACKS_Z.flatMap((z) => row('rails', 83, z, 10, 0, 10, Math.PI / 2)),
    p('trainCar', 96, -128, Math.PI / 2),
    p('trainCar', 160, -128, Math.PI / 2),
    p('trainCar', 102, -112, Math.PI / 2),
    p('trainCar', 154, -112, Math.PI / 2),
    p('footbridge', 140, -120, 0),
    p('container', 96, -96, Math.PI / 2),
    p('container', 96, -96, Math.PI / 2, { y: 2.6 }),
    p('container', 152, -96, Math.PI / 2),
    p('container', 168, -140, 0),
    p('container', 168, -140, 0, { y: 2.6 }),
    p('crate', 120, -136, 0.3),
    p('crate', 112, -104, 0.8),
    p('sandbags', 120, -120, 0),
    p('barrier', 128, -136, Math.PI / 2),
    p('barrier', 108, -136, Math.PI / 2),
    p('dumpster', 140, -146, Math.PI / 2),
    p('rubble', 128, -100, 0.6),
  ],
  spawns: spawnsFacing(120, -120, [
    [120, -96],
    [98, -136],
    [144, -104],
    [138, -142],
    [94, -120],
    [120, -142],
  ]),
};

// --- C: City Hall Plaza (0, 0), authored whole and point-symmetric ---
const plazaHalf: PropDef[] = [
  p('statue', -20, 0, Math.PI / 2),
  p('sandbags', -12, -14, Math.PI / 2),
  p('sandbags', -14.2, -12, 0),
  p('sandbags', 14, 12, 0),
  p('car', -28, -22, 0.1),
  p('car', 26, -24, Math.PI / 2),
  p('burnedCar', -8, 22, 1.2),
  ...row('planter', -34, -26, 6, 0, 3, Math.PI / 2),
  p('tree', -33, 24),
  p('tree', 33, 24),
  p('barrier', 12, -22, 0),
  p('crate', -24, 12, 0.4),
];

export const AREA_C: Area = {
  enterables: [
    { plan: 'cityHall', x: -52, z: 0, rotY: E },
    { plan: 'officeTower', x: 52, z: 0, rotY: E },
  ],
  solids: [],
  props: [p('fountain', 0, 0, 0), ...plazaHalf, ...plazaHalf.map((q) => ({ ...q, x: -q.x, z: -q.z, rotY: q.rotY + Math.PI }))],
  spawns: spawnsFacing(0, 0, [
    [-24, -6],
    [24, 6],
    [-5, 25],
    [5, -25],
    [-24, 16],
    [24, -16],
  ]),
};

export const FLAG_POSITIONS: Record<FlagId, [number, number]> = {
  A: [-120, 120],
  B: [120, 120],
  C: [0, 0],
  D: [-120, -120],
  E: [120, -120],
};

export const FLAG_NAMES: Record<FlagId, string> = {
  A: 'Bus Depot',
  B: 'Apartment Block',
  C: 'City Hall Plaza',
  D: 'Construction Site',
  E: 'Rail Yard',
};

