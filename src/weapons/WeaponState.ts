import type { FireMode, WeaponDef } from '../data/weapons';
import { WEAPON_TIMING } from '../data/weaponTiming';

export type ReloadKind = 'tactical' | 'empty';
export type TriggerResult = 'fired' | 'dry' | null;

/** Ammo, fire rate and fire mode of one weapon. No rendering. */
export class WeaponState {
  /** Rounds in the magazine plus the chambered round. */
  mag: number;
  reserve: number;
  fireMode: FireMode;
  private cooldown = 0;

  constructor(readonly def: WeaponDef) {
    this.mag = def.magazine + def.chamber;
    this.reserve = def.startingReserve;
    this.fireMode = def.fireModes[0];
  }

  get shotInterval(): number {
    return 60 / this.def.rpm;
  }

  /**
   * Counts the cooldown down. It may go below zero by at most one frame, so the leftover time
   * carries into the next shot (exact RPM) without banking extra shots after a pause.
   */
  update(dt: number): void {
    this.cooldown = Math.max(this.cooldown - dt, -dt);
  }

  /**
   * Auto fires while held; semi fires on press only. An empty weapon clicks on press.
   */
  trigger(pressed: boolean, held: boolean): TriggerResult {
    if (this.cooldown > 0) return null;
    const wantsShot = this.fireMode === 'auto' ? held : pressed;
    if (!wantsShot) {
      this.cooldown = Math.max(this.cooldown, 0);
      return null;
    }
    if (this.mag === 0) {
      if (!pressed) return null;
      this.cooldown = WEAPON_TIMING.dryFireInterval;
      return 'dry';
    }
    this.mag--;
    this.cooldown += this.shotInterval;
    return 'fired';
  }

  get canReload(): boolean {
    return this.reserve > 0 && this.mag < this.def.magazine + this.def.chamber;
  }

  get reloadKind(): ReloadKind {
    return this.mag === 0 ? 'empty' : 'tactical';
  }

  reloadDuration(kind: ReloadKind): number {
    return this.def.reload[kind];
  }

  /** Adds rounds when the new magazine is seated. An empty reload has no round in the chamber. */
  applyReload(kind: ReloadKind): void {
    const capacity = kind === 'tactical' ? this.def.magazine + this.def.chamber : this.def.magazine;
    const take = Math.min(Math.max(0, capacity - this.mag), this.reserve);
    this.mag += take;
    this.reserve -= take;
  }

  /** Loads one shell (shell-by-shell reloads). The first shell into an empty gun goes straight into the chamber. */
  insertShell(): void {
    if (!this.canReload) return;
    this.mag++;
    this.reserve--;
  }

  /** Shells the next shell-by-shell reload will load. */
  get shellsToLoad(): number {
    return Math.min(this.def.magazine + this.def.chamber - this.mag, this.reserve);
  }

  /** Full magazine and starting reserve, e.g. on respawn. */
  refill(): void {
    this.mag = this.def.magazine + this.def.chamber;
    this.reserve = this.def.startingReserve;
    this.cooldown = 0;
  }

  /** Cycles to the next fire mode. Returns false for single-mode weapons. */
  toggleFireMode(): boolean {
    const modes = this.def.fireModes;
    if (modes.length < 2) return false;
    this.fireMode = modes[(modes.indexOf(this.fireMode) + 1) % modes.length];
    return true;
  }
}
