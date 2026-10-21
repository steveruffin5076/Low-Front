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
  metal: { count: 8, color: 0xffd27a, speed: 4.5, life: 0.22, size: 0.018, gravity: 9.8, spread: 0.9, decal: true },
  concrete: { count: 6, color: 0xbab3a6, speed: 2.2, life: 0.5, size: 0.035, gravity: 6, spread: 0.6, decal: true },
  dirt: { count: 7, color: 0x7a5a3a, speed: 2.4, life: 0.55, size: 0.04, gravity: 9.8, spread: 0.5, decal: true },
  wood: { count: 5, color: 0xc08a4a, speed: 2.6, life: 0.5, size: 0.03, gravity: 9.8, spread: 0.6, decal: true },
  flesh: { count: 6, color: 0xb3261e, speed: 1.6, life: 0.35, size: 0.035, gravity: 6, spread: 0.7, decal: false },
};

export const EFFECTS = {
  maxParticles: 256,
  maxDecals: 96,
  decalSize: 0.05,
  decalColor: 0x1b1c1e,
  decalOffset: 0.004,
  decalLife: 20,
  maxTracers: 32,
  tracerLength: 4,
  tracerWidth: 0.025,
  tracerColor: 0xffd27a,
  /** The tracer starts at the muzzle and joins the bullet's true path over this distance (m). */
  tracerConverge: 15,
} as const;
