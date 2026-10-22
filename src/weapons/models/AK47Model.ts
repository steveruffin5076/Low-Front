import { Assembly, arc, box, boxFromTo, cyl, cylZ, profile, section, type V2, type V3 } from './ModelKit';
import type { AttachmentName, WeaponLod, WeaponModel } from './WeaponModel';
import { WM } from './weaponMaterials';

/*
 * AK47, ~0.88 m overall, 0.415 m barrel. Drawing coordinates: origin at the top of the
 * pistol grip, muzzle along −Z. `Assembly.finish` re-centers on the grip.
 */
const BORE_Y = 0.058;
const RECEIVER = { zRear: 0.095, zFront: -0.135, yBottom: 0.012, yTop: 0.07, halfWidth: 0.015 };
const MUZZLE_Z = -0.58;
const SIGHT_Y = 0.093;
const GAS_Y = 0.085;
const MAGWELL = { zRear: -0.07, zFront: -0.125 };

const POINTS: Record<AttachmentName, V3> = {
  muzzle: [0, BORE_Y, MUZZLE_Z],
  ejectionPort: [0.016, 0.06, -0.02],
  sightAnchor: [0, SIGHT_Y, 0.15],
  rightHandGrip: [0, -0.045, 0.04],
  leftHandGrip: [0, 0.02, -0.26],
  magWell: [0, RECEIVER.yBottom, (MAGWELL.zRear + MAGWELL.zFront) / 2],
};

const GRIP_PROFILE: V2[] = [[0.01, 0.013], [0.045, 0.013], [0.075, -0.085], [0.064, -0.096], [0.042, -0.094], [0.014, -0.015]];
/** Fixed wood stock with a drop toward the butt. */
const STOCK_PROFILE: V2[] = [
  [0.095, 0.068], [0.295, 0.033], [0.295, -0.092], [0.28, -0.094], [0.16, -0.012], [0.12, 0.012], [0.095, 0.015],
];
const LOWER_HANDGUARD: V2[] = [
  [-0.14, 0.071], [-0.372, 0.071], [-0.372, 0.032], [-0.355, 0.024], [-0.3, 0.026], [-0.27, 0.021], [-0.22, 0.024],
  [-0.16, 0.019], [-0.14, 0.016],
];
/** Dust cover cross-section (x, y), rounded on top. */
const DUST_COVER: V2[] = [
  [-0.015, 0.07], [0.015, 0.07], [0.015, 0.078], [0.01, 0.085], [0, 0.087], [-0.01, 0.085], [-0.015, 0.078],
];

/** Banana magazine: rear and front edges are arcs of 5 segments around a center ahead of the gun. */
function magazineProfile(): V2[] {
  const center: V2 = [-0.44, 0.0];
  const sweep = 0.5;
  const rear = arc(center, 0.465, 0, sweep, 5);
  const front = arc(center, 0.408, 0, sweep, 5).reverse();
  // Top part sits straight up inside the receiver.
  return [[0.025, 0.035], ...rear, ...front, [-0.032, 0.035]];
}

export function buildAK47(lod: WeaponLod): WeaponModel {
  const asm = new Assembly(`ak47-${lod}`);
  asm.addPoints(POINTS);
  if (lod === 'fp') buildDetailed(asm);
  else buildSimple(asm);
  return asm.finish(lod);
}

