import type { HitZone } from '../data/ballistics';
import type { WeaponDef } from '../data/weapons';

/**
 * Damage at a distance (plan section 7.1): `near` up to the falloff start,
 * then linear to `far` at the falloff end, and `far` beyond.
 */
export function damageAt(def: WeaponDef, distance: number): number {
  const { start, end } = def.falloff;
  const { near, far } = def.damage;
  if (distance <= start) return near;
  if (distance >= end) return far;
  return near + ((far - near) * (distance - start)) / (end - start);
}

export function zoneMultiplier(def: WeaponDef, zone: HitZone): number {
  if (zone === 'head') return def.headshotMultiplier;
  if (zone === 'torso') return 1;
  return def.limbMultiplier;
}

export function hitDamage(def: WeaponDef, distance: number, zone: HitZone): number {
  return damageAt(def, distance) * zoneMultiplier(def, zone);
}
