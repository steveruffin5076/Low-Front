import { FP_PALETTE, PALETTE, WEAPON_PALETTE } from '../../data/palette';
import { paletteMaterial } from '../../render/Materials';

/** Materials shared by all weapon models. */
export const WM = {
  metal: () => paletteMaterial(PALETTE.gunMetal, { roughness: 0.55, metalness: 0.35 }),
  polymer: () => paletteMaterial(PALETTE.polymerBlack, { roughness: 0.85 }),
  akWood: () => paletteMaterial(PALETTE.akWood, { roughness: 0.7 }),
  gripWood: () => paletteMaterial(PALETTE.m1911GripWood, { roughness: 0.7 }),
  bolt: () => paletteMaterial(WEAPON_PALETTE.boltSteel, { roughness: 0.4, metalness: 0.5 }),
  stockGreen: () => paletteMaterial(WEAPON_PALETTE.stockGreen, { roughness: 0.8 }),
  shellHull: () => paletteMaterial(WEAPON_PALETTE.shellHull, { roughness: 0.6 }),
  brass: () => paletteMaterial(FP_PALETTE.brass, { roughness: 0.35, metalness: 0.6 }),
  interior: () => paletteMaterial(WEAPON_PALETTE.interior, { roughness: 0.9 }),
};
