import { Assembly, box, boxFromTo, circle, cyl, cylZ, profile, section, type V2, type V3 } from './ModelKit';
import type { AttachmentName, WeaponLod, WeaponModel } from './WeaponModel';
import { WM } from './weaponMaterials';

/*
 * SR-9 submachine gun (fictional; roller-delayed 9 mm style), ~0.68 m with the stock out,
 * 0.225 m barrel. Drawing coordinates: origin at the top of the pistol grip, muzzle along −Z.
 * `Assembly.finish` re-centers on the grip.
 */
const BORE_Y = 0.055;
const RECEIVER = { zRear: 0.06, zFront: -0.2, yBottom: 0.03, yTop: 0.085, halfWidth: 0.017 };
const MUZZLE_Z = -0.405;
/** Sight line 50 mm over the bore: hooded front post and a round rear aperture. */
const SIGHT_Y = BORE_Y + 0.05;
const FRONT_POST_Z = -0.355;
const REAR_Z = 0.035;
const APERTURE = 0.0032;
const TUBE_Y = 0.083;
const MAGWELL = { zRear: -0.06, zFront: -0.11 };
const STOCK_END = 0.275;

const POINTS: Record<AttachmentName, V3> = {
  muzzle: [0, BORE_Y, MUZZLE_Z],
  ejectionPort: [0.018, 0.062, -0.04],
  sightAnchor: [0, SIGHT_Y, REAR_Z + 0.19],
  rightHandGrip: [0, -0.045, 0.04],
  leftHandGrip: [0, 0.02, -0.22],
  magWell: [0, RECEIVER.yBottom, (MAGWELL.zRear + MAGWELL.zFront) / 2],
};

const GRIP_PROFILE: V2[] = [[0.0, 0.03], [0.04, 0.03], [0.07, -0.08], [0.058, -0.092], [0.036, -0.09], [0.008, -0.01]];
/** Trigger housing under the rear of the receiver. */
const HOUSING: V2[] = [[0.06, 0.03], [-0.03, 0.03], [-0.03, 0.005], [0.0, -0.005], [0.06, 0.005]];
/** Slim handguard around the barrel. */
const HANDGUARD: V2[] = [[-0.115, 0.07], [-0.3, 0.07], [-0.3, 0.03], [-0.29, 0.015], [-0.13, 0.015], [-0.115, 0.03]];
/** Rounded receiver top, seen from the muzzle. */
const RECEIVER_TOP: V2[] = [[-0.017, 0.07], [0.017, 0.07], [0.017, 0.08], [0.011, 0.088], [-0.011, 0.088], [-0.017, 0.08]];

/** Gently curved magazine: front and rear edges sweep forward as they go down. */
function magazineProfile(): V2[] {
  return [[0.022, 0.03], [0.026, -0.05], [0.04, -0.15], [0.002, -0.155], [-0.012, -0.05], [-0.02, 0.03]];
}

