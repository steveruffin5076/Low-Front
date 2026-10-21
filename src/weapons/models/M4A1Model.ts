import { Assembly, box, boxFromTo, cyl, cylZ, profile, type V2, type V3 } from './ModelKit';
import type { AttachmentName, WeaponLod, WeaponModel } from './WeaponModel';
import { WM } from './weaponMaterials';

/*
 * M4A1, ~0.84 m overall, 14.5" (0.37 m) barrel. Built in "drawing" coordinates:
 * origin at the top of the pistol grip, muzzle along −Z. `Assembly.finish` re-centers on the grip.
 */
const BORE_Y = 0.072;
const UPPER = { zRear: 0.085, zFront: -0.105, yBottom: 0.045, yTop: 0.094, halfWidth: 0.014 };
const RAIL_TOP = 0.099;
const HANDGUARD = { zRear: -0.105, zFront: -0.285, radius: 0.024 };
const MUZZLE_Z = -0.55;
const SIGHT_Y = 0.121;
const PORT = { zRear: -0.005, zFront: -0.06, yBottom: 0.058, yTop: 0.082 };
const MAGWELL = { zRear: -0.035, zFront: -0.108, yBottom: -0.048 };

const POINTS: Record<AttachmentName, V3> = {
  muzzle: [0, BORE_Y, MUZZLE_Z],
  ejectionPort: [0.016, 0.07, (PORT.zRear + PORT.zFront) / 2],
  sightAnchor: [0, SIGHT_Y, 0.2],
  rightHandGrip: [0, -0.045, 0.032],
  leftHandGrip: [0, 0.045, -0.2],
  magWell: [0, MAGWELL.yBottom, (MAGWELL.zRear + MAGWELL.zFront) / 2],
};

const LOWER_PROFILE: V2[] = [
  [0.085, 0.045], [0.085, 0.012], [0.06, 0.0], [-0.03, 0.0], [-0.035, -0.04], [-0.04, -0.048],
  [-0.108, -0.048], [-0.106, 0.0], [-0.112, 0.02], [-0.105, 0.045],
];
const GRIP_PROFILE: V2[] = [
  [-0.008, 0.002], [0.03, 0.002], [0.05, -0.04], [0.062, -0.088], [0.055, -0.096], [0.025, -0.096], [0.012, -0.05],
];
const STOCK_PROFILE: V2[] = [
  [0.165, 0.09], [0.28, 0.096], [0.28, -0.04], [0.255, -0.04], [0.205, 0.035], [0.175, 0.05], [0.165, 0.06],
];
/** STANAG magazine in magazine-local coordinates (pivot = bottom of the mag well). Bottom curves forward. */
const MAG_PROFILE: V2[] = [
  [0.03, 0.045], [-0.03, 0.045], [-0.031, 0.0], [-0.036, -0.06], [-0.046, -0.115], [-0.05, -0.124],
  [-0.016, -0.13], [0.008, -0.12], [0.02, -0.06], [0.028, 0.0],
];

export function buildM4A1(lod: WeaponLod): WeaponModel {
  const asm = new Assembly(`m4a1-${lod}`);
  asm.addPoints(POINTS);
  if (lod === 'fp') buildDetailed(asm);
  else buildSimple(asm);
  return asm.finish(lod);
}

