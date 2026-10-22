import { CONQUEST } from '../data/conquest';
import type { FlagId, MapData, SpawnDef, TeamId } from '../data/map/types';

/** Where a soldier can deploy: its HQ, or a flag its team owns. */
export type SpawnChoice = { kind: 'hq' } | { kind: 'flag'; flag: FlagId };

export function spawnLabel(c: SpawnChoice): string {
  return c.kind === 'hq' ? 'HQ' : c.flag;
}

/**
 * Spawn options and spawn points (plan section 10.5): HQ always; each flag the team owns, using
 * its 6 spawn points. A point is skipped while someone stands on it.
 */
export class SpawnSystem {
  constructor(private readonly map: MapData) {}

  options(team: TeamId, owners: Record<FlagId, TeamId | null>): SpawnChoice[] {
    const out: SpawnChoice[] = [{ kind: 'hq' }];
    for (const f of this.map.flags) if (owners[f.id] === team) out.push({ kind: 'flag', flag: f.id });
    return out;
  }

  /** A free spawn point for `choice`; `taken` are positions of living soldiers. `pick` chooses among free points (0–1). */
  point(team: TeamId, choice: SpawnChoice, taken: readonly { x: number; z: number }[], pick = Math.random()): SpawnDef {
    const all = choice.kind === 'hq' ? this.map.hqs.find((h) => h.team === team)!.spawns : this.map.flagSpawns[choice.flag];
    const clear = CONQUEST.spawnClearance;
    const free = all.filter((s) => !taken.some((t) => Math.hypot(t.x - s.x, t.z - s.z) < clear));
    const list = free.length ? free : all;
    return list[Math.min(list.length - 1, Math.floor(pick * list.length))];
  }
}
