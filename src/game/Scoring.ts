import { CONQUEST } from '../data/conquest';
import type { TeamId } from '../data/map/types';

/** One row of the scoreboard. */
export interface CombatantStats {
  id: string;
  name: string;
  team: TeamId;
  isPlayer: boolean;
  score: number;
  kills: number;
  deaths: number;
  headshots: number;
  captures: number;
}

export function newStats(id: string, name: string, team: TeamId, isPlayer: boolean): CombatantStats {
  return { id, name, team, isPlayer, score: 0, kills: 0, deaths: 0, headshots: 0, captures: 0 };
}

/** Points for a kill (plan section 11): 100, +25 for a headshot, +50 when defending an owned zone. */
export function killScore(headshot: boolean, defending: boolean): number {
  const s = CONQUEST.score;
  return s.kill + (headshot ? s.headshotBonus : 0) + (defending ? s.defendBonus : 0);
}

/** Sorted best first: score, then kills, then fewer deaths. */
export function ranked(rows: readonly CombatantStats[]): CombatantStats[] {
  return [...rows].sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
}
