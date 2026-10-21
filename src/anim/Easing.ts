export type EaseName = 'linear' | 'in' | 'out' | 'inOut' | 'hold' | 'back';

/** Easing curves for keyframes. `t` is 0–1. */
export const EASE: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  /** Stays at the previous value until the key time (step). */
  hold: (t) => (t < 1 ? 0 : 1),
  /** Small overshoot, for a magazine "tap" or a slide slamming home. */
  back: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
};
