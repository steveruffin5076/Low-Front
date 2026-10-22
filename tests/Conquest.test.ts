import { describe, expect, it } from 'vitest';
import { CONQUEST } from '../src/data/conquest';
import { VERDAN } from '../src/data/map';
import type { FlagDef, TeamId } from '../src/data/map/types';
import { CaptureZone, type ZoneOccupant } from '../src/game/CaptureZone';
import { ConquestMatch, type Combatant } from '../src/game/ConquestMatch';
import { HQZone } from '../src/game/HQZone';
import { formatClock, matchResult } from '../src/game/MatchClock';
import { SpawnSystem } from '../src/game/SpawnSystem';
import { bleedInterval, Tickets } from '../src/game/Tickets';

const DT = 0.1;
const FLAG: FlagDef = { id: 'C', name: 'City Hall Plaza', x: 0, z: 0, y: 0 };
const at = (id: string, team: TeamId, x = 0, z = 0, y = 0): ZoneOccupant => ({ id, team, x, y, z });

function run(zone: CaptureZone, seconds: number, occ: ZoneOccupant[]): ReturnType<CaptureZone['update']> {
  const events: ReturnType<CaptureZone['update']> = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) events.push(...zone.update(DT, occ));
  return events;
}

describe('capture zone', () => {
  it('captures a neutral flag in 10 s with one soldier, faster with more, at most 3×', () => {
    const one = new CaptureZone(FLAG);
    expect(run(one, 9.9, [at('a', 'blue')])).toHaveLength(0);
    expect(run(one, 0.1, [at('a', 'blue')])).toEqual([{ kind: 'captured', team: 'blue', by: ['a'] }]);
    const two = new CaptureZone(FLAG);
    run(two, 5, [at('a', 'blue'), at('b', 'blue')]);
    expect(two.owner).toBe('blue');
    const four = new CaptureZone(FLAG);
    run(four, 10 / 3 - 0.05, ['a', 'b', 'c', 'd'].map((id) => at(id, 'red')));
    expect(four.owner).toBeNull();
    run(four, 0.1, ['a', 'b', 'c', 'd'].map((id) => at(id, 'red')));
    expect(four.owner).toBe('red');
  });

  it('stops while contested and uses attackers minus defenders', () => {
    const z = new CaptureZone(FLAG);
    run(z, 5, [at('a', 'blue'), at('b', 'red')]);
    expect(z.control).toBe(0);
    expect(z.state).toBe('contested');
    run(z, 5, [at('a', 'blue'), at('b', 'blue'), at('c', 'red')]);
    expect(z.control).toBeCloseTo(0.5, 5);
    expect(z.state).toBe('capturing');
  });

  it('neutralizes an enemy flag in 10 s, then captures it in another 10 s', () => {
    const z = new CaptureZone(FLAG);
    run(z, 10, [at('r', 'red')]);
    expect(z.owner).toBe('red');
    const neutral = run(z, 10, [at('b', 'blue')]);
    expect(neutral).toEqual([{ kind: 'neutralized', team: 'red', by: ['b'] }]);
    expect(z.owner).toBeNull();
    const taken = run(z, 10, [at('b', 'blue')]);
    expect(taken).toEqual([{ kind: 'captured', team: 'blue', by: ['b'] }]);
  });

  it('keeps progress when the zone empties, and only counts the 12 m × 6 m cylinder', () => {
    const z = new CaptureZone(FLAG);
    run(z, 4, [at('a', 'blue')]);
    run(z, 5, []);
    expect(z.control).toBeCloseTo(0.4, 5);
    expect(z.contains(at('x', 'blue', 11.9, 0))).toBe(true);
    expect(z.contains(at('x', 'blue', 12.1, 0))).toBe(false);
    expect(z.contains(at('x', 'blue', 0, 0, CONQUEST.capture.height - 0.1))).toBe(true);
    expect(z.contains(at('x', 'blue', 0, 0, CONQUEST.capture.height + 0.5))).toBe(false);
  });
});

