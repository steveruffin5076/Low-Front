import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BotBrain, type BotQueries, type BotSenses, type FlagView } from '../src/ai/BotBrain';
import { BOTS } from '../src/data/bots';
import type { FlagId } from '../src/data/map/types';

const V = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, 0, z);
const FLAGS: FlagView[] = (
  [['A', -120, 120], ['B', 120, 120], ['C', 0, 0], ['D', -120, -120], ['E', 120, -120]] as [FlagId, number, number][]
).map(([id, x, z]) => ({ id, position: V(x, z), owner: null, control: 0, enemyCapturing: false }));

function senses(over: Partial<BotSenses> = {}): BotSenses {
  return {
    time: 10,
    team: 'blue',
    position: V(0, 160),
    hp: 100,
    magFraction: 1,
    activeSlot: 'primary',
    primaryEmpty: false,
    primaryOut: false,
    canReload: true,
    reloading: false,
    flags: FLAGS,
    teammatesGoing: {},
    enemy: null,
    lastKnown: null,
    stuck: false,
    resupplyAt: null,
    ...over,
  };
}

const queries = (cover: THREE.Vector3 | null = null): BotQueries => ({
  cover: () => (cover ? { pos: cover, high: true } : null),
  zoneSpot: (f) => FLAGS.find((x) => x.id === f)!.position.clone().add(V(2, 2)),
});
const noNoise = () => 0;

describe('bot brain: objectives', () => {
  it('heads for an untaken flag, sprinting', () => {
    const b = new BotBrain(noNoise);
    const o = b.decide(senses(), queries());
    expect(o.state).toBe('objective');
    expect(['A', 'B', 'C']).toContain(o.objective);
    expect(o.pace).toBe('sprint');
  });

  it('spreads a team across flags', () => {
    const counts: Partial<Record<FlagId, number>> = {};
    for (let i = 0; i < 15; i++) {
      const b = new BotBrain(noNoise);
      const o = b.decide(senses({ teammatesGoing: { ...counts } }), queries());
      counts[o.objective!] = (counts[o.objective!] ?? 0) + 1;
    }
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(7);
  });

  it('goes back to defend an owned flag under attack', () => {
    const flags = FLAGS.map((f) => (f.id === 'A' ? { ...f, owner: 'blue' as const, control: 0.6, enemyCapturing: true } : { ...f, owner: 'blue' as const, control: 1 }));
    const b = new BotBrain(noNoise);
    expect(b.decide(senses({ flags, position: V(0, 40) }), queries()).objective).toBe('A');
  });

  it('holds the zone once there, moving between spots', () => {
    const b = new BotBrain(noNoise);
    const o = b.decide(senses({ position: V(-118, 118), teammatesGoing: { B: 9, C: 9 } }), queries());
    expect(o.objective).toBe('A');
    expect(o.state).toBe('hold');
    expect(o.moveTo!.distanceTo(V(-118, 122))).toBeLessThan(1e-6);
  });

  it('gives up an objective after being stuck twice', () => {
    const b = new BotBrain(noNoise);
    const first = b.decide(senses(), queries()).objective;
    b.decide(senses({ stuck: true }), queries());
    const after = b.decide(senses({ stuck: true }), queries()).objective;
    expect(after).not.toBe(first);
  });
});

describe('bot brain: fighting', () => {
  const enemy = { id: 'r1', position: V(0, 100), distance: 30 };

  it('fights a visible enemy from nearby cover', () => {
    const b = new BotBrain(noNoise);
    const cover = V(3, 158);
    let o = b.decide(senses({ enemy }), queries(cover));
    expect(o.state).toBe('combat');
    expect(o.fireAt).toBe('r1');
    expect(o.moveTo).toBe(cover);
    expect(o.pace).toBe('walk');
    o = b.decide(senses({ enemy, position: cover.clone() }), queries(cover));
    expect(o.moveTo).toBeNull();
    expect(o.crouch).toBe(true);
  });

  it('strafes in the open when the enemy is close and there is no cover', () => {
    const b = new BotBrain(noNoise);
    const o = b.decide(senses({ enemy: { ...enemy, distance: 15 } }), queries(null));
    expect(o.moveTo).toBeNull();
    expect(Math.abs(o.strafe)).toBe(1);
  });

  it('closes in on a farther enemy in the open, and leaves cover after a while', () => {
    const b = new BotBrain(noNoise);
    expect(b.decide(senses({ enemy }), queries(null)).moveTo).toBe(enemy.position);
    const cover = V(4, 160);
    expect(b.decide(senses({ enemy, time: 1 }), queries(cover)).moveTo).toBe(cover);
    const at = senses({ enemy, time: 2, position: cover });
    expect(b.decide(at, queries(cover)).crouch).toBe(true);
    const later = b.decide({ ...at, time: 2 + BOTS.thresholds.coverHold.max + 0.1 }, queries(cover));
    expect(later.crouch).toBe(false);
    expect(later.moveTo).toBe(enemy.position);
  });

  it('runs to a crate when told to, but fights first if an enemy is in sight', () => {
    const b = new BotBrain(noNoise);
    const crate = V(5, 150);
    const o = b.decide(senses({ resupplyAt: crate, magFraction: 0 }), queries());
    expect(o.state).toBe('resupply');
    expect(o.moveTo).toBe(crate);
    expect(b.decide(senses({ resupplyAt: crate, enemy }), queries()).state).toBe('combat');
  });

  it('switches to the pistol with no primary ammo left, and stops trying to reload', () => {
    const b = new BotBrain(noNoise);
    expect(b.decide(senses({ enemy, primaryOut: true, primaryEmpty: true, magFraction: 0 }), queries()).switchTo).toBe('secondary');
    expect(b.decide(senses({ magFraction: 0, canReload: false }), queries()).state).not.toBe('reload');
  });

  it('retreats to cover away from the enemy when hurt', () => {
    const b = new BotBrain(noNoise);
    const away = V(0, 170);
    const o = b.decide(senses({ enemy, hp: BOTS.thresholds.retreatHp - 1 }), queries(away));
    expect(o.state).toBe('retreat');
    expect(o.moveTo).toBe(away);
    expect(o.fireAt).toBeNull();
  });

  it('switches to the pistol when the rifle is empty up close', () => {
    const b = new BotBrain(noNoise);
    const close = { ...enemy, distance: 8 };
    expect(b.decide(senses({ enemy: close, primaryEmpty: true, magFraction: 0 }), queries()).switchTo).toBe('secondary');
  });

  it('reloads behind cover when low and no enemy is in sight', () => {
    const b = new BotBrain(noNoise);
    const cover = V(4, 160);
    const o = b.decide(senses({ magFraction: 0.2 }), queries(cover));
    expect(o.state).toBe('reload');
    expect(o.reload).toBe(true);
    expect(o.moveTo).toBe(cover);
    // With an enemy in sight it fights instead.
    expect(b.decide(senses({ magFraction: 0.2, enemy }), queries(cover)).state).toBe('combat');
  });

  it('searches the last known position for up to 6 s, then returns to the objective', () => {
    const b = new BotBrain(noNoise);
    b.decide(senses({ enemy, time: 10 }), queries());
    const lastKnown = { position: V(0, 100), age: 1 };
    let o = b.decide(senses({ time: 11, lastKnown }), queries());
    expect(o.state).toBe('search');
    expect(o.moveTo).toBe(lastKnown.position);
    o = b.decide(senses({ time: 10 + BOTS.thresholds.searchTime + 0.1, lastKnown: { ...lastKnown, age: 3 } }), queries());
    expect(o.state).toBe('objective');
  });
});
