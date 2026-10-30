import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { FlagId, TeamId } from '../src/data/map/types';
import { RESUPPLY } from '../src/data/resupply';
import { WEAPONS } from '../src/data/weapons';
import { Health } from '../src/entities/Health';
import { kitNeedsResupply, ResupplySystem, resupplyKit, type Crate, type Resupplier } from '../src/game/Resupply';
import { PlayerWeapons } from '../src/weapons/PlayerWeapons';

const crates: Crate[] = [
  { flag: 'A', position: new THREE.Vector3(0, 0, 0) },
  { flag: 'B', position: new THREE.Vector3(100, 0, 0) },
];
const owners = (a: TeamId | null, b: TeamId | null = null) => ({ A: a, B: b, C: null, D: null, E: null }) as Record<FlagId, TeamId | null>;

function soldier(id: string, team: TeamId, x: number, needs = true): Resupplier & { position: THREE.Vector3 } {
  return { id, team, alive: true, position: new THREE.Vector3(x, 0, 0), needsResupply: () => needs };
}

describe('resupply crates', () => {
  it('works only for the team that owns the flag, within reach', () => {
    const r = new ResupplySystem(crates);
    expect(r.update(0, owners(null), [soldier('p', 'blue', 0.5)])).toHaveLength(0);
    expect(r.update(0, owners('red'), [soldier('p', 'blue', 0.5)])).toHaveLength(0);
    expect(r.update(0, owners('blue'), [soldier('p', 'blue', RESUPPLY.radius + 0.2)])).toHaveLength(0);
    expect(r.update(0, owners('blue'), [soldier('p', 'blue', 0.5)])).toHaveLength(1);
  });

  it('has a per-soldier cooldown across all crates, and a full soldier does not use it up', () => {
    const r = new ResupplySystem(crates);
    const own = owners('blue', 'blue');
    expect(r.update(0, own, [soldier('p', 'blue', 0)])).toHaveLength(1);
    // Same soldier at the other crate: still cooling down.
    expect(r.update(5, own, [soldier('p', 'blue', 100)])).toHaveLength(0);
    // Someone else is not affected.
    expect(r.update(5, own, [soldier('q', 'blue', 100)])).toHaveLength(1);
    expect(r.update(RESUPPLY.cooldown + 0.1, own, [soldier('p', 'blue', 100)])).toHaveLength(1);
    // Nothing missing: no resupply and no cooldown started.
    expect(r.update(0, own, [soldier('full', 'blue', 0, false)])).toHaveLength(0);
    expect(r.cooldownLeft('full', 0)).toBe(0);
    // A respawn clears the cooldown.
    r.reset('q');
    expect(r.cooldownLeft('q', 6)).toBe(0);
  });

  it('finds the nearest owned crate in range for bots', () => {
    const r = new ResupplySystem(crates);
    const from = new THREE.Vector3(80, 0, 0);
    expect(r.nearestOwned(from, 'blue', owners('blue', 'blue'), 60)?.flag).toBe('B');
    expect(r.nearestOwned(from, 'blue', owners('blue', 'red'), 60)).toBeNull();
    expect(r.nearestOwned(from, 'blue', owners('blue', 'red'), 100)?.flag).toBe('A');
  });

  it('refills every weapon and heals', () => {
    const kit = { weapons: new PlayerWeapons({ primary: 'm4a1', secondary: 'm1911' }), health: new Health() };
    kit.weapons.start();
    expect(kitNeedsResupply(kit)).toBe(false);
    const p = kit.weapons.weapons.primary;
    p.mag = 3;
    p.reserve = 0;
    kit.health.damage(60);
    expect(kitNeedsResupply(kit)).toBe(true);
    resupplyKit(kit);
    expect(p.mag).toBe(WEAPONS.m4a1.magazine + WEAPONS.m4a1.chamber);
    expect(p.reserve).toBe(WEAPONS.m4a1.startingReserve);
    expect(kit.health.hp).toBe(kit.health.max);
    expect(kitNeedsResupply(kit)).toBe(false);
  });
});