describe('tickets and the end of the match', () => {
  it('bleeds 1 every 4 s for 3–4 flags, every 2 s for all 5, none below 3', () => {
    expect(bleedInterval(2)).toBeNull();
    expect(bleedInterval(3)).toBe(4);
    expect(bleedInterval(4)).toBe(4);
    expect(bleedInterval(5)).toBe(2);
    const t = new Tickets();
    for (let i = 0; i < 400; i++) t.update(0.1, { blue: 3, red: 2 });
    expect(t.count.red).toBe(CONQUEST.startingTickets - 10);
    expect(t.count.blue).toBe(CONQUEST.startingTickets);
    for (let i = 0; i < 400; i++) t.update(0.1, { blue: 5, red: 0 });
    expect(t.count.red).toBe(CONQUEST.startingTickets - 30);
  });

  it('costs one ticket per death and never goes below zero', () => {
    const t = new Tickets();
    t.death('blue');
    expect(t.count.blue).toBe(CONQUEST.startingTickets - 1);
    t.count.red = 0;
    t.death('red');
    expect(t.count.red).toBe(0);
  });

  it('ends on zero tickets, or on time with the most tickets, or a draw', () => {
    expect(matchResult({ blue: 10, red: 0 }, 60)).toEqual({ winner: 'blue', reason: 'tickets' });
    expect(matchResult({ blue: 0, red: 5 }, 60)).toEqual({ winner: 'red', reason: 'tickets' });
    expect(matchResult({ blue: 10, red: 5 }, 60)).toBeNull();
    expect(matchResult({ blue: 10, red: 5 }, CONQUEST.timeLimit)).toEqual({ winner: 'blue', reason: 'time' });
    expect(matchResult({ blue: 7, red: 7 }, CONQUEST.timeLimit)).toEqual({ winner: null, reason: 'time' });
    expect(formatClock(CONQUEST.timeLimit)).toBe('25:00');
    expect(formatClock(61.2)).toBe('1:02');
  });
});

/** A movable test combatant. */
class Dummy implements Combatant {
  position = { x: 0, y: 0, z: 0 };
  alive = true;
  constructor(
    readonly id: string,
    readonly team: TeamId,
    readonly isPlayer = false,
    readonly name = id,
  ) {}
  moveTo(x: number, z: number, y = 0): void {
    this.position = { x, y, z };
  }
}

describe('scoring', () => {
  it('scores kills, headshots, defend kills, captures and neutralizes', () => {
    const blue = new Dummy('p', 'blue', true);
    const red = new Dummy('r', 'red');
    const m = new ConquestMatch(VERDAN, [blue, red]);
    const c = VERDAN.flags.find((f) => f.id === 'C')!;
    blue.moveTo(c.x, c.z);
    red.moveTo(300, 300);
    for (let i = 0; i < 101; i++) m.update(DT);
    const ps = m.stats.get('p')!;
    expect(ps.captures).toBe(1);
    expect(ps.score).toBe(CONQUEST.score.capture);
    // A headshot kill on an enemy inside our own flag: kill + headshot + defend.
    red.moveTo(c.x + 3, c.z);
    m.reportDeath({ victimId: 'r', killerId: 'p', weapon: 'M4A1', headshot: true, distance: 20 });
    const s = CONQUEST.score;
    expect(ps.score).toBe(s.capture + s.kill + s.headshotBonus + s.defendBonus);
    expect(ps.kills).toBe(1);
    expect(ps.headshots).toBe(1);
    expect(m.stats.get('r')!.deaths).toBe(1);
    expect(m.tickets.count.red).toBe(CONQUEST.startingTickets - 1);
    // Red neutralizes it back: 100 each to the soldiers who did it.
    blue.moveTo(300, 300);
    red.moveTo(c.x, c.z);
    for (let i = 0; i < 101; i++) m.update(DT);
    expect(m.stats.get('r')!.score).toBe(s.neutralize);
  });

  it('counts a death without a killer but gives no score', () => {
    const blue = new Dummy('p', 'blue', true);
    const m = new ConquestMatch(VERDAN, [blue]);
    const feed: unknown[] = [];
    m.events.on('kill', (k) => feed.push(k));
    m.reportDeath({ victimId: 'p', cause: 'fall' });
    expect(m.stats.get('p')).toMatchObject({ deaths: 1, score: 0 });
    expect(m.tickets.count.blue).toBe(CONQUEST.startingTickets - 1);
    expect(feed[0]).toMatchObject({ killer: null, cause: 'fall' });
  });

  it('ignores test targets for flags', () => {
    const target = new Dummy('t', 'red');
    (target as { capturer?: boolean }).capturer = false;
    const c = VERDAN.flags[2];
    target.moveTo(c.x, c.z);
    const m = new ConquestMatch(VERDAN, [target]);
    for (let i = 0; i < 200; i++) m.update(DT);
    expect(m.zones[2].control).toBe(0);
  });
});

