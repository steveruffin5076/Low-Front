import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BotBrain, type BotQueries, type BotSenses } from '../src/ai/BotBrain';
import { BotMemory, Perception, type Observer, type SightTarget } from '../src/ai/Perception';
import { CameraFx } from '../src/anim/CameraFx';
import { BOTS } from '../src/data/bots';
import { SMOKE } from '../src/data/melee';
import { HEALTH } from '../src/data/player';
import { VIEWMODEL_MOTION as M } from '../src/data/viewmodel';
import { WEAPONS, WEAPON_IDS, type WeaponDef } from '../src/data/weapons';
import { horizontalFov, zoomLookScale } from '../src/entities/lookScale';
import { damageAt, zoneMultiplier } from '../src/weapons/Damage';
import { spreadDirection } from '../src/weapons/Spread';

/** Shots and seconds to kill (first shot at t = 0), all pellets hitting. */
function ttk(def: WeaponDef, hp: number, distance: number, zone: 'head' | 'torso'): { shots: number; seconds: number } {
  const perShot = damageAt(def, distance) * zoneMultiplier(def, zone) * def.pellets;
  const shots = Math.ceil(hp / perShot);
  return { shots, seconds: (shots - 1) * (60 / def.rpm) };
}

describe('time to kill (fps-shooter skill)', () => {
  const hp = HEALTH.max;

  it('prints the table for every weapon', () => {
    const rows = WEAPON_IDS.map((id) => {
      const d = WEAPONS[id];
      const near = ttk(d, hp, 5, 'torso');
      const far = ttk(d, hp, d.falloff.end, 'torso');
      const head = ttk(d, hp, 5, 'head');
      return `${d.name.padEnd(6)} body ${near.shots} (${near.seconds.toFixed(2)} s) · far ${far.shots} (${far.seconds.toFixed(2)} s) · head ${head.shots} (${head.seconds.toFixed(2)} s)`;
    });
    console.log(rows.join('\n'));
    expect(rows).toHaveLength(WEAPON_IDS.length);
  });

  it('keeps automatic rifles, the SMG and the pistol in the 0.15–0.5 s body band up close', () => {
    for (const id of WEAPON_IDS) {
      const d = WEAPONS[id];
      if (d.class === 'sniper' || d.class === 'shotgun') continue;
      const t = ttk(d, hp, 5, 'torso').seconds;
      expect(t, d.name).toBeGreaterThanOrEqual(0.15);
      expect(t, d.name).toBeLessThanOrEqual(0.5);
      // Never slower than about 0.6 s at the end of the falloff.
      expect(ttk(d, hp, d.falloff.end, 'torso').seconds, d.name).toBeLessThanOrEqual(0.6);
    }
  });

  it('the faster-killing KR-7 pays for it: stronger recoil and slower handling than the VX-4', () => {
    const vx = WEAPONS.m4a1;
    const kr = WEAPONS.ak47;
    expect(ttk(kr, hp, 5, 'torso').seconds).toBeLessThan(ttk(vx, hp, 5, 'torso').seconds);
    expect(kr.recoil.verticalDeg).toBeGreaterThan(vx.recoil.verticalDeg * 1.5);
    expect(kr.recoil.horizontalDeg).toBeGreaterThan(vx.recoil.horizontalDeg * 2);
    expect(kr.spread.hipDeg).toBeGreaterThan(vx.spread.hipDeg);
    expect(kr.adsTime).toBeGreaterThan(vx.adsTime);
    expect(kr.reload.tactical).toBeGreaterThan(vx.reload.tactical);
  });

  it('sniper: one headshot or two body shots; shotgun: one full hit up close', () => {
    for (const id of WEAPON_IDS) {
      const d = WEAPONS[id];
      if (d.class === 'sniper') {
        expect(ttk(d, hp, 30, 'head').shots).toBe(1);
        expect(ttk(d, hp, 30, 'torso').shots).toBe(2);
      }
      if (d.class === 'shotgun') expect(ttk(d, hp, 5, 'torso').shots).toBe(1);
    }
  });
});

describe('aim sensitivity and FOV (fps-shooter skill)', () => {
  it('slows the mouse by tan(zoom/2) / tan(hip/2) for any sight, 1 at the hip', () => {
    expect(zoomLookScale(75, 75)).toBe(1);
    expect(zoomLookScale(80, 75)).toBe(1);
    expect(zoomLookScale(55, 75)).toBeCloseTo(Math.tan((27.5 * Math.PI) / 180) / Math.tan((37.5 * Math.PI) / 180), 6);
    // A target at the screen centre moves the same number of pixels per mouse count.
    const pxPerDeg = (fov: number) => 1 / Math.tan((fov * Math.PI) / 360);
    const turn = 1;
    const hipPx = turn * (Math.PI / 180) * pxPerDeg(75);
    const adsPx = turn * zoomLookScale(55, 75) * (Math.PI / 180) * pxPerDeg(55);
    expect(adsPx).toBeCloseTo(hipPx, 6);
  });

  it('converts the vertical FOV setting to horizontal for the label', () => {
    expect(horizontalFov(75, 16 / 9)).toBeCloseTo(107.5, 1);
    expect(horizontalFov(75, 1)).toBeCloseTo(75, 6);
  });
});

