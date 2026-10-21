import { PALETTE } from './palette';

/** Layout of the Phase 0 test scene. Units are meters. */
export const TEST_SCENE = {
  groundSize: 60,
  groundColor: PALETTE.grass,
  camera: { fov: 75, near: 0.1, far: 500, position: [8, 6, 12] as const, lookAt: [0, 1, 0] as const },
  fogNear: 40,
  fogFar: 160,
  sun: { color: 0xffffff, intensity: 2.2, position: [20, 30, 10] as const, shadowMapSize: 2048, shadowExtent: 30 },
  hemi: { sky: PALETTE.skyHorizon, ground: PALETTE.grass, intensity: 1.0 },
  staticBoxes: [
    { size: [2, 2, 2], position: [-4, 1, 0], color: PALETTE.terracotta },
    { size: [3, 1, 3], position: [4, 0.5, -2], color: PALETTE.teal },
    { size: [1, 4, 1], position: [0, 2, -6], color: PALETTE.mustard },
    { size: [6, 3, 0.5], position: [-2, 1.5, -10], color: PALETTE.cream },
  ] as const,
  fallingBox: { size: 1, startPosition: [0, 8, 0] as const, color: PALETTE.coral, spin: [1.5, 0.5, 2] as const },
  /** The falling box is reset when it drops below this height. */
  resetHeight: -10,
  /** Seconds between automatic drops of the test box. */
  dropInterval: 4,
  /** Orbit speed of the test camera (radians per second). */
  cameraOrbitSpeed: 0.1,
} as const;