describe('HQ zone and spawns', () => {
  it('warns 5 s inside the enemy HQ, then kills; own HQ is safe', () => {
    const hq = new HQZone(VERDAN.hqs);
    const red = VERDAN.hqs.find((h) => h.team === 'red')!.rect;
    const x = (red.x0 + red.x1) / 2;
    const z = (red.z0 + red.z1) / 2;
    expect(hq.update(1, 'red', x, z)).toBe('safe');
    expect(hq.update(1, 'blue', x, z)).toBe('warning');
    expect(hq.remaining).toBeCloseTo(CONQUEST.hq.enemyWarning - 1, 5);
    expect(hq.update(CONQUEST.hq.enemyWarning, 'blue', x, z)).toBe('expired');
    expect(hq.update(0.1, 'blue', 0, 0)).toBe('safe');
    expect(hq.remaining).toBeNull();
  });

  it('offers HQ plus owned flags, and skips taken spawn points', () => {
    const spawns = new SpawnSystem(VERDAN);
    const owners = { A: 'blue', B: null, C: 'red', D: null, E: 'blue' } as const;
    expect(spawns.options('blue', owners)).toEqual([{ kind: 'hq' }, { kind: 'flag', flag: 'A' }, { kind: 'flag', flag: 'E' }]);
    expect(spawns.options('red', owners)).toEqual([{ kind: 'hq' }, { kind: 'flag', flag: 'C' }]);
    const first = VERDAN.flagSpawns.A[0];
    const p = spawns.point('blue', { kind: 'flag', flag: 'A' }, [first], 0);
    expect(p).not.toBe(first);
    expect(VERDAN.flagSpawns.A).toContain(p);
  });
});

describe('a full match with the player alone', () => {
  it('captures all five flags, bleeds Red to zero and wins', () => {
    const player = new Dummy('p', 'blue', true, 'Tester');
    const m = new ConquestMatch(VERDAN, [player]);
    let ended: unknown = null;
    m.events.on('ended', (r) => (ended = r));
    for (const f of VERDAN.flags) {
      player.moveTo(f.x, f.z, f.y);
      for (let t = 0; t < CONQUEST.capture.time + 0.2; t += DT) m.update(DT);
      expect(m.owners()[f.id]).toBe('blue');
    }
    expect(m.held().blue).toBe(5);
    const redBefore = m.tickets.count.red;
    expect(redBefore).toBeLessThan(CONQUEST.startingTickets);
    // All five flags: one Red ticket every 2 s.
    for (let t = 0; t < 20; t += DT) m.update(DT);
    expect(redBefore - m.tickets.count.red).toBe(10);
    while (!m.result && m.elapsed < CONQUEST.timeLimit) m.update(1);
    expect(ended).toEqual({ winner: 'blue', reason: 'tickets' });
    expect(m.tickets.count.red).toBe(0);
    expect(m.stats.get('p')).toMatchObject({ captures: 5, score: 5 * CONQUEST.score.capture });
  });

  it('is a draw when time runs out with equal tickets', () => {
    const m = new ConquestMatch(VERDAN, [new Dummy('p', 'blue', true)]);
    while (!m.result) m.update(1);
    expect(m.result).toEqual({ winner: null, reason: 'time' });
  });
});
