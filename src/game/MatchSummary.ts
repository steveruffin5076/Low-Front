import type { TeamId } from '../data/map/types';
import type { ConquestMatch } from './ConquestMatch';
import type { MatchResult } from './MatchClock';
import { ranked, type CombatantStats } from './Scoring';

/** What the End Screen shows (plan section 11.5). */
export interface MatchSummary {
  result: MatchResult;
  tickets: Record<TeamId, number>;
  /** Top 3 per team by score. */
  top: Record<TeamId, CombatantStats[]>;
  player: CombatantStats;
}

export function summarize(match: ConquestMatch, result: MatchResult, playerId: string): MatchSummary {
  return {
    result,
    tickets: { ...match.tickets.count },
    top: { blue: ranked(match.rows('blue')).slice(0, 3), red: ranked(match.rows('red')).slice(0, 3) },
    player: { ...match.stats.get(playerId)! },
  };
}
