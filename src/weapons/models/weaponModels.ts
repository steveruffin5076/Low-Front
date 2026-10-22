import type { WeaponId } from '../../data/weapons';
import { buildAK47 } from './AK47Model';
import { buildM1911 } from './M1911Model';
import { buildM4A1 } from './M4A1Model';
import type { NodeName, WeaponLod, WeaponModel } from './WeaponModel';

const BUILDERS: Record<WeaponId, (lod: WeaponLod) => WeaponModel> = {
  m4a1: buildM4A1,
  ak47: buildAK47,
  m1911: buildM1911,
};

/** Required moving parts per weapon for the first-person model (plan section 7.2). */
export const REQUIRED_NODES: Record<WeaponId, readonly NodeName[]> = {
  m4a1: ['magazine', 'bolt', 'chargingHandle', 'trigger', 'selector', 'dustCover', 'boltRelease'],
  ak47: ['magazine', 'chargingHandle', 'trigger', 'selector'],
  m1911: ['magazine', 'slide', 'hammer', 'trigger', 'slideStop'],
};

/** Real-world overall length in meters, used by tests. */
export const OVERALL_LENGTH: Record<WeaponId, number> = { m4a1: 0.84, ak47: 0.88, m1911: 0.22 };

export function buildWeaponModel(id: WeaponId, lod: WeaponLod): WeaponModel {
  return BUILDERS[id](lod);
}
