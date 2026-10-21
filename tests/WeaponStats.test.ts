import { describe, expect, it } from 'vitest';
import { WEAPONS, WEAPON_IDS } from '../src/data/weapons';
import { magazineLabel, statBars } from '../src/weapons/WeaponStats';

describe('statBars', () => {
  it('keeps every bar between 0 and 1', () => {
    for (const id of WEAPON_IDS) {
      for (const v of Object.values(statBars(WEAPONS[id]))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('ranks the rifles as described in the plan', () => {
    const m4 = statBars(WEAPONS.m4a1);
    const ak = statBars(WEAPONS.ak47);
    expect(ak.damage).toBeGreaterThan(m4.damage);
    expect(m4.fireRate).toBeGreaterThan(ak.fireRate);
    expect(m4.accuracy).toBeGreaterThan(ak.accuracy);
    expect(m4.range).toBeGreaterThan(ak.range);
    expect(m4.mobility).toBeGreaterThan(ak.mobility);
  });

  it('gives the pistol the best mobility and the shortest range', () => {
    const pistol = statBars(WEAPONS.m1911);
    expect(pistol.mobility).toBeGreaterThan(statBars(WEAPONS.m4a1).mobility);
    expect(pistol.range).toBeLessThan(statBars(WEAPONS.ak47).range);
  });
});

describe('magazineLabel', () => {
  it('shows magazine plus chamber', () => {
    expect(magazineLabel(WEAPONS.m4a1)).toBe('30 + 1');
    expect(magazineLabel(WEAPONS.m1911)).toBe('7 + 1');
  });
});
