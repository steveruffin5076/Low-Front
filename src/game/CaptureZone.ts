import { CONQUEST } from '../data/conquest';
import type { FlagDef, TeamId } from '../data/map/types';

export type CaptureEvent =
  | { kind: 'captured'; team: TeamId; by: string[] }
  /** `team` lost the flag; `by` are the soldiers who took it down to neutral. */
  | { kind: 'neutralized'; team: TeamId; by: string[] };

/** Someone inside or near a zone, as the zone sees them. */
export interface ZoneOccupant {
  id: string;
  team: TeamId;
  x: number;
  y: number;
  z: number;
}

export type ZoneState = 'idle' | 'capturing' | 'contested';

/**
 * One flag's capture state (plan section 11). `control` runs from −1 (Red owns) to +1 (Blue owns).
 * Soldiers inside the 12 m × 6 m cylinder push it toward their side at 1/10 per second each net
 * attacker (up to 3×); equal numbers stop it (contested). Reaching ±1 captures; an owned flag
 * pushed to 0 becomes neutral.
 */
export class CaptureZone {
  control = 0;
  owner: TeamId | null = null;
  state: ZoneState = 'idle';
  /** Who is inside, per team, as of the last update. */
  readonly inside: Record<TeamId, string[]> = { blue: [], red: [] };

  constructor(readonly flag: FlagDef) {}

  contains(o: { x: number; y: number; z: number }): boolean {
    const c = CONQUEST.capture;
    const dy = o.y - this.flag.y;
    return dy >= -0.5 && dy <= c.height && Math.hypot(o.x - this.flag.x, o.z - this.flag.z) <= c.radius;
  }

  /** Advances by `dt` with the given living soldiers; returns what happened. */
  update(dt: number, occupants: readonly ZoneOccupant[]): CaptureEvent[] {
    this.inside.blue = [];
    this.inside.red = [];
    for (const o of occupants) if (this.contains(o)) this.inside[o.team].push(o.id);
    const net = this.inside.blue.length - this.inside.red.length;
    const anyone = this.inside.blue.length + this.inside.red.length > 0;
    this.state = !anyone ? 'idle' : net === 0 ? 'contested' : this.atLimit(net) ? 'idle' : 'capturing';
    if (net === 0) return [];
    const c = CONQUEST.capture;
    const speed = Math.sign(net) * Math.min(Math.abs(net), c.maxSpeed);
    const before = this.control;
    this.control = Math.max(-1, Math.min(1, this.control + (speed * dt) / c.time));
    const events: CaptureEvent[] = [];
    const pushers = net > 0 ? this.inside.blue : this.inside.red;
    // Owned flag pushed to neutral.
    if (this.owner === 'red' && before < 0 && this.control >= 0) {
      events.push({ kind: 'neutralized', team: 'red', by: [...pushers] });
      this.owner = null;
    } else if (this.owner === 'blue' && before > 0 && this.control <= 0) {
      events.push({ kind: 'neutralized', team: 'blue', by: [...pushers] });
      this.owner = null;
    }
    if (this.owner === null && this.control >= 1) {
      this.owner = 'blue';
      events.push({ kind: 'captured', team: 'blue', by: [...pushers] });
    } else if (this.owner === null && this.control <= -1) {
      this.owner = 'red';
      events.push({ kind: 'captured', team: 'red', by: [...pushers] });
    }
    return events;
  }

  /** Signed progress toward the team pushing now: 0–1 of the current step (to neutral or to owned). */
  get progress(): number {
    return Math.abs(this.control);
  }

  private atLimit(net: number): boolean {
    return (net > 0 && this.control >= 1) || (net < 0 && this.control <= -1);
  }
}
