import type { Surface } from '../physics/collision';

/** Impact particles per surface (plan section 4: spark/dust per surface). Speeds m/s, life s, size m. */
export interface ImpactStyle {
  count: number;
  color: number;
  speed: number;
  life: number;
  size: number;
  gravity: number;
  /** 0 = straight along the surface normal, 1 = wide spray. */
  spread: number;
  decal: boolean;
}

export const IMPACTS: Record<Surface | 'flesh', ImpactStyle> = {
  metal: { count: 10, color: 0xffd27a, speed: 4.5, life: 0.25, size: 0.04, gravity: 9.8, spread: 0.9, decal: true },
  concrete: { count: 9, color: 0xbab3a6, speed: 2.2, life: 0.6, size: 0.07, gravity: 6, spread: 0.6, decal: true },
  dirt: { count: 9, color: 0x7a5a3a, speed: 2.4, life: 0.6, size: 0.08, gravity: 9.8, spread: 0.5, decal: true },
  wood: { count: 8, color: 0xc08a4a, speed: 2.6, life: 0.6, size: 0.06, gravity: 9.8, spread: 0.6, decal: true },
  flesh: { count: 8, color: 0xb3261e, speed: 1.6, life: 0.4, size: 0.07, gravity: 6, spread: 0.7, decal: false },
};

export const EFFECTS = {
  maxParticles: 256,
  maxDecals: 96,
  decalSize: 0.1,
  decalColor: 0x1b1c1e,
  decalOffset: 0.004,
  decalLife: 20,
  maxTracers: 32,
  tracerLength: 6,
  tracerWidth: 0.06,
  tracerColor: 0xffd27a,
  /** The tracer starts at the muzzle and joins the bullet's true path over this distance (m). */
  tracerConverge: 50,
  /** Tracers are drawn from this far out (m), so they never fill the screen next to the camera. */
  tracerStart: 3,
} as const;
