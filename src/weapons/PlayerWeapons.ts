import { EventBus } from '../core/EventBus';
import { WEAPONS, type FireMode, type Loadout, type WeaponSlot } from '../data/weapons';
import { WEAPON_TIMING } from '../data/weaponTiming';
import { WeaponState, type ReloadKind } from './WeaponState';

export interface WeaponEvents {
  fired: { weapon: WeaponState; lastRound: boolean };
  dryFire: { weapon: WeaponState };
  reloadStart: { weapon: WeaponState; kind: ReloadKind; duration: number; seatAt: number };
  reloadSeated: { weapon: WeaponState };
  reloadEnd: { weapon: WeaponState };
  reloadCancel: { weapon: WeaponState };
  holsterStart: { weapon: WeaponState; duration: number };
  drawStart: { weapon: WeaponState; duration: number };
  fireModeChanged: { weapon: WeaponState; mode: FireMode; duration: number };
  inspectStart: { weapon: WeaponState; duration: number };
  inspectEnd: { weapon: WeaponState };
}

export interface WeaponInput {
  firePressed: boolean;
  fireHeld: boolean;
  reloadPressed: boolean;
  /** Slot requested by 1/2 or the mouse wheel. */
  switchTo: WeaponSlot | null;
  fireModePressed: boolean;
  inspectPressed: boolean;
  /** False while sprinting or still blending out of sprint. */
  canFire: boolean;
  sprinting: boolean;
  ads: boolean;
}

type Action =
  | { kind: 'ready' }
  | { kind: 'reload'; type: ReloadKind; time: number; duration: number; seatAt: number; seated: boolean }
  | { kind: 'holster'; time: number; duration: number; next: WeaponSlot }
  | { kind: 'draw'; time: number; duration: number }
  | { kind: 'inspect'; time: number; duration: number }
  | { kind: 'fireMode'; time: number; duration: number };

export function seatTime(weapon: WeaponState): number {
  return weapon.def.reload.tactical * WEAPON_TIMING.magSeatFraction;
}

/** The player's two weapons and what they are doing: firing, reloading, switching, inspecting. */
export class PlayerWeapons {
  readonly events = new EventBus<WeaponEvents>();
  readonly weapons: Record<WeaponSlot, WeaponState>;
  private slot: WeaponSlot = 'primary';
  private action: Action = { kind: 'ready' };

  constructor(loadout: Loadout) {
    this.weapons = { primary: new WeaponState(WEAPONS[loadout.primary]), secondary: new WeaponState(WEAPONS[loadout.secondary]) };
  }

  get activeSlot(): WeaponSlot {
    return this.slot;
  }

  get active(): WeaponState {
    return this.weapons[this.slot];
  }

  get actionKind(): Action['kind'] {
    return this.action.kind;
  }

  /** Starts the match with the primary drawn. */
  start(): void {
    this.begin({ kind: 'draw', time: 0, duration: WEAPON_TIMING.draw[this.slot] });
    this.events.emit('drawStart', { weapon: this.active, duration: WEAPON_TIMING.draw[this.slot] });
  }

  update(dt: number, input: WeaponInput): void {
    for (const w of Object.values(this.weapons)) w.update(dt);
    const a = this.action;
    const weapon = this.active;

    // Requests that interrupt the current action.
    if (input.switchTo && input.switchTo !== this.slot && a.kind !== 'holster') {
      if (a.kind === 'reload' && a.seated) this.finishReload(a);
      else this.cancelCurrent();
      const duration = WEAPON_TIMING.holster[this.slot];
      this.begin({ kind: 'holster', time: 0, duration, next: input.switchTo });
      this.events.emit('holsterStart', { weapon, duration });
      return;
    }
    if (a.kind === 'reload' && !a.seated && input.sprinting) {
      this.cancelCurrent();
    }
    if (a.kind === 'inspect' && (input.firePressed || input.ads || input.reloadPressed || input.sprinting)) {
      this.cancelCurrent();
    }

    this.advance(dt);
    if (this.action.kind !== 'ready') return;

    if (input.reloadPressed && weapon.canReload && !input.sprinting) {
      const type = weapon.reloadKind;
      const duration = weapon.reloadDuration(type);
      const seatAt = seatTime(weapon);
      this.begin({ kind: 'reload', type, time: 0, duration, seatAt, seated: false });
      this.events.emit('reloadStart', { weapon, kind: type, duration, seatAt });
      return;
    }
    if (input.fireModePressed && weapon.toggleFireMode()) {
      const duration = WEAPON_TIMING.fireModeToggle;
      this.begin({ kind: 'fireMode', time: 0, duration });
      this.events.emit('fireModeChanged', { weapon, mode: weapon.fireMode, duration });
      return;
    }
    if (input.inspectPressed && !input.ads && !input.sprinting) {
      const duration = WEAPON_TIMING.inspect;
      this.begin({ kind: 'inspect', time: 0, duration });
      this.events.emit('inspectStart', { weapon, duration });
      return;
    }
    if (!input.canFire) return;
    const result = weapon.trigger(input.firePressed, input.fireHeld);
    if (result === 'fired') this.events.emit('fired', { weapon, lastRound: weapon.mag === 0 });
    else if (result === 'dry') this.events.emit('dryFire', { weapon });
  }

  private advance(dt: number): void {
    const a = this.action;
    if (a.kind === 'ready') return;
    a.time += dt;
    if (a.kind === 'reload' && !a.seated && a.time >= a.seatAt) {
      a.seated = true;
      this.active.applyReload(a.type);
      this.events.emit('reloadSeated', { weapon: this.active });
    }
    if (a.time < a.duration) return;

    switch (a.kind) {
      case 'reload':
        this.finishReload(a);
        break;
      case 'holster': {
        this.slot = a.next;
        const duration = WEAPON_TIMING.draw[this.slot];
        this.begin({ kind: 'draw', time: 0, duration });
        this.events.emit('drawStart', { weapon: this.active, duration });
        break;
      }
      case 'inspect':
        this.action = { kind: 'ready' };
        this.events.emit('inspectEnd', { weapon: this.active });
        break;
      default:
        this.action = { kind: 'ready' };
    }
  }

  /** Ends a reload whose magazine is already seated. */
  private finishReload(a: Extract<Action, { kind: 'reload' }>): void {
    if (!a.seated) throw new Error('Reload finished before the magazine was seated');
    this.action = { kind: 'ready' };
    this.events.emit('reloadEnd', { weapon: this.active });
  }

  private cancelCurrent(): void {
    const a = this.action;
    if (a.kind === 'reload') this.events.emit('reloadCancel', { weapon: this.active });
    if (a.kind === 'inspect') this.events.emit('inspectEnd', { weapon: this.active });
    this.action = { kind: 'ready' };
  }

  private begin(action: Action): void {
    this.action = action;
  }
}
