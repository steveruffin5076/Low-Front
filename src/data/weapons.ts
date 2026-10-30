/** Weapon stats (plan section 7.1). Spread and recoil are tuned to the plan's descriptions. */

export type WeaponId = 'm4a1' | 'ak47' | 'm1911';
export type WeaponSlot = 'primary' | 'secondary';
export type FireMode = 'auto' | 'semi';
/** Role on the battlefield: drives bot use and the weapon card. */
export type WeaponClass = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'pistol';
/** The part that moves back and forward with each shot. */
export type CycleNode = 'bolt' | 'chargingHandle' | 'slide' | 'pump';

/** How the weapon cycles and reloads; first-person animation and rules read this, not the id. */
export interface ActionDef {
  cycleNode: CycleNode;
  /** The bolt or slide stays back after the last round. */
  locksOnEmpty: boolean;
  /** Pistol triggers slide straight back (and have a hammer); rifle triggers pivot. */
  trigger: 'pivot' | 'slide';
  hammer: boolean;
  /** A dust cover that springs open on the first shot. */
  dustCover: boolean;
  /** After an empty magazine is seated: press the bolt release, rack the charging handle, or drop the slide stop. */
  emptyReload: 'boltRelease' | 'rack' | 'slideStop';
  /** The shooter works the action by hand after every shot (pump, bolt), taking the whole shot interval. */
  manual: boolean;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: WeaponSlot;
  class: WeaponClass;
  action: ActionDef;
  /** Projectiles per shot (shotguns fire several pellets; damage is per pellet). */
  pellets: number;
  /** Spent casing size: radius and length (m). */
  casing: readonly [number, number];
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
  /**
   * Camera kick per shot in degrees. `pattern` is the horizontal direction per shot (cycles),
   * `random` adds ± that fraction of `horizontalDeg`. After `recoveryDelay` seconds without
   * firing, the camera returns at `recoveryDegPerSec`.
   */
  recoil: {
    verticalDeg: number;
    horizontalDeg: number;
    pattern: readonly number[];
    random: number;
    recoveryDelay: number;
    recoveryDegPerSec: number;
  };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  m4a1: {
    id: 'm4a1',
    name: 'M4A1',
    slot: 'primary',
    class: 'rifle',
    action: { cycleNode: 'bolt', locksOnEmpty: true, trigger: 'pivot', hammer: false, dustCover: true, emptyReload: 'boltRelease', manual: false },
    pellets: 1,
    casing: [0.0048, 0.045],
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
    // Low vertical, low horizontal.
    recoil: { verticalDeg: 0.35, horizontalDeg: 0.12, pattern: [0.2, 0.5, -0.3, 0.6, -0.4, 0.3], random: 0.5, recoveryDelay: 0.12, recoveryDegPerSec: 10 },
  },
  ak47: {
    id: 'ak47',
    name: 'AK47',
    slot: 'primary',
    class: 'rifle',
    action: { cycleNode: 'chargingHandle', locksOnEmpty: false, trigger: 'pivot', hammer: false, dustCover: false, emptyReload: 'rack', manual: false },
    pellets: 1,
    casing: [0.0056, 0.039],
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
    // High vertical, medium horizontal, drifting right.
    recoil: { verticalDeg: 0.6, horizontalDeg: 0.3, pattern: [0.5, 0.8, 1.0, -0.6, 0.9, -0.8, 0.7], random: 0.6, recoveryDelay: 0.12, recoveryDegPerSec: 9 },
  },
  m1911: {
    id: 'm1911',
    name: 'M1911',
    slot: 'secondary',
    class: 'pistol',
    action: { cycleNode: 'slide', locksOnEmpty: true, trigger: 'slide', hammer: true, dustCover: false, emptyReload: 'slideStop', manual: false },
    pellets: 1,
    casing: [0.006, 0.023],
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
    // Medium vertical with a sharp snap that recovers fast.
    recoil: { verticalDeg: 1.4, horizontalDeg: 0.2, pattern: [0.3, -0.3], random: 0.5, recoveryDelay: 0.05, recoveryDegPerSec: 18 },
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
  /** Damage per trigger pull (all pellets, near) that fills the bar: a one-shot kill. */
  damageMax: 100,
  fireRateMax: 900,
  /** Falloff end that fills the Range bar (the sniper's). */
  rangeMax: 160,
  /**
   * Accuracy penalty = hip spread * w + aimed spread * w + recoil * w, with recoil scaled by
   * how fast it stacks (fire rate / `recoilRpm`, at most 1): a bolt-action's kick barely counts.
   */
  accuracy: { hipSpreadWeight: 0.05, adsSpreadWeight: 1.5, verticalRecoilWeight: 0.6, horizontalRecoilWeight: 1.0, recoilRpm: 600, worstPenalty: 2.2 },
  mobility: { speedMin: 0.85, speedMax: 1.0, adsTimeMin: 0.1, adsTimeMax: 0.4 },
} as const;