describe('spread direction', () => {
  it('works in place (out = forward) and stays inside the cone', () => {
    const f = new THREE.Vector3(0, 0, -1);
    let r = 0.37;
    const rand = () => (r = (r * 9301 + 49297) % 233280 / 233280);
    for (let i = 0; i < 200; i++) {
      const v = new THREE.Vector3(0, 0, -1);
      spreadDirection(v, 3, v, rand);
      expect(THREE.MathUtils.radToDeg(v.angleTo(f))).toBeLessThanOrEqual(3 + 1e-6);
    }
  });
});

describe('hit camera shake (game-feel skill)', () => {
  const run = (fx: CameraFx, seconds: number) => {
    const cam = new THREE.PerspectiveCamera();
    const xs: number[] = [];
    for (let t = 0; t < seconds; t += 1 / 60) {
      cam.position.set(0, 0, 0);
      cam.rotation.set(0, 0, 0);
      fx.apply(cam, 1 / 60, 1.6);
      xs.push(cam.position.x);
    }
    return xs;
  };

  it('trauma adds up, caps at 1 and fades to 0 within 1 / decay seconds', () => {
    const fx = new CameraFx();
    fx.hit();
    fx.hit();
    fx.hit();
    expect(fx.trauma).toBe(1);
    run(fx, 1 / M.hit.decay + 0.02);
    expect(fx.trauma).toBe(0);
  });

  it('moves smoothly (no per-frame random buzz) and a single hit is light', () => {
    const fx = new CameraFx();
    fx.hit(1);
    const xs = run(fx, 0.3);
    const peak = Math.max(...xs.map(Math.abs));
    expect(peak).toBeGreaterThan(0);
    // Smooth motion: each frame is strongly correlated with the last (random noise would be ~0).
    const a = xs.slice(1);
    const b = xs.slice(0, -1);
    const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * v[i], 0);
    expect(dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b))).toBeGreaterThan(0.6);
    const one = new CameraFx();
    one.hit();
    expect(Math.max(...run(one, 0.3).map(Math.abs))).toBeLessThan(M.hit.shake * 0.25);
  });

  it('Screen shake 0 turns it off', () => {
    const fx = new CameraFx();
    fx.strength = 0;
    fx.hit(1);
    expect(run(fx, 0.3).every((x) => x === 0)).toBe(true);
  });
});

describe('bot sight over low cover (game-ai skill)', () => {
  const observer = (): Observer => ({ id: 'b', team: 'blue', alive: true, eye: new THREE.Vector3(0, 1.6, 0), yaw: 0, memory: new BotMemory('blue') });
  const target: SightTarget = {
    id: 'r',
    team: 'red',
    alive: true,
    position: new THREE.Vector3(0, 0, -30),
    chest: new THREE.Vector3(0, 1.25, -30),
    head: new THREE.Vector3(0, 1.65, -30),
  };

  it('sees a head over cover that hides the chest, and marks it head-only', () => {
    const p = new Perception((_from, to) => to.y > 1.5, 10);
    const o = observer();
    p.update(1, [o], [target]);
    expect(o.memory.known.get('r')?.headOnly).toBe(true);
    expect(p.raycasts).toBe(2);
  });

  it('a clear chest needs one ray and is not head-only', () => {
    const p = new Perception(() => true, 10);
    const o = observer();
    p.update(1, [o], [target]);
    expect(o.memory.known.get('r')?.headOnly).toBe(false);
    expect(p.raycasts).toBe(1);
  });

  it('fully hidden stays unseen', () => {
    const p = new Perception(() => false, 10);
    const o = observer();
    p.update(1, [o], [target]);
    expect(o.memory.known.size).toBe(0);
  });
});

describe('bot smoke use (game-ai skill)', () => {
  const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  const senses = (distance: number, time = 10): BotSenses => ({
    time,
    team: 'blue',
    position: V(0, 160),
    hp: BOTS.thresholds.retreatHp - 1,
    magFraction: 1,
    smokes: 2,
    weaponClass: 'rifle',
    primaryClass: 'rifle',
    activeSlot: 'primary',
    primaryEmpty: false,
    primaryOut: false,
    canReload: true,
    reloading: false,
    flags: [],
    teammatesGoing: {},
    enemy: { id: 'r', position: V(0, 160 - distance), distance },
    lastKnown: null,
    stuck: false,
    resupplyAt: null,
  });
  const queries = (cover: THREE.Vector3 | null): BotQueries => ({
    cover: () => (cover ? { pos: cover, high: true } : null),
    zoneSpot: () => V(0, 0),
  });
  const away = V(0, 175);

  it('only covers a retreat to cover from an enemy at range', () => {
    expect(new BotBrain(() => 0).decide(senses(5), queries(away)).throwSmoke).toBe(false);
    expect(new BotBrain(() => 0).decide(senses(30), queries(null)).throwSmoke).toBe(false);
    expect(new BotBrain(() => 0).decide(senses(30), queries(away)).throwSmoke).toBe(true);
  });

  it('waits the cooldown, and a failed chance also uses it', () => {
    const b = new BotBrain(() => 0);
    expect(b.decide(senses(30, 10), queries(away)).throwSmoke).toBe(true);
    expect(b.decide(senses(30, 10 + SMOKE.bot.cooldown - 1), queries(away)).throwSmoke).toBe(false);
    expect(b.decide(senses(30, 10 + SMOKE.bot.cooldown), queries(away)).throwSmoke).toBe(true);
    const unlucky = new BotBrain(() => 0.99);
    expect(unlucky.decide(senses(30, 10), queries(away)).throwSmoke).toBe(false);
    expect(unlucky.decide(senses(30, 10.1), queries(away)).throwSmoke).toBe(false);
  });
});
