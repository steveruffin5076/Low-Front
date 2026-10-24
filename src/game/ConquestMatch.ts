import { EventBus } from '../core/EventBus';
import { CONQUEST } from '../data/conquest';
import type { FlagId, MapData, TeamId } from '../data/map/types';
import { CaptureZone, type ZoneOccupant } from './CaptureZone';
import { matchResult, type MatchResult } from './MatchClock';
import { killScore, newStats, type CombatantStats } from './Scoring';
import { Tickets } from './Tickets';

/** A soldier taking part in the match: the player or a bot. */
export interface Combatant {
  readonly id: string;
  readonly name: string;
  readonly team: TeamId;
  readonly isPlayer: boolean;
  /** Feet position. */
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly alive: boolean;
  /** False for test targets that must not take flags. */
  readonly capturer?: boolean;
}

/** Why someone died when no enemy killed them. */
export type DeathCause = 'fall' | 'bounds' | 'hq' | 'suicide';

export interface DeathReport {
  victimId: string;
  killerId?: string;
  weapon?: string;
  headshot?: boolean;
  distance?: number;
  cause?: DeathCause;
}

export interface KillFeedEntry {
  killer: { id: string; name: string; team: TeamId } | null;
  victim: { id: string; name: string; team: TeamId };
  weapon: string;
  headshot: boolean;
  distance: number;
  cause?: DeathCause;
}

export interface MatchEvents {
  kill: KillFeedEntry;
  captured: { flag: FlagId; team: TeamId; by: string[] };
  neutralized: { flag: FlagId; team: TeamId; by: string[] };
  ended: MatchResult;
}

/**
 * A Conquest match (plan section 11): five capture zones, tickets with bleed, the 25-minute clock,
 * scores per combatant and the result. Pure logic: callers report positions (through the
 * combatants) and deaths; the match reports captures, kills and the end through `events`.
 */
export class ConquestMatch {
  readonly events = new EventBus<MatchEvents>();
  readonly zones: CaptureZone[];
  readonly tickets = new Tickets();
  readonly stats = new Map<string, CombatantStats>();
  elapsed = 0;
  result: MatchResult | null = null;
  private readonly combatants = new Map<string, Combatant>();
  private readonly occupants: ZoneOccupant[] = [];

  constructor(map: MapData, combatants: readonly Combatant[] = []) {
    this.zones = map.flags.map((f) => new CaptureZone(f));
    for (const c of combatants) this.add(c);
  }

  add(c: Combatant): void {
    this.combatants.set(c.id, c);
    if (!this.stats.has(c.id)) this.stats.set(c.id, newStats(c.id, c.name, c.team, c.isPlayer));
  }

  get timeLeft(): number {
    return Math.max(0, CONQUEST.timeLimit - this.elapsed);
  }

  owners(): Record<FlagId, TeamId | null> {
    return Object.fromEntries(this.zones.map((z) => [z.flag.id, z.owner])) as Record<FlagId, TeamId | null>;
  }

  held(): Record<TeamId, number> {
    const out: Record<TeamId, number> = { blue: 0, red: 0 };
    for (const z of this.zones) if (z.owner) out[z.owner]++;
    return out;
  }

  /** The zone `c` stands in, if any. */
  zoneOf(c: { x: number; y: number; z: number }): CaptureZone | null {
    return this.zones.find((z) => z.contains(c)) ?? null;
  }

  update(dt: number): void {
    if (this.result) return;
    this.elapsed += dt;
    this.occupants.length = 0;
    for (const c of this.combatants.values()) {
      if (c.alive && c.capturer !== false) this.occupants.push({ id: c.id, team: c.team, x: c.position.x, y: c.position.y, z: c.position.z });
    }
    const s = CONQUEST.score;
    for (const zone of this.zones) {
      for (const e of zone.update(dt, this.occupants)) {
        const points = e.kind === 'captured' ? s.capture : s.neutralize;
        for (const id of e.by) {
          const st = this.stats.get(id);
          if (!st) continue;
          st.score += points;
          if (e.kind === 'captured') st.captures++;
        }
        this.events.emit(e.kind, { flag: zone.flag.id, team: e.team, by: e.by });
      }
    }
    this.tickets.update(dt, this.held());
    this.checkEnd();
  }

  /** A combatant died: tickets, deaths, the killer's score (with headshot and defend bonuses) and the kill feed. */
  reportDeath(r: DeathReport): void {
    if (this.result) return;
    const victim = this.combatants.get(r.victimId);
    const vs = this.stats.get(r.victimId);
    if (!victim || !vs) return;
    vs.deaths++;
    this.tickets.death(victim.team);
    const killer = r.killerId ? this.combatants.get(r.killerId) : undefined;
    const ks = killer ? this.stats.get(killer.id) : undefined;
    if (killer && ks && killer.team !== victim.team) {
      const zone = this.zoneOf(victim.position);
      const defending = zone !== null && zone.owner === killer.team;
      ks.kills++;
      if (r.headshot) ks.headshots++;
      ks.score += killScore(r.headshot ?? false, defending);
    }
    this.events.emit('kill', {
      killer: killer && killer.id !== victim.id ? { id: killer.id, name: killer.name, team: killer.team } : null,
      victim: { id: victim.id, name: victim.name, team: victim.team },
      weapon: r.weapon ?? '',
      headshot: r.headshot ?? false,
      distance: r.distance ?? 0,
      cause: r.cause,
    });
    this.checkEnd();
  }

  /** Scoreboard rows for one team. */
  rows(team: TeamId): CombatantStats[] {
    return [...this.stats.values()].filter((s) => s.team === team);
  }

  private checkEnd(): void {
    const result = matchResult(this.tickets.count, this.elapsed);
    if (!result) return;
    this.result = result;
    this.events.emit('ended', result);
  }
}

