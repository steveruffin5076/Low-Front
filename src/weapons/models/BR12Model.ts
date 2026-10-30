import { Assembly, box, boxFromTo, circle, cyl, cylZ, profile, section, type V2, type V3 } from './ModelKit';
import type { AttachmentName, WeaponLod, WeaponModel } from './WeaponModel';
import { WM } from './weaponMaterials';

/*
 * BR-12 pump shotgun (fictional; 12 gauge, tube magazine), ~0.99 m overall, 0.47 m barrel.
 * Drawing coordinates: origin at the top of the pistol grip, muzzle along −Z.
 * `Assembly.finish` re-centers on the grip.
 */
const BORE_Y = 0.06;
const RECEIVER = { zRear: 0.07, zFront: -0.15, yBottom: 0.012, yTop: 0.082, halfWidth: 0.017 };
const MUZZLE_Z = -0.62;
const BARREL_R = 0.0115;
/** Magazine tube under the barrel, and the pump that slides on it. */
const TUBE = { y: 0.03, radius: 0.011, front: -0.5 };
const PUMP = { zRear: -0.2, zFront: -0.37 };
/** Vent rib on the barrel. Sights 40 mm over the bore: ghost ring on the receiver, post at the muzzle. */
const RIB_TOP = BORE_Y + BARREL_R + 0.005;
const SIGHT_Y = BORE_Y + 0.04;
const FRONT_POST_Z = MUZZLE_Z + 0.015;
const REAR_Z = 0.035;
const APERTURE = 0.0035;
/** Loading port under the receiver. */
const PORT = { zRear: -0.02, zFront: -0.11 };
const STOCK_END = 0.37;
const SHELL = { radius: 0.0105, length: 0.068 };

const POINTS: Record<AttachmentName, V3> = {
  muzzle: [0, BORE_Y, MUZZLE_Z],
  ejectionPort: [0.018, 0.058, -0.06],
  sightAnchor: [0, SIGHT_Y, REAR_Z + 0.12],
  rightHandGrip: [0, -0.045, 0.04],
  leftHandGrip: [0, 0.012, -0.29],
  magWell: [0, RECEIVER.yBottom, (PORT.zRear + PORT.zFront) / 2],
};

const GRIP_PROFILE: V2[] = [[0.01, 0.013], [0.045, 0.013], [0.075, -0.085], [0.064, -0.096], [0.042, -0.094], [0.014, -0.015]];
const STOCK_PROFILE: V2[] = [
  [0.07, 0.08], [STOCK_END, 0.06], [STOCK_END, -0.085], [STOCK_END - 0.03, -0.09], [0.17, -0.02], [0.1, 0.012], [0.07, 0.014],
];
/** Ribbed pump, seen from the side, around the tube. */
const PUMP_PROFILE: V2[] = [
  [PUMP.zRear, 0.05], [PUMP.zFront, 0.05], [PUMP.zFront, 0.012], [PUMP.zFront + 0.01, 0.006], [PUMP.zRear - 0.01, 0.006], [PUMP.zRear, 0.012],
];
/** Receiver top, rounded. */
const RECEIVER_TOP: V2[] = [[-0.017, 0.072], [0.017, 0.072], [0.017, 0.078], [0.01, RECEIVER.yTop], [-0.01, RECEIVER.yTop], [-0.017, 0.078]];

export function buildBR12(lod: WeaponLod): WeaponModel {
  const asm = new Assembly(`br12-${lod}`);
  asm.addPoints(POINTS);
  if (lod === 'fp') buildDetailed(asm);
  else buildSimple(asm);
  return asm.finish(lod);
}

