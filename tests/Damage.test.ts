import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEAPONS } from '../src/data/weapons';
import { damageAt, hitDamage } from '../src/weapons/Damage';
import { Spread, spreadDirection } from '../src/weapons/Spread';
import { Recoil } from '../src/weapons/Recoil';
import { Health, fallDamage } from '../src/entities/Health';
import { stepProjectile } from '../src/weapons/Projectile';

describe('damage falloff (plan table)', () => {
  it('M4A1: 30 up to 30 m, 22 from 75 m, linear between', () => {
    const w = WEAPONS.m4a1;
    expect(damageAt(w, 0)).toBe(30);
    expect(damageAt(w, 30)).toBe(30);
    expect(damageAt(w, 52.5)).toBeCloseTo(26);
    expect(damageAt(w, 75)).toBe(22);
    expect(damageAt(w, 200)).toBe(22);
  });
  it('AK47: 36 → 26 over 25–70 m', () => {
    expect(damageAt(WEAPONS.ak47, 10)).toBe(36);
    expect(damageAt(WEAPONS.ak47, 47.5)).toBeCloseTo(31);
    expect(damageAt(WEAPONS.ak47, 100)).toBe(26);
  });
  it('M1911: 40 → 28 over 15–40 m', () => {
    expect(damageAt(WEAPONS.m1911, 10)).toBe(40);
    expect(damageAt(WEAPONS.m1911, 27.5)).toBeCloseTo(34);
    expect(damageAt(WEAPONS.m1911, 50)).toBe(28);
  });
});

describe('zone multipliers', () => {
  it('head ×2, torso ×1, arms and legs ×0.75', () => {
    const w = WEAPONS.m4a1;
    expect(hitDamage(w, 10, 'head')).toBe(60);
    expect(hitDamage(w, 10, 'torso')).toBe(30);
    expect(hitDamage(w, 10, 'arm')).toBe(22.5);
    expect(hitDamage(w, 10, 'leg')).toBe(22.5);
    expect(hitDamage(WEAPONS.ak47, 100, 'head')).toBe(52);
  });
});

describe('Spread', () => {
  const still = { ads: 0, speed: 0, grounded: true };
  it('is smaller when aiming and larger when moving or airborne', () => {
    const s = new Spread(WEAPONS.m4a1);
    const hip = s.cone(still);
    expect(s.cone({ ...still, ads: 1 })).toBeCloseTo(WEAPONS.m4a1.spread.adsDeg);
    expect(s.cone({ ...still, speed: 4.5 })).toBeGreaterThan(hip);
    expect(s.cone({ ...still, grounded: false })).toBeGreaterThan(hip);
  });
  it('grows with sustained fire and recovers', () => {
    const s = new Spread(WEAPONS.m4a1);
    const hip = s.cone(still);
    for (let i = 0; i < 10; i++) s.onShot();
    expect(s.cone(still)).toBeGreaterThan(hip + 2);
    s.update(2);
    expect(s.cone(still)).toBeCloseTo(hip);
  });
  it('keeps directions inside the cone', () => {
    const fwd = new THREE.Vector3(0, 0, -1);
    const out = new THREE.Vector3();
    for (let i = 0; i < 200; i++) {
      spreadDirection(fwd, 2, out);
      expect(THREE.MathUtils.radToDeg(out.angleTo(fwd))).toBeLessThanOrEqual(2.0001);
    }
    expect(spreadDirection(fwd, 0, out).distanceTo(fwd)).toBeLessThan(1e-9);
  });
});

describe('Recoil', () => {
  it('kicks up by the vertical value and recovers after the delay', () => {
    const r = new Recoil();
    const w = WEAPONS.ak47;
    for (let i = 0; i < 10; i++) r.kick(w, 1, () => 0.5);
    expect(r.pitch).toBeCloseTo(6);
    r.update(w.recoil.recoveryDelay / 2, w);
    expect(r.pitch).toBeCloseTo(6);
    for (let t = 0; t < 2; t += 1 / 60) r.update(1 / 60, w);
    expect(Math.hypot(r.pitch, r.yaw)).toBeLessThan(1e-6);
  });
  it('kicks the AK47 harder than the M4A1', () => {
    const a = new Recoil();
    const b = new Recoil();
    for (let i = 0; i < 10; i++) {
      a.kick(WEAPONS.ak47, 1, () => 0.5);
      b.kick(WEAPONS.m4a1, 1, () => 0.5);
    }
    expect(Math.hypot(a.pitch, a.yaw)).toBeGreaterThan(Math.hypot(b.pitch, b.yaw) * 1.5);
  });
  it('does not recover what the player already pulled down', () => {
    const r = new Recoil();
    r.kick(WEAPONS.m4a1, 1, () => 0.5);
    r.compensate(-1);
    expect(r.pitch).toBe(0);
  });
});

describe('Health', () => {
  it('regenerates 10 HP/s after 8 s without damage', () => {
    const h = new Health();
    h.damage(50);
    h.update(7.9);
    expect(h.hp).toBe(50);
    h.update(0.1);
    h.update(1);
    expect(h.hp).toBeCloseTo(60, 0);
    h.update(10);
    expect(h.hp).toBe(100);
  });
  it('dies at 0 and reports the killing hit once', () => {
    const h = new Health();
    expect(h.damage(99)).toBe(false);
    expect(h.damage(5)).toBe(true);
    expect(h.dead).toBe(true);
    expect(h.damage(5)).toBe(false);
  });
  it('fall damage starts above 4 m', () => {
    expect(fallDamage(3.9)).toBe(0);
    expect(fallDamage(6)).toBe(40);
  });
});

describe('projectile', () => {
  it('drops under gravity like the closed form', () => {
    const pos = [0, 0, 0];
    const vel = [0, 0, -880];
    for (let i = 0; i < 60; i++) stepProjectile(pos, vel, 1 / 60, 9.81);
    expect(pos[2]).toBeCloseTo(-880);
    expect(pos[1]).toBeCloseTo(-0.5 * 9.81, 5);
  });
});
