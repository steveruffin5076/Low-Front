import { CONQUEST } from '../data/conquest';
import type { FlagId, MapData, SpawnDef, TeamId } from '../data/map/types';

/** Where a soldier can deploy: its HQ, or a flag its team owns. */
export type SpawnChoice = { kind: 'hq' } | { kind: 'flag'; flag: FlagId };

export function spawnLabel(c: SpawnChoice): string {
  return c.kind === 'hq' ? 'HQ' : c.flag;
}

/**
 * Spawn options and spawn points (plan section 10.5): HQ always; each flag the team owns (unless
 * an enemy is close to it), using its 6 spawn points. A point is skipped while someone stands on it.
 */
export class SpawnSystem {
  constructor(private readonly map: MapData) {}

  /** `enemies`: positions of living enemies; a flag with one within `spawnBlockRadius` is not offered. */
  options(team: TeamId, owners: Record<FlagId, TeamId | null>, enemies: readonly { x: number; z: number }[] = []): SpawnChoice[] {
    const out: SpawnChoice[] = [{ kind: 'hq' }];
    const r = CONQUEST.spawnBlockRadius;
    for (const f of this.map.flags) {
      if (owners[f.id] !== team) continue;
      if (enemies.some((e) => Math.hypot(e.x - f.x, e.z - f.z) < r)) continue;
      out.push({ kind: 'flag', flag: f.id });
    }
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
