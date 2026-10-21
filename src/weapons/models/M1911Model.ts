import { Assembly, box, boxFromTo, cyl, cylZ, profile, type V2, type V3 } from './ModelKit';
import type { AttachmentName, WeaponLod, WeaponModel } from './WeaponModel';
import { WM } from './weaponMaterials';

/*
 * M1911, ~0.22 m overall. Drawing coordinates: origin at the top of the grip,
 * muzzle along −Z. `Assembly.finish` re-centers on the grip.
 */
const BORE_Y = 0.031;
const SLIDE = { zRear: 0.028, zFront: -0.178, yBottom: 0.012, yTop: 0.044, halfWidth: 0.0118 };
const SIGHT_Y = 0.0495;
const MUZZLE_Z = -0.183;
/** Grip leans back about 9° from vertical; the beavertail overhangs the back strap. */
const GRIP_TILT = -0.16;

const POINTS: Record<AttachmentName, V3> = {
  muzzle: [0, BORE_Y, MUZZLE_Z],
  ejectionPort: [0.013, 0.037, -0.04],
  sightAnchor: [0, SIGHT_Y, 0.35],
  rightHandGrip: [0, -0.045, 0.022],
  leftHandGrip: [-0.018, -0.05, 0.014],
  magWell: [0, -0.1, 0.031],
};

const SLIDE_PROFILE: V2[] = [
  [0.026, SLIDE.yTop], [-0.174, SLIDE.yTop], [SLIDE.zFront, 0.04], [SLIDE.zFront, SLIDE.yBottom], [0.03, SLIDE.yBottom], [0.03, 0.03],
];
const FRAME_PROFILE: V2[] = [
  [0.026, SLIDE.yBottom], [-0.15, SLIDE.yBottom], [-0.152, 0.0], [-0.06, -0.002], [-0.055, -0.008], [0.0, -0.006], [0.026, -0.004],
];
const GRIP_PROFILE: V2[] = [[0.0, 0.0], [0.03, 0.0], [0.044, -0.098], [0.04, -0.102], [0.02, -0.102], [0.017, -0.098]];
const GRIP_PANEL: V2[] = [[0.006, -0.016], [0.03, -0.016], [0.04, -0.092], [0.02, -0.094]];
const TRIGGER_GUARD: V2[] = [[0.0, -0.004], [-0.058, -0.004], [-0.062, -0.012], [-0.054, -0.032], [-0.004, -0.034], [0.006, -0.026]];
const TRIGGER_GUARD_HOLE: V2[] = [[-0.004, -0.009], [-0.052, -0.009], [-0.05, -0.028], [-0.006, -0.029]];
const GRIP_SAFETY: V2[] = [[0.026, 0.012], [0.042, 0.018], [0.043, 0.012], [0.036, -0.004], [0.034, -0.026], [0.029, -0.02]];
/** Hammer at rest (uncocked), standing against the slide; relative to its pivot. Cocking rotates it back. */
const HAMMER: V2[] = [[-0.004, 0.0], [0.004, 0.0], [0.007, 0.02], [0.002, 0.026], [-0.004, 0.018]];
const HAMMER_PIVOT: V3 = [0, 0.016, 0.034];

export function buildM1911(lod: WeaponLod): WeaponModel {
  const asm = new Assembly(`m1911-${lod}`);
  asm.addPoints(POINTS);
  if (lod === 'fp') buildDetailed(asm);
  else buildSimple(asm);
  return asm.finish(lod);
}

