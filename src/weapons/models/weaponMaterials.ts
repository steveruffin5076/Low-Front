import { PALETTE, WEAPON_PALETTE } from '../../data/palette';
import { paletteMaterial } from '../../render/Materials';

/** Materials shared by all weapon models. */
export const WM = {
  metal: () => paletteMaterial(PALETTE.gunMetal, { roughness: 0.55, metalness: 0.35 }),
  polymer: () => paletteMaterial(PALETTE.polymerBlack, { roughness: 0.85 }),
  akWood: () => paletteMaterial(PALETTE.akWood, { roughness: 0.7 }),
  gripWood: () => paletteMaterial(PALETTE.m1911GripWood, { roughness: 0.7 }),
  bolt: () => paletteMaterial(WEAPON_PALETTE.boltSteel, { roughness: 0.4, metalness: 0.5 }),
  interior: () => paletteMaterial(WEAPON_PALETTE.interior, { roughness: 0.9 }),
};
