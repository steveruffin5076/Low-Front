import { PROFILE } from '../data/player';
import { DEFAULT_LOADOUT, WEAPONS, type Loadout, type WeaponId, type WeaponSlot } from '../data/weapons';
import type { TeamId } from '../data/map/types';
import type { KeyValueStore } from './Storage';

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  headshots: number;
}

export interface Profile {
  name: string;
  stats: PlayerStats;
  loadout: Loadout;
  /** The team joined last time, picked again by default on the team screen. */
  team: TeamId;
}

export const EMPTY_STATS: PlayerStats = { matchesPlayed: 0, wins: 0, losses: 0, kills: 0, deaths: 0, headshots: 0 };

export type NameCheck = { ok: true; value: string } | { ok: false; error: string };

export function validateName(raw: string): NameCheck {
  const value = raw.trim();
  const { nameMinLength: min, nameMaxLength: max } = PROFILE;
  if (value.length < min || value.length > max) return { ok: false, error: `Name must be ${min}–${max} characters.` };
  return { ok: true, value };
}

/** Kills per death. With 0 deaths the ratio equals the kill count. */
export function kdRatio(stats: PlayerStats): number {
  return stats.kills / Math.max(stats.deaths, 1);
}

/** Adds one finished match to the saved stats: a win, a loss or neither (draw), plus kills, deaths and headshots. */
export function applyMatch(
  stats: PlayerStats,
  m: { won: boolean | null; kills: number; deaths: number; headshots: number },
): PlayerStats {
  return {
    matchesPlayed: stats.matchesPlayed + 1,
    wins: stats.wins + (m.won === true ? 1 : 0),
    losses: stats.losses + (m.won === false ? 1 : 0),
    kills: stats.kills + m.kills,
    deaths: stats.deaths + m.deaths,
    headshots: stats.headshots + m.headshots,
  };
}

export function defaultProfile(): Profile {
  return { name: PROFILE.defaultName, stats: { ...EMPTY_STATS }, loadout: { ...DEFAULT_LOADOUT }, team: 'blue' };
}

/** Loads and saves the profile as JSON. Bad or missing fields fall back to defaults. */
export class ProfileStore {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string = PROFILE.storageKey,
  ) {}

  load(): Profile {
    const profile = defaultProfile();
    let data: unknown;
    try {
      data = JSON.parse(this.store.getItem(this.key) ?? 'null');
    } catch {
      return profile;
    }
    if (!isObject(data)) return profile;

    if (typeof data.name === 'string') {
      const check = validateName(data.name);
      if (check.ok) profile.name = check.value;
    }
    if (isObject(data.stats)) {
      for (const k of Object.keys(EMPTY_STATS) as (keyof PlayerStats)[]) {
        const v = data.stats[k];
        if (typeof v === 'number' && Number.isInteger(v) && v >= 0) profile.stats[k] = v;
      }
    }
    if (isObject(data.loadout)) {
      profile.loadout.primary = weaponFor('primary', data.loadout.primary) ?? profile.loadout.primary;
      profile.loadout.secondary = weaponFor('secondary', data.loadout.secondary) ?? profile.loadout.secondary;
    }
    if (data.team === 'blue' || data.team === 'red') profile.team = data.team;
    return profile;
  }

  save(profile: Profile): void {
    this.store.setItem(this.key, JSON.stringify(profile));
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function weaponFor(slot: WeaponSlot, v: unknown): WeaponId | null {
  if (typeof v !== 'string' || !(v in WEAPONS)) return null;
  const id = v as WeaponId;
  return WEAPONS[id].slot === slot ? id : null;
}
