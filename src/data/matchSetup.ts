import { CONQUEST } from './conquest';
import type { Difficulty } from './bots';

/** Choices on the Match setup screen (Play vs Bots), saved in the profile. */
export type MapId = 'verdan' | 'harbor';
export type TeamSize = 4 | 8 | 16;

export interface MatchSetup {
  map: MapId;
  difficulty: Difficulty;
  /** Soldiers per side, the player included. */
  teamSize: TeamSize;
  /** Minutes. */
  timeLimit: number;
}

export const SETUP_MAPS: Record<MapId, { name: string; blurb: string }> = {
  verdan: { name: 'Verdan District', blurb: 'City blocks around a central square, five flags, two HQs. Close streets and long avenues.' },
  harbor: { name: 'Kessel Harbor', blurb: 'A dockyard: container lanes, warehouses and a crane yard in the middle. More open, longer sight lines.' },
};

export const SETUP_DIFFICULTIES: { id: Difficulty; name: string; blurb: string }[] = [
  { id: 'easy', name: 'Easy', blurb: 'Slow to react, loose aim.' },
  { id: 'normal', name: 'Normal', blurb: 'A fair fight.' },
  { id: 'hard', name: 'Hard', blurb: 'Quick and accurate.' },
];

/** Smaller teams start with fewer tickets, so a match still ends in about the same time. */
export const SETUP_TEAM_SIZES: { size: TeamSize; name: string; tickets: number }[] = [
  { size: 4, name: '4 vs 4', tickets: 150 },
  { size: 8, name: '8 vs 8', tickets: 250 },
  { size: 16, name: '16 vs 16', tickets: CONQUEST.startingTickets },
];

export const SETUP_TIME_LIMITS = [10, 15, 25] as const;

export const DEFAULT_SETUP: MatchSetup = { map: 'verdan', difficulty: 'normal', teamSize: 16, timeLimit: CONQUEST.timeLimit / 60 };

/** Ticket count and time limit (seconds) for a setup. */
export function matchRules(s: MatchSetup): { tickets: number; timeLimit: number } {
  const size = SETUP_TEAM_SIZES.find((t) => t.size === s.teamSize) ?? SETUP_TEAM_SIZES[SETUP_TEAM_SIZES.length - 1];
  return { tickets: size.tickets, timeLimit: s.timeLimit * 60 };
}

/** Keeps known values, falls back to the defaults for anything else (old or edited saves). */
export function validSetup(raw: unknown): MatchSetup {
  const out = { ...DEFAULT_SETUP };
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.map === 'string' && r.map in SETUP_MAPS) out.map = r.map as MapId;
  if (SETUP_DIFFICULTIES.some((d) => d.id === r.difficulty)) out.difficulty = r.difficulty as Difficulty;
  if (SETUP_TEAM_SIZES.some((t) => t.size === r.teamSize)) out.teamSize = r.teamSize as TeamSize;
  if ((SETUP_TIME_LIMITS as readonly unknown[]).includes(r.timeLimit)) out.timeLimit = r.timeLimit as number;
  return out;
}
