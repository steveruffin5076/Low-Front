import { SPREAD } from '../data/ballistics';
import type { WeaponDef } from '../data/weapons';
import { approach } from '../entities/PlayerMovement';
import * as THREE from 'three';

export interface SpreadState {
  /** 0 hip → 1 fully aimed. */
  ads: number;
  /** Horizontal speed in m/s. */
  speed: number;
  grounded: boolean;
}

/** Cone half-angle in degrees: base (hip ↔ ADS) + movement + airborne + bloom from sustained fire. */
export class Spread {
  bloom = 0;

  constructor(private readonly def: WeaponDef) {}

  onShot(): void {
    this.bloom = Math.min(SPREAD.bloomMax, this.bloom + SPREAD.bloomPerShot);
  }

  update(dt: number): void {
    this.bloom = approach(this.bloom, 0, SPREAD.bloomRecovery * dt);
  }

  cone(s: SpreadState): number {
    const base = THREE.MathUtils.lerp(this.def.spread.hipDeg, this.def.spread.adsDeg, s.ads);
    const aimScale = (scale: number): number => THREE.MathUtils.lerp(1, scale, s.ads);
    const move = Math.min(SPREAD.moveMax, s.speed * SPREAD.movePerSpeed) * aimScale(SPREAD.adsMoveScale);
    const air = s.grounded ? 0 : SPREAD.air;
    return base + move + air + this.bloom * aimScale(SPREAD.adsBloomScale);
  }
}

/**
 * Random direction inside a cone of `coneDeg` around `forward` (uniform over the disc).
 * `rand` is injectable for tests.
 */
export function spreadDirection(
  forward: THREE.Vector3,
  coneDeg: number,
  out: THREE.Vector3,
  rand: () => number = Math.random,
): THREE.Vector3 {
  const r = Math.tan(THREE.MathUtils.degToRad(coneDeg)) * Math.sqrt(rand());
  const a = rand() * Math.PI * 2;
  const up = Math.abs(forward.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(right, forward).normalize();
  return out.copy(forward).addScaledVector(right, Math.cos(a) * r).addScaledVector(realUp, Math.sin(a) * r).normalize();
}