export function buildSR9(lod: WeaponLod): WeaponModel {
  const asm = new Assembly(`sr9-${lod}`);
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

  // Stamped receiver with a rounded top, cocking tube over the barrel, ejection port.
  asm.add(metal, boxFromTo([-r.halfWidth, r.yBottom, r.zFront], [r.halfWidth, 0.07, r.zRear]));
  asm.add(metal, section(RECEIVER_TOP, r.zFront, r.zRear));
  asm.add(metal, cylZ(0.011, r.zFront, -0.335, TUBE_Y, 0, 8));
  asm.add(interior, boxFromTo([r.halfWidth, 0.052, -0.065], [r.halfWidth + 0.0005, 0.072, -0.015]));
  for (const z of [-0.17, -0.12, 0.02]) asm.add(metal, cyl(0.002, 0.036, { axis: 'x', pos: [0, 0.04, z], segments: 6 }));

  // Barrel with a three-lug muzzle, polymer handguard, trigger housing and pistol grip.
  asm.add(metal, cylZ(0.0075, r.zFront, MUZZLE_Z + 0.02, BORE_Y, 0, 8));
  asm.add(metal, cylZ(0.0105, MUZZLE_Z + 0.02, MUZZLE_Z, BORE_Y, 0, 8));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    asm.add(metal, box([0.004, 0.004, 0.012], { pos: [Math.cos(a) * 0.012, BORE_Y + Math.sin(a) * 0.012, MUZZLE_Z + 0.03] }));
  }
  asm.add(interior, cylZ(0.0045, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, 0, 6));
  asm.add(polymer, profile(HANDGUARD, 0.044));
  asm.add(polymer, profile(HOUSING, 0.03), profile(GRIP_PROFILE, 0.028));
  asm.add(metal, boxFromTo([-0.005, -0.012, -0.03], [0.005, -0.007, 0.03]));

  // Front sight: a ring hood around a round post, on a block over the cocking tube.
  const fz = FRONT_POST_Z;
  asm.add(metal, boxFromTo([-0.009, TUBE_Y, fz - 0.012], [0.009, SIGHT_Y - 0.012, fz + 0.012]));
  asm.add(metal, section(circle(0, SIGHT_Y, 0.014, 10), fz - 0.008, fz + 0.008, [circle(0, SIGHT_Y, 0.011, 10).reverse()]));
  asm.add(metal, cyl(0.0012, 0.013, { axis: 'y', pos: [0, SIGHT_Y - 0.0065, fz], segments: 6 }));

  // Rear sight: a round drum with the aperture on the sight line.
  asm.add(metal, boxFromTo([-0.009, 0.088, REAR_Z - 0.012], [0.009, SIGHT_Y - 0.012, REAR_Z + 0.012]));
  asm.add(metal, section(circle(0, SIGHT_Y, 0.012, 10), REAR_Z - 0.004, REAR_Z + 0.004, [circle(0, SIGHT_Y, APERTURE, 8).reverse()]));

  // Retractable stock: two rods and a butt pad.
  for (const y of [0.075, 0.035]) asm.add(metal, cylZ(0.004, r.zRear, STOCK_END - 0.012, y, 0, 6));
  asm.add(polymer, boxFromTo([-0.02, -0.06, STOCK_END - 0.014], [0.02, 0.085, STOCK_END]));

  // --- Moving parts ---
  asm.node('bolt', [r.halfWidth, 0.062, -0.04]).add(metal, boxFromTo([r.halfWidth - 0.006, 0.054, -0.06], [r.halfWidth - 0.001, 0.07, -0.02]));
  // Cocking handle at the front of the tube, folding to the right.
  asm.node('chargingHandle', [r.halfWidth, TUBE_Y, -0.3]).add(
    metal,
    boxFromTo([0.008, TUBE_Y - 0.004, -0.305], [r.halfWidth + 0.012, TUBE_Y + 0.004, -0.295]),
    cyl(0.005, 0.012, { axis: 'x', pos: [r.halfWidth + 0.016, TUBE_Y, -0.3], segments: 8 }),
  );
  asm.node('selector', [r.halfWidth + 0.001, 0.015, 0.03]).add(metal, boxFromTo([r.halfWidth, 0.008, 0.02], [r.halfWidth + 0.003, 0.026, 0.04]));
  asm.node('trigger', [0, 0.008, -0.01]).add(metal, box([0.005, 0.024, 0.005], { pos: [0, -0.005, -0.012], rot: [0.3, 0, 0] }));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(metal, profile(magazineProfile().map(([z, y]) => [z + mw[2], y + mw[1]] as V2), 0.022));
}

/** Third-person silhouette, under 300 triangles. */
function buildSimple(asm: Assembly): void {
  const metal = WM.metal();
  const polymer = WM.polymer();
  const r = RECEIVER;
  asm.add(metal, boxFromTo([-r.halfWidth, r.yBottom, r.zFront], [r.halfWidth, 0.088, r.zRear]));
  asm.add(metal, cylZ(0.008, r.zFront, MUZZLE_Z, BORE_Y, 0, 5), cylZ(0.011, r.zFront, -0.335, TUBE_Y, 0, 5));
  asm.add(polymer, profile(HANDGUARD, 0.044), profile(GRIP_PROFILE, 0.028), profile(HOUSING, 0.03));
  asm.add(metal, boxFromTo([-0.008, TUBE_Y, FRONT_POST_Z - 0.01], [0.008, SIGHT_Y + 0.008, FRONT_POST_Z + 0.01]));
  asm.add(metal, boxFromTo([-0.008, 0.088, REAR_Z - 0.01], [0.008, SIGHT_Y + 0.008, REAR_Z + 0.01]));
  asm.add(polymer, boxFromTo([-0.02, -0.06, STOCK_END - 0.014], [0.02, 0.085, STOCK_END]));
  asm.add(metal, boxFromTo([-0.004, 0.03, r.zRear], [0.004, 0.08, STOCK_END - 0.014]));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(metal, profile(magazineProfile().map(([z, y]) => [z + mw[2], y + mw[1]] as V2), 0.022));
}
