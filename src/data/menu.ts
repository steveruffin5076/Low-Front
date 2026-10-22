
/** Menu, loading and quit screen settings. */
export const MENU = {
  title: 'LOW FRONT',
  subtitle: 'Tactical low-poly warfare',
  /** Wait this long after window.close() before showing the "you can close this tab" screen. */
  quitFallbackDelayMs: 300,
  /** Loading screen stays visible at least this long so it does not flash. */
  loadingMinMs: 400,
} as const;

/** Menu fly-over of the real map (plan section 5.1). */
export const MENU_BACKDROP = {
  camera: { fov: 55, near: 0.5, far: 700, orbitRadius: 150, height: 62, lookHeight: 0, orbitSpeed: 0.025, startAngle: 2.4 },
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
