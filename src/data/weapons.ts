/** Weapon stats (plan section 7.1). Spread and recoil values are first estimates, tuned in Phase 4. */

export type WeaponId = 'm4a1' | 'ak47' | 'm1911';
export type WeaponSlot = 'primary' | 'secondary';
export type FireMode = 'auto' | 'semi';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: WeaponSlot;
  fireModes: readonly FireMode[];
  /** Rounds per minute (max rate for semi-only weapons). */
  rpm: number;
  damage: { near: number; far: number };
  /** Damage is `near` up to `start` meters, then falls linearly to `far` at `end` meters. */
  falloff: { start: number; end: number };
  headshotMultiplier: number;
  limbMultiplier: number;
  magazine: number;
  /** Extra round in the chamber after a tactical reload. */
  chamber: number;
  startingReserve: number;
  /** m/s */
  muzzleVelocity: number;
  /** Seconds. */
  reload: { tactical: number; empty: number };
  /** Seconds. */
  adsTime: number;
  moveSpeedModifier: number;
  /** Cone half-angle in degrees. */
  spread: { hipDeg: number; adsDeg: number };
  /** Camera kick per shot in degrees. */
  recoil: { verticalDeg: number; horizontalDeg: number };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  m4a1: {
    id: 'm4a1',
    name: 'M4A1',
    slot: 'primary',
    fireModes: ['auto', 'semi'],
    rpm: 750,
    damage: { near: 30, far: 22 },
    falloff: { start: 30, end: 75 },
    headshotMultiplier: 2.0,
    limbMultiplier: 0.75,
    magazine: 30,
    chamber: 1,
    startingReserve: 120,
    muzzleVelocity: 880,
    reload: { tactical: 2.2, empty: 2.9 },
    adsTime: 0.25,
    moveSpeedModifier: 0.95,
    spread: { hipDeg: 2.0, adsDeg: 0.1 },
    recoil: { verticalDeg: 0.35, horizontalDeg: 0.12 },
  },
  ak47: {
    id: 'ak47',
    name: 'AK47',
    slot: 'primary',
    fireModes: ['auto', 'semi'],
    rpm: 600,
    damage: { near: 36, far: 26 },
    falloff: { start: 25, end: 70 },
    headshotMultiplier: 2.0,
    limbMultiplier: 0.75,
    magazine: 30,
    chamber: 1,
    startingReserve: 120,
    muzzleVelocity: 715,
    reload: { tactical: 2.5, empty: 3.2 },
    adsTime: 0.28,
    moveSpeedModifier: 0.93,
    spread: { hipDeg: 2.4, adsDeg: 0.15 },
    recoil: { verticalDeg: 0.55, horizontalDeg: 0.25 },
  },
  m1911: {
    id: 'm1911',
    name: 'M1911',
    slot: 'secondary',
    fireModes: ['semi'],
    rpm: 400,
    damage: { near: 40, far: 28 },
    falloff: { start: 15, end: 40 },
    headshotMultiplier: 2.0,
    limbMultiplier: 0.75,
    magazine: 7,
    chamber: 1,
    startingReserve: 35,
    muzzleVelocity: 250,
    reload: { tactical: 1.6, empty: 1.9 },
    adsTime: 0.18,
    moveSpeedModifier: 1.0,
    spread: { hipDeg: 2.2, adsDeg: 0.2 },
    recoil: { verticalDeg: 0.9, horizontalDeg: 0.2 },
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export interface Loadout {
  primary: WeaponId;
  secondary: WeaponId;
}

export const DEFAULT_LOADOUT: Loadout = { primary: 'm4a1', secondary: 'm1911' };

/** Scales used to turn raw stats into 0–1 stat bars on weapon cards. */
export const STAT_BARS = {
  damageMax: 50,
  fireRateMax: 900,
  rangeMax: 100,
  /** Accuracy penalty = hip spread * w + vertical recoil * w + horizontal recoil * w. */
  accuracy: { hipSpreadWeight: 0.2, verticalRecoilWeight: 0.6, horizontalRecoilWeight: 1.0, worstPenalty: 1.6 },
  mobility: { speedMin: 0.85, speedMax: 1.0, adsTimeMin: 0.1, adsTimeMax: 0.4 },
} as const;
