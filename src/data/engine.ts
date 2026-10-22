/** Engine and loop tuning values. */
export const ENGINE = {
  /** Fixed physics/simulation rate (Hz). */
  fixedHz: 60,
  /** Max fixed steps per frame, prevents a spiral of death after a long stall. */
  maxStepsPerFrame: 5,
  /** Frame deltas above this (seconds) are clamped, e.g. after a tab switch. */
  maxFrameDelta: 0.25,
  /** Gravity (m/s²) on the Y axis. */
  gravityY: -9.81,
  /** How often the debug overlay refreshes its text (seconds). */
  debugRefreshInterval: 0.25,
  /** Max device pixel ratio used by the renderer. */
  maxPixelRatio: 2,
} as const;
