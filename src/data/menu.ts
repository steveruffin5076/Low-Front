import { PALETTE, UI_PALETTE } from './palette';

/** Menu, loading and quit screen settings. */
export const MENU = {
  title: 'LOW FRONT',
  subtitle: 'Tactical low-poly warfare',
  /** Wait this long after window.close() before showing the "you can close this tab" screen. */
  quitFallbackDelayMs: 300,
  /** Loading screen stays visible at least this long so it does not flash. */
  loadingMinMs: 400,
} as const;

/**
 * Placeholder city for the menu fly-over. Phase 5 replaces it with the real map.
 * Blocks sit on a grid; the center row and column are left empty as avenues.
 */
export const MENU_BACKDROP = {
  gridHalfCount: 5,
  blockSpacing: 26,
  footprints: [10, 14, 18, 12, 16] as const,
  floorPattern: [2, 4, 3, 6, 2, 5, 3, 4, 2] as const,
  floorHeight: 3,
  colors: [PALETTE.terracotta, PALETTE.teal, PALETTE.mustard, PALETTE.coral, PALETTE.mint, PALETTE.cream, PALETTE.slate] as const,
  groundSize: 420,
  groundColor: PALETTE.road,
  sidewalkColor: PALETTE.sidewalk,
  sidewalkMargin: 3,
  sky: UI_PALETTE.menuSky,
  fogNear: 90,
  fogFar: 260,
  camera: { fov: 55, near: 0.5, far: 600, orbitRadius: 95, height: 42, lookHeight: 4, orbitSpeed: 0.03 },
  hemi: { sky: 0xdff1ff, ground: PALETTE.road, intensity: 1.2 },
  sun: { color: 0xffffff, intensity: 2.0, position: [60, 100, 40] as const },
} as const;

/** 3D previews on the Profile & Loadout screen. */
export const PREVIEW = {
  maxPixelRatio: 2,
  hemi: { sky: 0xffffff, ground: 0x445566, intensity: 1.3 },
  key: { color: 0xffffff, intensity: 2.2, position: [2, 4, 3] as const },
  soldier: {
    fov: 30,
    cameraDistance: 5.6,
    cameraHeight: 1.2,
    lookHeight: 0.95,
    /** Radians per second while the mouse is not dragging. */
    autoRotateSpeed: 0.35,
    /** Radians per pixel of mouse drag. */
    dragSensitivity: 0.01,
    breathRate: 1.8,
    breathAmount: 0.012,
    swayAmount: 0.015,
  },
  weapon: {
    fov: 26,
    /** Extra space around the model when fitting the camera (1 = edge to edge). */
    fitMargin: 1.2,
    /** Camera looks slightly down at the weapon (radians). */
    cameraPitch: 0.25,
    /** The model sways around a right-side view by this angle (radians) at this speed (rad/s). */
    swayAngle: 0.6,
    swaySpeed: 0.8,
  },
} as const;
