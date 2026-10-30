import { describe, expect, it } from 'vitest';
import { CONQUEST } from '../src/data/conquest';
import { VERDAN } from '../src/data/map';
import { ConquestMatch, type Combatant } from '../src/game/ConquestMatch';
import { SpawnSystem } from '../src/game/SpawnSystem';
import { buildMap } from '../src/world/MapBuilder';
import { NavGrid } from '../src/world/NavGrid';

const flagA = VERDAN.flags.find((f) => f.id === 'A')!;

function standingOnA(): Combatant {
  return { id: 'b1', name: 'Bot', team: 'blue', isPlayer: false, alive: true, position: { x: flagA.x, y: 0, z: flagA.z } } as unknown as Combatant;
}

describe('pre-battle countdown', () => {
  it('holds the clock, captures and tickets until it ends, then starts the battle', () => {
    const m = new ConquestMatch(VERDAN, [standingOnA()]);
    m.startWarmup(CONQUEST.warmup);
    let started = 0;
    m.events.on('started', () => started++);
    const dt = 1 / 60;
    for (let t = 0; t < CONQUEST.warmup - 0.5; t += dt) m.update(dt);
    expect(m.inWarmup).toBe(true);
    expect(m.elapsed).toBe(0);
    expect(m.timeLeft).toBe(CONQUEST.timeLimit);
    expect(m.zones.find((z) => z.flag.id === 'A')!.control).toBe(0);
    expect(started).toBe(0);
    for (let t = 0; t < 1; t += dt) m.update(dt);
    expect(m.inWarmup).toBe(false);
    expect(started).toBe(1);
    for (let t = 0; t < 3; t += dt) m.update(dt);
    expect(m.elapsed).toBeGreaterThan(2);
    expect(m.zones.find((z) => z.flag.id === 'A')!.control).toBeGreaterThan(0);
  });
});

describe('HQ spawns', () => {
  const built = buildMap(VERDAN);
  const nav = new NavGrid(built.volumes, built.links, VERDAN.half);

  it('has 32 points per HQ, all inside the HQ and on walkable ground', () => {
    for (const hq of VERDAN.hqs) {
      expect(hq.spawns).toHaveLength(32);
      const r = hq.rect;
      for (const s of hq.spawns) {
        expect(s.x).toBeGreaterThan(Math.min(r.x0, r.x1));
        expect(s.x).toBeLessThan(Math.max(r.x0, r.x1));
        expect(s.z).toBeGreaterThan(Math.min(r.z0, r.z1));
        expect(s.z).toBeLessThan(Math.max(r.z0, r.z1));
        const n = nav.node(s.x, 0, s.z);
        expect(n !== null && nav.walkable(n), `${hq.team} ${s.x},${s.z}`).toBe(true);
      }
    }
  });

  it('gives all 16 soldiers of a side their own spot at the start', () => {
    const spawns = new SpawnSystem(VERDAN);
    for (const team of ['blue', 'red'] as const) {
      const taken: { x: number; z: number }[] = [];
      for (let i = 0; i < 16; i++) taken.push(spawns.point(team, { kind: 'hq' }, taken, (i * 0.37) % 1));
      for (let i = 0; i < taken.length; i++) {
        for (let j = i + 1; j < taken.length; j++) {
          expect(Math.hypot(taken[i].x - taken[j].x, taken[i].z - taken[j].z)).toBeGreaterThanOrEqual(CONQUEST.spawnClearance);
        }
      }
    }
  });
});
