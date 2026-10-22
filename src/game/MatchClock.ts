import { CONQUEST } from '../data/conquest';
import type { TeamId } from '../data/map/types';

export type MatchResult = { winner: TeamId | null; reason: 'tickets' | 'time' };

/**
 * Match end rules (plan section 11): a team whose tickets reach 0 loses; when the 25-minute limit
 * runs out the team with more tickets wins, equal tickets is a draw (winner null).
 */
export function matchResult(tickets: Record<TeamId, number>, elapsed: number, limit: number = CONQUEST.timeLimit): MatchResult | null {
  if (tickets.blue <= 0 && tickets.red <= 0) return { winner: null, reason: 'tickets' };
  if (tickets.red <= 0) return { winner: 'blue', reason: 'tickets' };
  if (tickets.blue <= 0) return { winner: 'red', reason: 'tickets' };
  if (elapsed >= limit) {
    const winner = tickets.blue === tickets.red ? null : tickets.blue > tickets.red ? 'blue' : 'red';
    return { winner, reason: 'time' };
  }
  return null;
}

/** "mm:ss" of the time left. */
export function formatClock(secondsLeft: number): string {
  const s = Math.max(0, Math.ceil(secondsLeft));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
