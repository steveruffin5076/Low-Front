/**
 * Weapon stats (plan section 7.1). Spread and recoil are tuned to the plan's descriptions.
 * Display names are fictional (no real firearm names); the ids are internal and stay stable for saves.
 */

export type WeaponId = 'm4a1' | 'ak47' | 'sr9' | 'br12' | 'lr24' | 'm1911';
export type WeaponSlot = 'primary' | 'secondary';
export type FireMode = 'auto' | 'semi';
/** Role on the battlefield: drives bot use and the weapon card. */
export type WeaponClass = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'pistol';
/** The part that moves back and forward with each shot. */
export type CycleNode = 'bolt' | 'chargingHandle' | 'slide' | 'pump';
/** Swap a whole magazine, or load shells one at a time (can be stopped by firing). */
export type ReloadMode = 'magazine' | 'shell';

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
  /** After an empty magazine is seated: press the bolt release, rack the charging handle, drop the slide stop, or work the bolt by hand. */
  emptyReload: 'boltRelease' | 'rack' | 'slideStop' | 'bolt';
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
  /** Extra cone (deg) each pellet scatters around the aimed shot; 0 for single bullets. */
  pelletSpreadDeg: number;
  reloadMode: ReloadMode;
  /** Shell loading times (s) for `reloadMode: 'shell'`: lead-in, each shell, lead-out. */
  shellReload?: { start: number; perShell: number; end: number };
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
    name: 'VX-4',
    slot: 'primary',
    class: 'rifle',
    action: { cycleNode: 'bolt', locksOnEmpty: true, trigger: 'pivot', hammer: false, dustCover: true, emptyReload: 'boltRelease', manual: false },
    pellets: 1,
    pelletSpreadDeg: 0,
    reloadMode: 'magazine',
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
    name: 'KR-7',
    slot: 'primary',
    class: 'rifle',
    action: { cycleNode: 'chargingHandle', locksOnEmpty: false, trigger: 'pivot', hammer: false, dustCover: false, emptyReload: 'rack', manual: false },
    pellets: 1,
    pelletSpreadDeg: 0,
    reloadMode: 'magazine',
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
  sr9: {
    id: 'sr9',
    name: 'SR-9',
    slot: 'primary',
    class: 'smg',
    action: { cycleNode: 'bolt', locksOnEmpty: false, trigger: 'pivot', hammer: false, dustCover: false, emptyReload: 'rack', manual: false },
    pellets: 1,
    pelletSpreadDeg: 0,
    reloadMode: 'magazine',
    casing: [0.0045, 0.019],
    fireModes: ['auto', 'semi'],
    rpm: 800,
    damage: { near: 24, far: 16 },
    falloff: { start: 12, end: 35 },
    headshotMultiplier: 2.0,
    limbMultiplier: 0.75,
    magazine: 30,
    chamber: 1,
    startingReserve: 150,
    muzzleVelocity: 400,
    reload: { tactical: 2.0, empty: 2.6 },
    adsTime: 0.18,
    moveSpeedModifier: 1.0,
    spread: { hipDeg: 1.9, adsDeg: 0.16 },
    // Light, fast and controllable: wins the first moments of a room fight, fades past 30 m.
    recoil: { verticalDeg: 0.28, horizontalDeg: 0.1, pattern: [0.3, -0.4, 0.5, -0.2, 0.4], random: 0.5, recoveryDelay: 0.1, recoveryDegPerSec: 12 },
  },
  br12: {
    id: 'br12',
    name: 'BR-12',
    slot: 'primary',
    class: 'shotgun',
    action: { cycleNode: 'pump', locksOnEmpty: false, trigger: 'pivot', hammer: false, dustCover: false, emptyReload: 'rack', manual: true },
    pellets: 9,
    pelletSpreadDeg: 2.2,
    reloadMode: 'shell',
    shellReload: { start: 0.4, perShell: 0.5, end: 0.35 },
    casing: [0.0105, 0.068],
    fireModes: ['semi'],
    rpm: 70,
    damage: { near: 12, far: 4 },
    falloff: { start: 10, end: 25 },
    headshotMultiplier: 1.5,
    limbMultiplier: 0.75,
    magazine: 6,
    chamber: 1,
    startingReserve: 28,
    muzzleVelocity: 400,
    // Shown on cards and used by third-person timing; the real time depends on shells loaded.
    reload: { tactical: 2.25, empty: 3.75 },
    adsTime: 0.3,
    moveSpeedModifier: 0.95,
    spread: { hipDeg: 1.6, adsDeg: 0.6 },
    // One big shove per shot; the pump stroke gives time to recover.
    recoil: { verticalDeg: 2.6, horizontalDeg: 0.5, pattern: [0.4, -0.4], random: 0.6, recoveryDelay: 0.1, recoveryDegPerSec: 14 },
  },
  lr24: {
    id: 'lr24',
    name: 'LR-24',
    slot: 'primary',
    class: 'sniper',
    action: { cycleNode: 'bolt', locksOnEmpty: false, trigger: 'pivot', hammer: false, dustCover: false, emptyReload: 'bolt', manual: true },
    pellets: 1,
    pelletSpreadDeg: 0,
    reloadMode: 'magazine',
    casing: [0.006, 0.067],
    fireModes: ['semi'],
    // The bolt is worked between shots.
    rpm: 45,
    damage: { near: 88, far: 70 },
    falloff: { start: 50, end: 160 },
    headshotMultiplier: 2.0,
    limbMultiplier: 0.75,
    magazine: 5,
    chamber: 1,
    startingReserve: 25,
    muzzleVelocity: 850,
    reload: { tactical: 2.8, empty: 3.7 },
    adsTime: 0.55,
    moveSpeedModifier: 0.9,
    // Useless from the hip, pinpoint through the 6x scope.
    spread: { hipDeg: 6.0, adsDeg: 0.02 },
    recoil: { verticalDeg: 3.5, horizontalDeg: 0.6, pattern: [0.3, -0.3], random: 0.6, recoveryDelay: 0.15, recoveryDegPerSec: 10 },
  },
  m1911: {
    id: 'm1911',
    name: 'P-11',
    slot: 'secondary',
    class: 'pistol',
    action: { cycleNode: 'slide', locksOnEmpty: true, trigger: 'slide', hammer: true, dustCover: false, emptyReload: 'slideStop', manual: false },
    pellets: 1,
    pelletSpreadDeg: 0,
    reloadMode: 'magazine',
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