function buildDetailed(asm: Assembly): void {
  const metal = WM.metal();
  const polymer = WM.polymer();
  const interior = WM.interior();
  const r = RECEIVER;

  // Milled receiver with a rounded top, ejection port on the right, loading port underneath.
  asm.add(metal, boxFromTo([-r.halfWidth, r.yBottom, r.zFront], [r.halfWidth, 0.072, r.zRear]));
  asm.add(metal, section(RECEIVER_TOP, r.zFront, r.zRear));
  asm.add(interior, boxFromTo([r.halfWidth, 0.046, -0.1], [r.halfWidth + 0.0005, 0.07, -0.025]));
  asm.add(interior, boxFromTo([-0.012, r.yBottom - 0.0005, PORT.zFront], [0.012, r.yBottom, PORT.zRear]));
  for (const z of [-0.12, 0.04]) asm.add(metal, cyl(0.0022, 0.037, { axis: 'x', pos: [0, 0.024, z], segments: 6 }));

  // Barrel with vent rib; magazine tube with its cap and the barrel clamp.
  asm.add(metal, cylZ(BARREL_R, r.zFront, MUZZLE_Z, BORE_Y, 0, 10));
  asm.add(interior, cylZ(0.0095, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, 0, 8));
  asm.add(metal, boxFromTo([-0.004, BORE_Y + BARREL_R - 0.001, MUZZLE_Z + 0.005], [0.004, RIB_TOP, r.zFront]));
  for (let z = r.zFront - 0.03; z > MUZZLE_Z + 0.03; z -= 0.045) {
    asm.add(metal, boxFromTo([-0.0025, BORE_Y + BARREL_R - 0.001, z - 0.004], [0.0025, RIB_TOP, z + 0.004]));
  }

  // Front post between two ears, with a brass insert on top.
  const fz = FRONT_POST_Z;
  asm.add(metal, boxFromTo([-0.006, RIB_TOP - 0.002, fz - 0.01], [0.006, RIB_TOP + 0.006, fz + 0.01]));
  asm.add(metal, boxFromTo([-0.0012, RIB_TOP, fz - 0.004], [0.0012, SIGHT_Y - 0.002, fz + 0.004]));
  asm.add(WM.brass(), boxFromTo([-0.0012, SIGHT_Y - 0.002, fz - 0.003], [0.0012, SIGHT_Y, fz + 0.003]));
  for (const x of [-0.0065, 0.0065]) asm.add(metal, boxFromTo([x - 0.0015, RIB_TOP, fz - 0.006], [x + 0.0015, SIGHT_Y + 0.003, fz + 0.006]));

  // Ghost ring rear sight on a base, with protective ears.
  asm.add(metal, boxFromTo([-0.012, r.yTop, REAR_Z - 0.015], [0.012, SIGHT_Y - 0.009, REAR_Z + 0.01]));
  asm.add(metal, section(circle(0, SIGHT_Y, 0.009, 10), REAR_Z - 0.0025, REAR_Z + 0.0025, [circle(0, SIGHT_Y, APERTURE, 10).reverse()]));
  for (const x of [-0.0125, 0.0125]) asm.add(metal, boxFromTo([x - 0.002, r.yTop, REAR_Z - 0.008], [x + 0.002, SIGHT_Y + 0.006, REAR_Z + 0.008]));
  asm.add(metal, cylZ(TUBE.radius, r.zFront, TUBE.front, TUBE.y, 0, 8));
  asm.add(metal, cylZ(TUBE.radius + 0.002, TUBE.front, TUBE.front - 0.025, TUBE.y, 0, 8));
  asm.add(metal, boxFromTo([-0.008, TUBE.y, TUBE.front + 0.005], [0.008, BORE_Y, TUBE.front + 0.02]));

  // Stock with a rubber pad, pistol grip, trigger guard.
  asm.add(polymer, profile(STOCK_PROFILE, 0.036));
  asm.add(polymer, boxFromTo([-0.02, -0.092, STOCK_END], [0.02, 0.062, STOCK_END + 0.012]));
  asm.add(polymer, profile(GRIP_PROFILE, 0.028));
  asm.add(metal, boxFromTo([-0.006, -0.03, -0.07], [0.006, -0.025, 0.014]), boxFromTo([-0.006, -0.03, -0.075], [0.006, r.yBottom, -0.069]));
  // Cross-bolt safety through the trigger guard.
  asm.add(metal, cyl(0.004, 0.04, { axis: 'x', pos: [0, 0.0, -0.06], segments: 6 }));

  // --- Moving parts ---
  // Pump with grip ribs and the twin action bars that run back into the receiver.
  const pz = (PUMP.zRear + PUMP.zFront) / 2;
  const pump = asm.node('pump', [0, TUBE.y, pz]);
  pump.add(polymer, profile(PUMP_PROFILE, 0.046));
  for (let z = PUMP.zRear - 0.02; z > PUMP.zFront + 0.01; z -= 0.022) {
    pump.add(polymer, boxFromTo([-0.0245, 0.012, z - 0.005], [0.0245, 0.046, z + 0.005]));
  }
  for (const x of [-0.013, 0.013]) pump.add(metal, boxFromTo([x - 0.0015, TUBE.y - 0.004, r.zFront - 0.01], [x + 0.0015, TUBE.y + 0.004, PUMP.zRear]));
  asm.node('trigger', [0, 0.008, -0.03]).add(metal, box([0.005, 0.026, 0.005], { pos: [0, -0.006, -0.032], rot: [0.3, 0, 0] }));
  // One shell: rests inside the receiver over the loading port; the shell reload moves it in from the hand.
  const mw = POINTS.magWell;
  const shellY = r.yBottom + SHELL.radius + 0.002;
  asm.node('magazine', mw)
    .add(WM.shellHull(), cylZ(SHELL.radius, mw[2] - SHELL.length / 2, mw[2] + SHELL.length / 2 - 0.012, shellY, 0, 8))
    .add(WM.brass(), cylZ(SHELL.radius + 0.0008, mw[2] + SHELL.length / 2 - 0.012, mw[2] + SHELL.length / 2, shellY, 0, 8));
}

/** Third-person silhouette, under 300 triangles. */
function buildSimple(asm: Assembly): void {
  const metal = WM.metal();
  const polymer = WM.polymer();
  const r = RECEIVER;
  asm.add(metal, boxFromTo([-r.halfWidth, r.yBottom, r.zFront], [r.halfWidth, r.yTop, r.zRear]));
  asm.add(metal, boxFromTo([-0.01, r.yTop, REAR_Z - 0.01], [0.01, SIGHT_Y + 0.006, REAR_Z + 0.01]));
  asm.add(metal, cylZ(BARREL_R, r.zFront, MUZZLE_Z, BORE_Y, 0, 6), cylZ(TUBE.radius, r.zFront, TUBE.front, TUBE.y, 0, 5));
  asm.add(polymer, profile(STOCK_PROFILE, 0.036), profile(GRIP_PROFILE, 0.028));
  asm.add(metal, boxFromTo([-0.003, BORE_Y, FRONT_POST_Z - 0.006], [0.003, SIGHT_Y, FRONT_POST_Z + 0.006]));
  asm.node('pump', [0, TUBE.y, (PUMP.zRear + PUMP.zFront) / 2]).add(polymer, profile(PUMP_PROFILE, 0.046));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(WM.shellHull(), cylZ(SHELL.radius, mw[2] - SHELL.length / 2, mw[2] + SHELL.length / 2, r.yBottom + SHELL.radius + 0.002, 0, 5));
}
