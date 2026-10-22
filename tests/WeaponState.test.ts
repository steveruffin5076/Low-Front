import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/data/weapons';
import { WeaponState } from '../src/weapons/WeaponState';

function holdFor(w: WeaponState, seconds: number, dt = 1 / 60): number {
  let shots = 0;
  let first = true;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    w.update(dt);
    if (w.trigger(first, true) === 'fired') shots++;
    first = false;
  }
  return shots;
}

describe('WeaponState', () => {
  it('starts with a full magazine plus the chambered round', () => {
    const w = new WeaponState(WEAPONS.m4a1);
    expect(w.mag).toBe(31);
    expect(w.reserve).toBe(120);
  });

  it('fires at the configured RPM in auto', () => {
    const w = new WeaponState(WEAPONS.m4a1);
    w.reserve = 0;
    w.mag = 1000;
    // 750 RPM = 12.5 rounds per second.
    expect(holdFor(w, 2)).toBeGreaterThanOrEqual(24);
    expect(holdFor(new WeaponState({ ...WEAPONS.m4a1, magazine: 999 }), 2)).toBeLessThanOrEqual(26);
  });

  it('fires once per press in semi', () => {
    const w = new WeaponState(WEAPONS.m4a1);
    w.toggleFireMode();
    expect(w.fireMode).toBe('semi');
    expect(holdFor(w, 1)).toBe(1);
  });

  it('limits semi fire to the max RPM', () => {
    const w = new WeaponState(WEAPONS.m1911);
    expect(w.trigger(true, true)).toBe('fired');
    w.update(0.1);
    expect(w.trigger(true, true)).toBeNull();
    w.update(0.06);
    expect(w.trigger(true, true)).toBe('fired');
  });

  it('dry fires on press when empty', () => {
    const w = new WeaponState(WEAPONS.m1911);
    w.mag = 0;
    expect(w.trigger(false, true)).toBeNull();
    expect(w.trigger(true, true)).toBe('dry');
  });

  it('tactical reload refills to magazine + chamber', () => {
    const w = new WeaponState(WEAPONS.m4a1);
    w.mag = 10;
    expect(w.reloadKind).toBe('tactical');
    w.applyReload('tactical');
    expect(w.mag).toBe(31);
    expect(w.reserve).toBe(99);
  });

  it('empty reload loads a magazine without the chamber round', () => {
    const w = new WeaponState(WEAPONS.ak47);
    w.mag = 0;
    expect(w.reloadKind).toBe('empty');
    w.applyReload('empty');
    expect(w.mag).toBe(30);
    expect(w.reserve).toBe(90);
  });

  it('reloads only what is left in reserve', () => {
    const w = new WeaponState(WEAPONS.m1911);
    w.mag = 0;
    w.reserve = 3;
    w.applyReload('empty');
    expect(w.mag).toBe(3);
    expect(w.reserve).toBe(0);
    expect(w.canReload).toBe(false);
  });

  it('does not toggle fire mode on a semi-only weapon', () => {
    expect(new WeaponState(WEAPONS.m1911).toggleFireMode()).toBe(false);
  });
});
