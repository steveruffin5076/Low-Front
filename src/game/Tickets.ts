import { CONQUEST } from '../data/conquest';
import type { TeamId } from '../data/map/types';

export const TEAMS: readonly TeamId[] = ['blue', 'red'];

export function enemyOf(team: TeamId): TeamId {
  return team === 'blue' ? 'red' : 'blue';
}

/** Seconds per bled ticket for a team holding `flags` flags, or null if it holds too few. */
export function bleedInterval(flags: number): number | null {
  for (const b of CONQUEST.bleed) if (flags >= b.flags) return b.interval;
  return null;
}

/**
 * Ticket counts (plan section 11): each death costs one; a team holding 3 or 4 flags drains the
 * enemy by 1 every 4 s, all 5 flags every 2 s. Counts never go below zero.
 */
export class Tickets {
  readonly count: Record<TeamId, number> = { blue: CONQUEST.startingTickets, red: CONQUEST.startingTickets };
  /** Time accumulated toward the next bled ticket, per bleeding team. */
  private readonly bleedClock: Record<TeamId, number> = { blue: 0, red: 0 };

  death(team: TeamId): void {
    this.count[team] = Math.max(0, this.count[team] - CONQUEST.deathTicketCost);
  }

  /** `held` = flags owned per team. Returns the tickets lost this step per team. */
  update(dt: number, held: Record<TeamId, number>): Record<TeamId, number> {
    const lost: Record<TeamId, number> = { blue: 0, red: 0 };
    for (const team of TEAMS) {
      const interval = bleedInterval(held[team]);
      if (interval === null) {
        this.bleedClock[team] = 0;
        continue;
      }
      this.bleedClock[team] += dt;
      while (this.bleedClock[team] >= interval) {
        this.bleedClock[team] -= interval;
        const enemy = enemyOf(team);
        if (this.count[enemy] > 0) {
          this.count[enemy]--;
          lost[enemy]++;
        }
      }
    }
    return lost;
  }
}