function buildDetailed(asm: Assembly): void {
  const metal = WM.metal();
  const polymer = WM.polymer();
  const u = UPPER;

  // Lower receiver with mag well, pistol grip, trigger guard.
  asm.add(metal, profile(LOWER_PROFILE, 0.026));
  asm.add(polymer, profile(GRIP_PROFILE, 0.026));
  asm.add(metal, boxFromTo([-0.006, -0.036, -0.036], [0.006, -0.03, 0.008]), boxFromTo([-0.006, -0.036, -0.036], [0.006, 0, -0.03]));
  // Selector indicator on the right, bolt catch housing.
  asm.add(metal, cyl(0.004, 0.003, { axis: 'x', pos: [0.0145, 0.03, 0.045], segments: 6 }));

  // Upper receiver: solid left part plus a right wall built around the ejection port.
  const split = 0.006;
  asm.add(metal, boxFromTo([-u.halfWidth, u.yBottom, u.zFront], [split, u.yTop, u.zRear]));
  asm.add(
    metal,
    boxFromTo([split, u.yBottom, u.zFront], [u.halfWidth, PORT.yBottom, u.zRear]),
    boxFromTo([split, PORT.yTop, u.zFront], [u.halfWidth, u.yTop, u.zRear]),
    boxFromTo([split, PORT.yBottom, u.zFront], [u.halfWidth, PORT.yTop, PORT.zFront]),
    boxFromTo([split, PORT.yBottom, PORT.zRear], [u.halfWidth, PORT.yTop, u.zRear]),
  );
  // Forward assist: housing and plunger behind the port.
  asm.add(metal, boxFromTo([0.012, 0.072, 0.018], [0.02, 0.09, 0.06]), cylZ(0.0065, 0.06, 0.075, 0.082, 0.017, 8));

  // Flat-top Picatinny rail with ridges, continuing along the quad rail.
  addRail(asm, u.zRear - 0.005, HANDGUARD.zFront + 0.005, u.yTop, 0.021, 0.0125);

  // Quad-rail handguard: octagonal body, side and bottom rails with a few ridges.
  const hg = HANDGUARD;
  asm.add(metal, cylZ(hg.radius, hg.zRear, hg.zFront, BORE_Y, 0, 8));
  const hgLen = hg.zRear - hg.zFront;
  const hgMid = (hg.zRear + hg.zFront) / 2;
  asm.add(
    metal,
    box([0.006, 0.014, hgLen], { pos: [hg.radius, BORE_Y, hgMid] }),
    box([0.006, 0.014, hgLen], { pos: [-hg.radius, BORE_Y, hgMid] }),
    box([0.014, 0.006, hgLen], { pos: [0, BORE_Y - hg.radius, hgMid] }),
  );
  for (let z = hg.zRear - 0.02; z > hg.zFront; z -= 0.04) {
    asm.add(
      metal,
      box([0.004, 0.018, 0.007], { pos: [hg.radius + 0.004, BORE_Y, z] }),
      box([0.004, 0.018, 0.007], { pos: [-hg.radius - 0.004, BORE_Y, z] }),
      box([0.018, 0.004, 0.007], { pos: [0, BORE_Y - hg.radius - 0.004, z] }),
    );
  }

  // Barrel, front sight base with triangular post housing, birdcage flash hider.
  asm.add(metal, cylZ(0.0085, hg.zFront, -0.51, BORE_Y, 0, 8));
  asm.add(metal, boxFromTo([-0.011, 0.058, -0.325], [0.011, 0.086, -0.29]));
  asm.add(metal, profile([[-0.29, 0.086], [-0.325, 0.086], [-0.312, 0.111], [-0.303, 0.111]], 0.014));
  asm.add(
    metal,
    boxFromTo([-0.009, 0.104, -0.311], [-0.005, 0.126, -0.304]),
    boxFromTo([0.005, 0.104, -0.311], [0.009, 0.126, -0.304]),
    boxFromTo([-0.0015, 0.104, -0.309], [0.0015, SIGHT_Y, -0.306]),
    boxFromTo([-0.004, 0.048, -0.32], [0.004, 0.058, -0.3]),
  );
  asm.add(metal, cylZ(0.009, -0.51, -0.514, BORE_Y, 0, 8), cylZ(0.0105, -0.514, MUZZLE_Z, BORE_Y, 0, 8));
  const interior = WM.interior();
  asm.add(
    interior,
    box([0.003, 0.0015, 0.024], { pos: [0, BORE_Y + 0.0105, -0.534] }),
    box([0.0015, 0.003, 0.024], { pos: [0.0105, BORE_Y + 0.003, -0.534] }),
    box([0.0015, 0.003, 0.024], { pos: [-0.0105, BORE_Y + 0.003, -0.534] }),
    cylZ(0.0045, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.002, BORE_Y, 0, 6),
  );

  // Flip-up rear sight with an aperture window.
  const rz = 0.068;
  asm.add(
    metal,
    boxFromTo([-0.011, RAIL_TOP, rz - 0.012], [0.011, RAIL_TOP + 0.008, rz + 0.012]),
    boxFromTo([-0.01, 0.107, rz - 0.003], [-0.006, 0.135, rz + 0.003]),
    boxFromTo([0.006, 0.107, rz - 0.003], [0.01, 0.135, rz + 0.003]),
    boxFromTo([-0.006, 0.131, rz - 0.003], [0.006, 0.135, rz + 0.003]),
    boxFromTo([-0.006, 0.107, rz - 0.003], [0.006, 0.111, rz + 0.003]),
  );

  // Buffer tube with castle nut and stock position notches, collapsible stock with butt pad.
  asm.add(metal, cylZ(0.0145, u.zRear, 0.255, 0.07, 0, 8), cylZ(0.017, u.zRear, u.zRear + 0.01, 0.07, 0, 8));
  for (let i = 0; i < 6; i++) asm.add(metal, box([0.006, 0.004, 0.004], { pos: [0, 0.0545, 0.115 + i * 0.01] }));
  asm.add(polymer, profile(STOCK_PROFILE, 0.04), boxFromTo([-0.021, -0.042, 0.28], [0.021, 0.098, 0.29]));
  asm.add(polymer, boxFromTo([-0.005, 0.024, 0.17], [0.005, 0.034, 0.2]));

  // Ejection port interior wall, visible when the bolt carrier is back.
  asm.add(interior, boxFromTo([split - 0.0005, PORT.yBottom, PORT.zFront], [split, PORT.yTop, PORT.zRear]));

  // --- Moving parts ---
  asm.node('bolt', [0.009, 0.07, -0.03]).add(WM.bolt(), boxFromTo([split, 0.06, -0.065], [0.0125, 0.08, 0.015]));
  asm.node('dustCover', [u.halfWidth + 0.0008, PORT.yBottom - 0.001, (PORT.zRear + PORT.zFront) / 2]).add(
    metal,
    boxFromTo([u.halfWidth, PORT.yBottom - 0.001, PORT.zFront - 0.002], [u.halfWidth + 0.0016, PORT.yTop + 0.001, PORT.zRear + 0.002]),
  );
  asm.node('chargingHandle', [0, 0.088, u.zRear]).add(
    metal,
    boxFromTo([-0.005, 0.084, u.zRear - 0.01], [0.005, 0.092, u.zRear + 0.012]),
    boxFromTo([-0.019, 0.083, u.zRear + 0.012], [0.019, 0.093, u.zRear + 0.02]),
  );
  asm.node('trigger', [0, 0.0, -0.012]).add(
    metal,
    box([0.005, 0.022, 0.005], { pos: [0, -0.012, -0.014], rot: [0.25, 0, 0] }),
  );
  asm.node('selector', [-0.0145, 0.03, 0.045]).add(
    metal,
    cyl(0.005, 0.003, { axis: 'x', pos: [-0.0145, 0.03, 0.045], segments: 6 }),
    boxFromTo([-0.017, 0.027, 0.03], [-0.015, 0.033, 0.047]),
  );
  asm.node('boltRelease', [-0.0145, 0.028, -0.03]).add(metal, boxFromTo([-0.018, 0.018, -0.042], [-0.0135, 0.034, -0.02]));
  asm.node('magazine', POINTS.magWell).add(
    metal,
    profile(MAG_PROFILE.map(([z, y]) => [z + POINTS.magWell[2], y + POINTS.magWell[1]] as V2), 0.022),
    boxFromTo([-0.0135, MAGWELL.yBottom - 0.137, -0.128], [0.0135, MAGWELL.yBottom - 0.128, -0.054]),
  );
}

