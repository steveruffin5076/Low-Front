import { VIEWMODEL } from '../../data/viewmodel';
import { Assembly, box, boxFromTo, cyl, cylZ, profile, type V2, type V3 } from './ModelKit';
import type { AttachmentName, WeaponLod, WeaponModel } from './WeaponModel';
import { WM } from './weaponMaterials';

/*
 * LR-24 bolt-action sniper rifle (fictional), ~1.1 m overall, 0.56 m heavy barrel, 6x scope.
 * Drawing coordinates: origin at the top of the pistol grip, muzzle along −Z.
 * `Assembly.finish` re-centers on the grip.
 */
const BORE_Y = 0.055;
/** Round receiver around the bolt. */
const RECEIVER = { zRear: 0.1, zFront: -0.12, radius: 0.016 };
const MUZZLE_Z = -0.66;
const SCOPE_Y = BORE_Y + 0.05;
const SCOPE = { tube: 0.013, zFront: -0.13, zRear: 0.12, objective: 0.021, eyepiece: 0.018 };
const BOLT_PIVOT: V3 = [0, BORE_Y, 0.06];
/** Bolt handle knob, relative to the bolt pivot; the viewmodel data also guides the hand there. */
const BOLT_KNOB = VIEWMODEL.lr24.bolt!.knob;
const MAGWELL = { zRear: 0.0, zFront: -0.06 };
const BUTT_END = 0.44;

const POINTS: Record<AttachmentName, V3> = {
  muzzle: [0, BORE_Y, MUZZLE_Z],
  ejectionPort: [0.017, BORE_Y + 0.006, 0.0],
  sightAnchor: [0, SCOPE_Y, SCOPE.zRear + 0.07 + 0.08],
  rightHandGrip: [0, -0.045, 0.04],
  leftHandGrip: [0, 0.0, -0.3],
  magWell: [0, 0.0, (MAGWELL.zRear + MAGWELL.zFront) / 2],
};

const GRIP_PROFILE: V2[] = [[0.01, 0.01], [0.05, 0.01], [0.08, -0.085], [0.068, -0.096], [0.046, -0.094], [0.014, -0.015]];
/** One-piece stock: forend, action bed, and the butt with a raised comb. */
const FOREND: V2[] = [[-0.12, 0.042], [-0.44, 0.042], [-0.45, 0.03], [-0.44, 0.0], [-0.12, -0.005]];
const BED: V2[] = [[0.1, 0.045], [-0.12, 0.045], [-0.12, -0.005], [0.1, -0.005]];
const BUTT: V2[] = [[0.1, 0.045], [0.16, 0.065], [BUTT_END, 0.065], [BUTT_END, -0.1], [BUTT_END - 0.025, -0.106], [0.2, -0.035], [0.12, -0.012], [0.1, -0.005]];

export function buildLR24(lod: WeaponLod): WeaponModel {
  const asm = new Assembly(`lr24-${lod}`);
  asm.addPoints(POINTS);
  if (lod === 'fp') buildDetailed(asm);
  else buildSimple(asm);
  return asm.finish(lod);
}