function buildDetailed(asm: Assembly): void {
  const metal = WM.metal();
  const wood = WM.gripWood();
  const interior = WM.interior();
  const s = SLIDE;

  // Frame, trigger guard, grip frame, mainspring housing, grip safety (beavertail).
  asm.add(metal, profile(FRAME_PROFILE, 0.021), profile(TRIGGER_GUARD, 0.011, 0, [TRIGGER_GUARD_HOLE]));
  asm.add(metal, profile(GRIP_PROFILE, 0.024), profile(GRIP_SAFETY, 0.018));
  asm.add(metal, box([0.02, 0.06, 0.006], { pos: [0, -0.068, 0.034], rot: [GRIP_TILT, 0, 0] }));
  // Slide stop pin end on the right side, thumb safety on the left.
  asm.add(metal, cyl(0.0028, 0.002, { axis: 'x', pos: [0.0115, 0.008, -0.052], segments: 6 }));
  asm.add(metal, boxFromTo([-0.0135, 0.008, 0.002], [-0.0115, 0.016, 0.024]), boxFromTo([-0.016, 0.012, 0.0], [-0.0115, 0.015, 0.008]));

  // Wood grip panels with raised diamonds around the screws, both sides.
  for (const side of [1, -1]) {
    asm.add(wood, profile(GRIP_PANEL, 0.003, side * 0.0135));
    for (const [z, y] of [[0.0205, -0.032], [0.028, -0.08]] as const) {
      asm.add(wood, box([0.0015, 0.013, 0.013], { pos: [side * 0.0155, y, z], rot: [Math.PI / 4 + GRIP_TILT, 0, 0] }));
      asm.add(metal, cyl(0.0025, 0.0012, { axis: 'x', pos: [side * 0.0167, y, z], segments: 6 }));
    }
  }

  // --- Moving parts ---
  const slide = asm.node('slide', [0, BORE_Y, (s.zRear + s.zFront) / 2]);
  slide.add(metal, profile(SLIDE_PROFILE, s.halfWidth * 2));
  // Rear cocking serrations on both sides.
  for (let i = 0; i < 7; i++) {
    const z = 0.0 + i * 0.0035;
    for (const side of [1, -1]) slide.add(interior, box([0.001, 0.026, 0.0016], { pos: [side * s.halfWidth, 0.029, z] }));
  }
  // Ejection port and extractor on the right.
  slide.add(interior, boxFromTo([s.halfWidth - 0.0004, 0.032, -0.065], [s.halfWidth + 0.0004, s.yTop - 0.002, -0.025]));
  slide.add(metal, boxFromTo([s.halfWidth, 0.036, -0.022], [s.halfWidth + 0.001, 0.04, 0.01]));
  // Barrel bushing, bore, recoil spring plug.
  slide.add(metal, cylZ(0.0095, s.zFront, s.zFront - 0.005, BORE_Y, 0, 10), cylZ(0.0055, s.zFront, s.zFront - 0.004, 0.0175, 0, 8));
  slide.add(interior, cylZ(0.0045, s.zFront - 0.0045, s.zFront - 0.006, BORE_Y, 0, 8));
  // Front blade sight, rear notch sight.
  slide.add(metal, boxFromTo([-0.0015, s.yTop, -0.17], [0.0015, SIGHT_Y + 0.0005, -0.162]));
  slide.add(
    metal,
    boxFromTo([-0.008, s.yTop, 0.012], [0.008, s.yTop + 0.002, 0.02]),
    boxFromTo([-0.008, s.yTop, 0.014], [-0.0015, SIGHT_Y + 0.001, 0.02]),
    boxFromTo([0.0015, s.yTop, 0.014], [0.008, SIGHT_Y + 0.001, 0.02]),
  );

  asm.node('hammer', HAMMER_PIVOT).add(
    metal,
    profile(HAMMER.map(([z, y]) => [z + HAMMER_PIVOT[2], y + HAMMER_PIVOT[1]] as V2), 0.007),
    cyl(0.005, 0.008, { axis: 'x', pos: HAMMER_PIVOT, segments: 8 }),
  );
  asm.node('trigger', [0, -0.006, -0.022]).add(metal, boxFromTo([-0.004, -0.02, -0.026], [0.004, -0.004, -0.02]));
  asm.node('slideStop', [-0.0125, 0.008, -0.052]).add(
    metal,
    cyl(0.003, 0.002, { axis: 'x', pos: [-0.0125, 0.008, -0.052], segments: 6 }),
    boxFromTo([-0.0135, 0.006, -0.052], [-0.0115, 0.014, -0.022]),
    boxFromTo([-0.016, 0.009, -0.03], [-0.0115, 0.016, -0.02]),
  );
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(
    metal,
    box([0.019, 0.09, 0.024], { pos: [0, -0.055, 0.024], rot: [GRIP_TILT, 0, 0] }),
    box([0.022, 0.006, 0.026], { pos: [0, mw[1] - 0.004, mw[2]] }),
  );
}

/** Third-person silhouette, under 300 triangles. */
function buildSimple(asm: Assembly): void {
  const metal = WM.metal();
  asm.add(metal, profile(FRAME_PROFILE, 0.021), profile(GRIP_PROFILE, 0.024), profile(TRIGGER_GUARD, 0.011));
  asm.add(WM.gripWood(), profile(GRIP_PANEL, 0.028));
  asm.node('slide', [0, BORE_Y, (SLIDE.zRear + SLIDE.zFront) / 2]).add(metal, profile(SLIDE_PROFILE, SLIDE.halfWidth * 2));
  const mw = POINTS.magWell;
  asm.node('magazine', mw).add(metal, box([0.022, 0.006, 0.026], { pos: [0, mw[1] - 0.004, mw[2]] }));
}
