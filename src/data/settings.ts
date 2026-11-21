/** Player settings from the Pause Menu (plan section 11.4), saved in localStorage. */
export const SETTINGS = {
  storageKey: 'lowfront.settings.v1',
  /** Multiplier on the base mouse sensitivity. */
  sensitivity: { min: 0.2, max: 3, step: 0.05, default: 1 },
  /** Hip-fire field of view in degrees. */
  fov: { min: 60, max: 100, step: 1, default: 75 },
  /** Camera shake when hit, 0 (off) to 1 (full). */
  shake: { min: 0, max: 1, step: 0.05, default: 1 },
  /** Master volume 0–1. */
  volume: { min: 0, max: 1, step: 0.05, default: 0.8 },
} as const;
