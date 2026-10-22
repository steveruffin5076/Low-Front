import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SOLDIER_BONES, SOLDIER_BUDGET, TEAM_COLORS, type BoneName, type Team } from '../src/data/soldier';
import { SoldierModel, soldierGeometry } from '../src/entities/soldier/SoldierModel';

const LOADOUTS = [
  { primary: 'm4a1', secondary: 'm1911' },
  { primary: 'ak47', secondary: 'm1911' },
] as const;

function hasColor(geo: THREE.BufferGeometry, color: number): boolean {
  const c = new THREE.Color(color);
  const a = geo.getAttribute('color');
  for (let i = 0; i < a.count; i++) {
    if (Math.abs(a.getX(i) - c.r) < 1e-4 && Math.abs(a.getY(i) - c.g) < 1e-4 && Math.abs(a.getZ(i) - c.b) < 1e-4) return true;
  }
  return false;
}

describe('soldier model', () => {
  it('has every rig bone (plan section 8.2)', () => {
    const m = new SoldierModel('blue', LOADOUTS[0]);
    const required: BoneName[] = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
    for (const b of required) expect(m.bones[b], b).toBeInstanceOf(THREE.Bone);
    expect(m.skeleton.bones).toHaveLength(SOLDIER_BONES.length);
  });

  it('is about 1.8 m tall', () => {
    const geo = soldierGeometry('blue', LOADOUTS[0], 'near');
    geo.computeBoundingBox();
    expect(geo.boundingBox!.max.y).toBeGreaterThan(1.75);
    expect(geo.boundingBox!.max.y).toBeLessThan(1.9);
  });

  it('stays within the triangle budgets, near and far', () => {
    for (const l of LOADOUTS) {
      const near = soldierGeometry('red', l, 'near').getAttribute('position').count / 3;
      const far = soldierGeometry('red', l, 'far').getAttribute('position').count / 3;
      expect(near).toBeLessThanOrEqual(SOLDIER_BUDGET.full);
      expect(far).toBeLessThanOrEqual(SOLDIER_BUDGET.lod);
      expect(far).toBeLessThan(near / 2);
    }
  });

  it('wears its own team color only', () => {
    for (const [team, other] of [['blue', 'red'], ['red', 'blue']] as [Team, Team][]) {
      for (const lod of ['near', 'far'] as const) {
        const geo = soldierGeometry(team, LOADOUTS[0], lod);
        expect(hasColor(geo, TEAM_COLORS[team].uniform)).toBe(true);
        expect(hasColor(geo, TEAM_COLORS[other].uniform)).toBe(false);
      }
    }
  });

  it('binds every vertex fully to one bone', () => {
    const geo = soldierGeometry('blue', LOADOUTS[1], 'near');
    const w = geo.getAttribute('skinWeight');
    const idx = geo.getAttribute('skinIndex');
    const used = new Set<number>();
    for (let i = 0; i < w.count; i++) {
      expect(w.getX(i)).toBe(1);
      used.add(idx.getX(i));
    }
    // Body bones, both weapons and their magazines.
    for (const b of ['head', 'chest', 'handL', 'footR', 'primary', 'primaryMag', 'secondary', 'secondaryMag'] as BoneName[]) {
      expect(used.has(SOLDIER_BONES.findIndex((d) => d.name === b)), b).toBe(true);
    }
  });

  it('shares geometry and material between soldiers', () => {
    const a = new SoldierModel('blue', LOADOUTS[0]);
    const b = new SoldierModel('blue', LOADOUTS[0]);
    expect(a.near.geometry).toBe(b.near.geometry);
    expect(a.near.material).toBe(b.far.material);
    a.setOpacity(0.5);
    expect(a.near.material).not.toBe(b.near.material);
    a.setOpacity(1);
    expect(a.near.material).toBe(b.near.material);
  });
});