/** Picatinny rail: base strip plus ridges every `pitch` meters from `zRear` to `zFront`. */
function addRail(asm: Assembly, zRear: number, zFront: number, yBase: number, width: number, pitch: number): void {
  const metal = WM.metal();
  asm.add(metal, boxFromTo([-width / 2, yBase, zFront], [width / 2, RAIL_TOP, zRear]));
  for (let z = zRear - pitch / 2; z > zFront; z -= pitch) {
    asm.add(metal, box([width, 0.003, pitch * 0.5], { pos: [0, RAIL_TOP + 0.0015, z] }));
  }
}

/** Third-person silhouette, under 300 triangles. */
function buildSimple(asm: Assembly): void {
  const metal = WM.metal();
  const polymer = WM.polymer();
  const u = UPPER;
  asm.add(metal, boxFromTo([-u.halfWidth, 0, u.zFront], [u.halfWidth, u.yTop + 0.005, u.zRear]));
  asm.add(metal, boxFromTo([-0.012, -0.045, MAGWELL.zFront], [0.012, 0, MAGWELL.zRear]));
  asm.add(metal, cyl(HANDGUARD.radius, HANDGUARD.zRear - HANDGUARD.zFront, { pos: [0, BORE_Y, (HANDGUARD.zRear + HANDGUARD.zFront) / 2], segments: 6 }));
  asm.add(metal, cylZ(0.009, HANDGUARD.zFront, MUZZLE_Z, BORE_Y, 0, 5));
  asm.add(metal, profile([[-0.29, 0.06], [-0.325, 0.06], [-0.312, 0.12], [-0.303, 0.12]], 0.012));
  asm.add(metal, boxFromTo([-0.008, RAIL_TOP, 0.055], [0.008, 0.13, 0.08]));
  asm.add(metal, cylZ(0.0145, u.zRear, 0.2, 0.07, 0, 5));
  asm.add(polymer, profile(GRIP_PROFILE, 0.026), profile(STOCK_PROFILE, 0.04));
  asm.node('magazine', POINTS.magWell).add(
    metal,
    profile(MAG_PROFILE.map(([z, y]) => [z + POINTS.magWell[2], y + POINTS.magWell[1]] as V2), 0.022),
  );
}
