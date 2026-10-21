import { STAT_BARS, type WeaponDef } from '../data/weapons';

export type StatBarName = 'damage' | 'fireRate' | 'range' | 'accuracy' | 'mobility';

export const STAT_BAR_LABELS: Record<StatBarName, string> = {
  damage: 'Damage',
  fireRate: 'Fire Rate',
  range: 'Range',
  accuracy: 'Accuracy',
  mobility: 'Mobility',
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const norm = (v: number, min: number, max: number): number => clamp01((v - min) / (max - min));

/** Converts weapon stats into 0–1 values for the stat bars on weapon cards. */
export function statBars(w: WeaponDef): Record<StatBarName, number> {
  const a = STAT_BARS.accuracy;
  const m = STAT_BARS.mobility;
  const accuracyPenalty =
    w.spread.hipDeg * a.hipSpreadWeight +
    w.recoil.verticalDeg * a.verticalRecoilWeight +
    w.recoil.horizontalDeg * a.horizontalRecoilWeight;
  const speed = norm(w.moveSpeedModifier, m.speedMin, m.speedMax);
  const handling = 1 - norm(w.adsTime, m.adsTimeMin, m.adsTimeMax);
  return {
    damage: clamp01(w.damage.near / STAT_BARS.damageMax),
    fireRate: clamp01(w.rpm / STAT_BARS.fireRateMax),
    range: clamp01(w.falloff.end / STAT_BARS.rangeMax),
    accuracy: clamp01(1 - accuracyPenalty / a.worstPenalty),
    mobility: (speed + handling) / 2,
  };
}

/** e.g. "30 + 1" */
export function magazineLabel(w: WeaponDef): string {
  return w.chamber > 0 ? `${w.magazine} + ${w.chamber}` : `${w.magazine}`;
}
