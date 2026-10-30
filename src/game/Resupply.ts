import * as THREE from 'three';
import { RESUPPLY } from '../data/resupply';
import type { FlagId, MapData, TeamId } from '../data/map/types';
import type { Health } from '../entities/Health';
import type { PlayerWeapons } from '../weapons/PlayerWeapons';
import type { NavGrid } from '../world/NavGrid';

/** A crate next to a flag: usable by the team that owns the flag. */
export interface Crate {
  readonly flag: FlagId;
  readonly position: THREE.Vector3;
}

/** Someone who can resupply: the player or a bot. */
export interface Resupplier {
  readonly id: string;
  readonly team: TeamId;
  readonly alive: boolean;
  readonly position: THREE.Vector3;
  /** Missing ammo or health; a full soldier walking past does not use up the cooldown. */
  needsResupply(): boolean;
}

/** A soldier's kit, as resupply sees it (the player's and every bot's are the same types). */
export interface Kit {
  weapons: PlayerWeapons;
  health: Health;
}

/** Any weapon short of a full magazine and starting reserve, or any health missing. */
export function kitNeedsResupply(k: Kit): boolean {
  if (k.health.hp < k.health.max) return true;
  return Object.values(k.weapons.weapons).some((w) => w.reserve < w.def.startingReserve || w.mag < w.def.magazine + w.def.chamber);
}

/** Full magazines, starting reserves and full health. */
export function resupplyKit(k: Kit): void {
  for (const w of Object.values(k.weapons.weapons)) w.refill();
  k.health.reset();
}

/** One crate per flag, on walkable ground about `RESUPPLY.offset` m from it. */
export function placeCrates(map: MapData, nav: NavGrid): Crate[] {
  return map.flags.map((f) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Vector3(f.x + Math.cos(a) * RESUPPLY.offset, f.y, f.z + Math.sin(a) * RESUPPLY.offset);
      const n = nav.nearestWalkable(p, 1.5);
      if (n !== null) return { flag: f.id, position: nav.position(n) };
    }
    return { flag: f.id, position: new THREE.Vector3(f.x, f.y, f.z) };
  });
}

/**
 * Resupply rules (pure logic): a soldier standing at a crate whose flag their team owns gets
 * full ammo and health, then waits `RESUPPLY.cooldown` before any crate works for them again.
 */
export class ResupplySystem {
  /** Soldier id → time their cooldown ends. */
  private readonly readyAt = new Map<string, number>();
  /** Resupplies so far (for tests and stats). */
  uses = 0;

  constructor(readonly crates: readonly Crate[]) {}

  /** Time until `id` can resupply again (0 = ready). */
  cooldownLeft(id: string, time: number): number {
    return Math.max(0, (this.readyAt.get(id) ?? -Infinity) - time);
  }

  /** The crate `s` stands at and may use right now, or null. */
  usable(s: Resupplier, owners: Readonly<Record<FlagId, TeamId | null>>, time: number): Crate | null {
    if (!s.alive || this.cooldownLeft(s.id, time) > 0) return null;
    for (const c of this.crates) {
      if (owners[c.flag] !== s.team) continue;
      const dx = c.position.x - s.position.x;
      const dz = c.position.z - s.position.z;
      if (dx * dx + dz * dz <= RESUPPLY.radius * RESUPPLY.radius && Math.abs(c.position.y - s.position.y) <= RESUPPLY.maxDy) return c;
    }
    return null;
  }

  /** Resupplies whoever stands at a usable crate and needs it; returns who did. */
  update(time: number, owners: Readonly<Record<FlagId, TeamId | null>>, soldiers: Iterable<Resupplier>): Resupplier[] {
    const done: Resupplier[] = [];
    for (const s of soldiers) {
      if (!this.usable(s, owners, time) || !s.needsResupply()) continue;
      this.readyAt.set(s.id, time + RESUPPLY.cooldown);
      this.uses++;
      done.push(s);
    }
    return done;
  }

  /** The nearest crate `team` owns within `range` of `from` (for bots), or null. */
  nearestOwned(from: THREE.Vector3, team: TeamId, owners: Readonly<Record<FlagId, TeamId | null>>, range: number): Crate | null {
    let best: Crate | null = null;
    let bestD = range;
    for (const c of this.crates) {
      if (owners[c.flag] !== team) continue;
      const d = c.position.distanceTo(from);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** New life: no cooldown carried over. */
  reset(id: string): void {
    this.readyAt.delete(id);
  }
}
