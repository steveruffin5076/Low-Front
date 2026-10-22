import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BotAim } from '../src/ai/BotAim';
import { BotMemory, Perception, type Observer, type SightTarget } from '../src/ai/Perception';
import { BOTS, DIFFICULTIES } from '../src/data/bots';

const observer = (yaw = 0, id = 'b1'): Observer => ({ id, team: 'blue', alive: true, eye: new THREE.Vector3(0, 1.6, 0), yaw, memory: new BotMemory('blue') });
const target = (x: number, z: number, id = 'r1', team: 'red' | 'blue' = 'red'): SightTarget => ({
  id,
  team,
  alive: true,
  position: new THREE.Vector3(x, 0, z),
  chest: new THREE.Vector3(x, 1.3, z),
});

describe('bot perception', () => {
  it('sees enemies inside the 110° field of view and 90 m range only', () => {
    const p = new Perception(() => true, 100);
    const o = observer(0);
    const ahead = target(0, -50, 'ahead');
    const side = target(-40, -30, 'side'); // ~53° off the view line: inside 55°.
    const wide = target(-40, -20, 'wide'); // ~63°: outside.
    const far = target(0, -95, 'far');
    const mate = target(0, -20, 'mate', 'blue');
    p.update(1, [o], [ahead, side, wide, far, mate]);
    expect([...o.memory.known.keys()].sort()).toEqual(['ahead', 'side']);
  });

  it('needs line of sight, and shares a raycast budget across bots', () => {
    const blocked = new Perception(() => false, 100);
    const o = observer(0);
    blocked.update(1, [o], [target(0, -30)]);
    expect(o.memory.known.size).toBe(0);
    // Budget 3: four bots with one candidate each take two frames.
    const p = new Perception(() => true, 3);
    const bots = [0, 1, 2, 3].map((i) => observer(0, `b${i}`));
    p.update(1, bots, [target(0, -30)]);
    expect(p.raycasts).toBe(3);
    expect(bots.filter((b) => b.memory.known.size > 0)).toHaveLength(3);
    p.update(1.016, bots, [target(0, -30)]);
    expect(bots.every((b) => b.memory.known.size > 0)).toBe(true);
  });

  it('hears gunshots within 60 m and keeps memory for a while', () => {
    const p = new Perception(() => true);
    const near = observer(0, 'near');
    const far = { ...observer(0, 'far'), eye: new THREE.Vector3(200, 1.6, 0), memory: new BotMemory('blue') };
    p.gunshot(5, { id: 'r1', team: 'red', position: new THREE.Vector3(30, 0, 30) }, [near, far]);
    expect(near.memory.known.get('r1')?.position.x).toBe(30);
    expect(far.memory.known.size).toBe(0);
    expect(near.memory.nearestVisible(near.eye, 5)).toBeNull();
    near.memory.forget(5 + BOTS.perception.memory + 1, () => true);
    expect(near.memory.known.size).toBe(0);
  });

  it('tracks how long a target has been in sight (for reaction time)', () => {
    const m = new BotMemory('blue');
    const t = target(0, -10);
    m.saw(t, 1);
    m.saw(t, 1.2);
    expect(m.known.get('r1')!.seenSince).toBe(1);
    // Out of sight for a moment, then seen again: a new sighting starts.
    m.saw(t, 3);
    expect(m.known.get('r1')!.seenSince).toBe(3);
  });
});

describe('bot aim', () => {
  const preset = DIFFICULTIES.normal;

  it('waits the reaction time, then fires in bursts with pauses', () => {
    const aim = new BotAim(preset, () => 0.5);
    aim.track(0, 'r1');
    expect(aim.ready).toBe(false);
    aim.track(aim.reaction + 0.01, 'r1');
    expect(aim.ready).toBe(true);
    const burst = Math.round((preset.burst.min + preset.burst.max) / 2);
    for (let i = 1; i < burst; i++) expect(aim.shot()).toBe(false);
    expect(aim.shot()).toBe(true);
    expect(aim.ready).toBe(false);
    aim.track(preset.burstPause.max, 'r1');
    expect(aim.ready).toBe(true);
  });

  it('shrinks the aim error while tracking, and starts over on a new target', () => {
    const aim = new BotAim(preset, () => 0.5);
    aim.track(0, 'r1');
    const start = aim.error;
    aim.track(preset.aimSettle / 2, 'r1');
    const mid = aim.error;
    aim.track(preset.aimSettle, 'r1');
    expect(start).toBeCloseTo(preset.aimError.start, 5);
    expect(mid).toBeLessThan(start);
    expect(aim.error).toBeCloseTo(preset.aimError.min, 5);
    aim.track(0.1, 'r2');
    expect(aim.error).toBeCloseTo(preset.aimError.start, 5);
  });

  it('aims at the torso, and sometimes at the head', () => {
    let heads = 0;
    for (let i = 0; i < 2000; i++) {
      const aim = new BotAim(preset);
      aim.track(0, 'r');
      aim.shot();
      if (aim.head) heads++;
    }
    expect(heads / 2000).toBeGreaterThan(preset.headChance * 0.6);
    expect(heads / 2000).toBeLessThan(preset.headChance * 1.4);
    // The aimed direction stays inside the error cone around the chest.
    const aim = new BotAim(preset);
    aim.track(0, 'r');
    const eye = new THREE.Vector3(0, 1.6, 0);
    const chest = new THREE.Vector3(0, 1.3, -30);
    const out = aim.aim(eye, chest, new THREE.Vector3(0, 1.7, -30), new THREE.Vector3());
    const angle = THREE.MathUtils.radToDeg(out.angleTo(chest.clone().sub(eye).normalize()));
    expect(angle).toBeLessThanOrEqual(aim.error + 1e-6);
  });
});