function buildDetailed(asm: Assembly): void {
  const metal = WM.metal();
  const stock = WM.stockGreen();
  const interior = WM.interior();
  const r = RECEIVER;

  // Round receiver with the ejection port, heavy tapered barrel with a crowned muzzle.
  asm.add(metal, cylZ(r.radius, r.zFront, r.zRear, BORE_Y, 0, 10));
  asm.add(interior, boxFromTo([r.radius - 0.002, BORE_Y - 0.002, -0.03], [r.radius + 0.0005, BORE_Y + 0.012, 0.03]));
  asm.add(metal, cyl(0.009, Math.abs(MUZZLE_Z - r.zFront), { radiusEnd: 0.013, pos: [0, BORE_Y, (MUZZLE_Z + r.zFront) / 2], segments: 10 }));
  asm.add(interior, cylZ(0.004, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, 0, 6));

  // Stock, butt pad, grip, trigger guard, sling studs.
  asm.add(stock, profile(FOREND, 0.04), profile(BED, 0.038), profile(BUTT, 0.036), profile(GRIP_PROFILE, 0.03));
  asm.add(WM.polymer(), boxFromTo([-0.019, -0.106, BUTT_END], [0.019, 0.066, BUTT_END + 0.014]));
  asm.add(metal, boxFromTo([-0.006, -0.03, -0.075], [0.006, -0.025, 0.012]), boxFromTo([-0.006, -0.03, -0.08], [0.006, -0.005, -0.074]));
  for (const z of [-0.4, 0.36]) asm.add(metal, cyl(0.003, 0.012, { axis: 'y', pos: [0, z < 0 ? -0.008 : -0.095, z], segments: 6 }));

  // Scope: rings, tube, objective and eyepiece bells, turrets, lenses.
  for (const z of [-0.08, 0.06]) {
    asm.add(metal, boxFromTo([-0.008, BORE_Y + r.radius - 0.003, z - 0.008], [0.008, SCOPE_Y - SCOPE.tube + 0.002, z + 0.008]));
    asm.add(metal, cylZ(SCOPE.tube + 0.0025, z - 0.008, z + 0.008, SCOPE_Y, 0, 10));
  }
  asm.add(metal, cylZ(SCOPE.tube, SCOPE.zFront, SCOPE.zRear, SCOPE_Y, 0, 10));
  asm.add(metal, cyl(SCOPE.objective, 0.04, { radiusEnd: SCOPE.tube, pos: [0, SCOPE_Y, SCOPE.zFront - 0.02], segments: 10 }));
  asm.add(metal, cylZ(SCOPE.objective, SCOPE.zFront - 0.04, SCOPE.zFront - 0.12, SCOPE_Y, 0, 10));
  asm.add(metal, cyl(SCOPE.tube, 0.03, { radiusEnd: SCOPE.eyepiece, pos: [0, SCOPE_Y, SCOPE.zRear + 0.015], segments: 10 }));
  asm.add(metal, cylZ(SCOPE.eyepiece, SCOPE.zRear + 0.03, SCOPE.zRear + 0.07, SCOPE_Y, 0, 10));
  asm.add(metal, cyl(0.008, 0.02, { axis: 'y', pos: [0, SCOPE_Y + SCOPE.tube + 0.008, -0.01], segments: 8 }));
  asm.add(metal, cyl(0.008, 0.02, { axis: 'x', pos: [SCOPE.tube + 0.008, SCOPE_Y, -0.01], segments: 8 }));
  asm.add(interior, cylZ(SCOPE.objective - 0.002, SCOPE.zFront - 0.1205, SCOPE.zFront - 0.118, SCOPE_Y, 0, 10));
  asm.add(interior, cylZ(SCOPE.eyepiece - 0.002, SCOPE.zRear + 0.068, SCOPE.zRear + 0.0705, SCOPE_Y, 0, 10));

  // --- Moving parts ---
  // Bolt: body inside the receiver, shroud out the back, handle to the right ending in a knob.
  const [px, py, pz] = BOLT_PIVOT;
  const [kx, ky, kz] = BOLT_KNOB;
  asm.node('bolt', BOLT_PIVOT).add(
    WM.bolt(),
    cylZ(0.009, r.zRear - 0.07, r.zRear + 0.02, BORE_Y, 0, 8),
    boxFromTo([px + 0.008, py - 0.004, pz + kz - 0.004], [px + kx - 0.004, py + 0.004, pz + kz + 0.004]),
    box([0.012, 0.012, 0.012], { pos: [px + kx, py + ky, pz + kz], rot: [0.6, 0.6, 0] }),
  );
  asm.node('trigger', [0, 0.004, -0.03]).add(metal, box([0.005, 0.024, 0.005], { pos: [0, -0.01, -0.032], rot: [0.3, 0, 0] }));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(metal, boxFromTo([-0.012, -0.03, MAGWELL.zFront], [0.012, 0.03, MAGWELL.zRear]));
}

/** Third-person silhouette, under 300 triangles. */
function buildSimple(asm: Assembly): void {
  const metal = WM.metal();
  const stock = WM.stockGreen();
  const r = RECEIVER;
  asm.add(metal, cylZ(r.radius, r.zFront, r.zRear, BORE_Y, 0, 6), cylZ(0.011, r.zFront, MUZZLE_Z, BORE_Y, 0, 5));
  asm.add(stock, profile(FOREND, 0.04), profile(BED, 0.038), profile(BUTT, 0.036), profile(GRIP_PROFILE, 0.03));
  asm.add(metal, cylZ(SCOPE.objective, SCOPE.zFront - 0.12, SCOPE.zRear + 0.07, SCOPE_Y, 0, 6));
  asm.add(metal, boxFromTo([-0.006, BORE_Y, -0.08], [0.006, SCOPE_Y, 0.06]));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(metal, boxFromTo([-0.012, -0.03, MAGWELL.zFront], [0.012, 0.03, MAGWELL.zRear]));
}