function buildDetailed(asm: Assembly): void {
  const metal = WM.metal();
  const wood = WM.akWood();
  const interior = WM.interior();
  const r = RECEIVER;

  // Stamped receiver, ribbed dust cover, recoil spring button, rivets.
  asm.add(metal, boxFromTo([-r.halfWidth, r.yBottom, r.zFront], [r.halfWidth, r.yTop, r.zRear]));
  asm.add(metal, section(DUST_COVER, -0.1, r.zRear + 0.012));
  for (const z of [0.0, 0.03, 0.06]) asm.add(metal, box([0.032, 0.004, 0.006], { pos: [0, 0.082, z] }));
  asm.add(metal, box([0.008, 0.006, 0.006], { pos: [0, 0.078, r.zRear + 0.015] }));
  for (const z of [0.07, 0.03, -0.09, -0.115]) {
    for (const x of [-r.halfWidth, r.halfWidth]) asm.add(metal, cyl(0.002, 0.002, { axis: 'x', pos: [x, 0.02, z], segments: 6 }));
  }
  // Charging handle slot on the right side.
  asm.add(interior, boxFromTo([r.halfWidth, 0.052, -0.08], [r.halfWidth + 0.0005, 0.058, 0.05]));

  // Rear sight block over the front trunnion with a tangent leaf and a notch.
  asm.add(metal, boxFromTo([-0.013, 0.06, -0.165], [0.013, 0.08, -0.1]));
  asm.add(metal, box([0.016, 0.003, 0.06], { pos: [0, 0.084, -0.128], rot: [-0.08, 0, 0] }));
  asm.add(metal, boxFromTo([-0.01, 0.08, -0.14], [0.01, 0.087, -0.13]));
  asm.add(metal, boxFromTo([-0.008, 0.086, -0.161], [-0.0015, SIGHT_Y, -0.157]), boxFromTo([0.0015, 0.086, -0.161], [0.008, SIGHT_Y, -0.157]));

  // Barrel, gas tube with wood upper handguard, wood lower handguard with a metal retainer.
  asm.add(metal, cylZ(0.0085, r.zFront, -0.545, BORE_Y, 0, 8));
  asm.add(metal, cylZ(0.011, -0.165, -0.425, GAS_Y, 0, 8));
  asm.add(wood, cylZ(0.0145, -0.17, -0.35, GAS_Y, 0, 8));
  asm.add(wood, profile(LOWER_HANDGUARD, 0.04));
  asm.add(metal, boxFromTo([-0.021, 0.022, -0.385], [0.021, 0.075, -0.372]));
  // Gas block linking the barrel and the gas tube.
  asm.add(metal, boxFromTo([-0.011, 0.046, -0.44], [0.011, 0.096, -0.415]));
  asm.add(metal, box([0.016, 0.02, 0.014], { pos: [0, 0.07, -0.41], rot: [0.6, 0, 0] }));

  // Front sight tower with protective ears and post.
  asm.add(metal, boxFromTo([-0.011, 0.045, -0.505], [0.011, 0.07, -0.482]));
  asm.add(metal, profile([[-0.48, 0.07], [-0.507, 0.07], [-0.5, 0.083], [-0.488, 0.083]], 0.016));
  asm.add(
    metal,
    boxFromTo([-0.01, 0.078, -0.498], [-0.006, 0.1, -0.49]),
    boxFromTo([0.006, 0.078, -0.498], [0.01, 0.1, -0.49]),
    boxFromTo([-0.0015, 0.083, -0.496], [0.0015, SIGHT_Y, -0.492]),
  );

  // Slant muzzle brake: longer on top, cut back underneath.
  asm.add(metal, profile([[-0.545, 0.071], [MUZZLE_Z, 0.071], [MUZZLE_Z + 0.01, 0.045], [-0.545, 0.045]], 0.022));
  asm.add(interior, cylZ(0.0045, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, 0, 6));

  // Wood stock with steel butt plate, wood pistol grip, steel trigger guard.
  asm.add(wood, profile(STOCK_PROFILE, 0.036));
  asm.add(metal, boxFromTo([-0.019, -0.096, 0.295], [0.019, 0.036, 0.302]));
  asm.add(wood, profile(GRIP_PROFILE, 0.028));
  asm.add(metal, boxFromTo([-0.006, -0.032, -0.065], [0.006, -0.027, 0.012]), boxFromTo([-0.006, -0.032, -0.07], [0.006, r.yBottom, -0.064]));

  // --- Moving parts ---
  // Big safety/selector lever on the right side, pivot at its rear.
  asm.node('selector', [r.halfWidth + 0.001, 0.058, 0.08]).add(
    metal,
    boxFromTo([r.halfWidth, 0.052, -0.045], [r.halfWidth + 0.002, 0.064, 0.085]),
    boxFromTo([r.halfWidth, 0.042, -0.045], [r.halfWidth + 0.004, 0.054, -0.032]),
  );
  asm.node('chargingHandle', [r.halfWidth, 0.055, -0.065]).add(
    metal,
    boxFromTo([r.halfWidth, 0.051, -0.07], [r.halfWidth + 0.012, 0.059, -0.06]),
    cyl(0.0065, 0.012, { axis: 'x', pos: [r.halfWidth + 0.017, 0.055, -0.065], segments: 8 }),
  );
  asm.node('trigger', [0, 0.008, -0.02]).add(metal, box([0.005, 0.026, 0.005], { pos: [0, -0.006, -0.022], rot: [0.3, 0, 0] }));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(metal, profile(magazineProfile().map(([z, y]) => [z + mw[2], y + mw[1]] as V2), 0.024));
}

/** Third-person silhouette, under 300 triangles. */
function buildSimple(asm: Assembly): void {
  const metal = WM.metal();
  const wood = WM.akWood();
  const r = RECEIVER;
  asm.add(metal, boxFromTo([-r.halfWidth, r.yBottom, r.zFront], [r.halfWidth, 0.085, r.zRear]));
  asm.add(metal, cylZ(0.009, r.zFront, MUZZLE_Z, BORE_Y, 0, 5));
  asm.add(wood, cylZ(0.0145, -0.17, -0.35, GAS_Y, 0, 5), profile(LOWER_HANDGUARD, 0.04));
  asm.add(metal, boxFromTo([-0.008, 0.045, -0.505], [0.008, 0.1, -0.482]));
  asm.add(wood, profile(STOCK_PROFILE, 0.036), profile(GRIP_PROFILE, 0.028));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(metal, profile(magazineProfile().map(([z, y]) => [z + mw[2], y + mw[1]] as V2), 0.024));
}
