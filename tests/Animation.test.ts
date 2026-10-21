import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EASE } from '../src/anim/Easing';
import { ClipBuilder, ClipPlayer, sampleTrack } from '../src/anim/Timeline';
import { Spring } from '../src/anim/Spring';
import { solveTwoBone } from '../src/anim/TwoBoneIK';

describe('easing', () => {
  it('starts at 0 and ends at 1', () => {
    for (const f of Object.values(EASE)) {
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
    }
  });
});

describe('Timeline', () => {
  const track = { channel: 'x', keys: [{ t: 0, v: [0] }, { t: 1, v: [10], ease: 'linear' as const }, { t: 2, v: [10] }] };

  it('interpolates between keys and clamps outside', () => {
    expect(sampleTrack(track, -1)).toEqual([0]);
    expect(sampleTrack(track, 0.5)[0]).toBeCloseTo(5);
    expect(sampleTrack(track, 5)).toEqual([10]);
  });

  it('fires each event once when its time is crossed', () => {
    const clip = new ClipBuilder('c', 1).key('x', 0, [0]).event(0.5, 'mid').event(1, 'end').build();
    const p = new ClipPlayer(clip);
    const fired: string[] = [];
    p.update(0.4, (e) => fired.push(e));
    p.update(0.2, (e) => fired.push(e));
    p.update(0.2, (e) => fired.push(e));
    p.update(0.5, (e) => fired.push(e));
    expect(fired).toEqual(['mid', 'end']);
    expect(p.done).toBe(true);
  });

  it('plays faster with a higher speed', () => {
    const p = new ClipPlayer(new ClipBuilder('c', 2).key('x', 0, [0]).build(), 2);
    p.update(1);
    expect(p.done).toBe(true);
  });
});

describe('Spring', () => {
  it('returns to rest after an impulse', () => {
    const s = new Spring(12);
    s.impulse(1);
    let peak = 0;
    for (let i = 0; i < 120; i++) peak = Math.max(peak, s.update(1 / 60));
    expect(peak).toBeGreaterThan(0.02);
    expect(Math.abs(s.value)).toBeLessThan(1e-3);
  });
});

describe('solveTwoBone', () => {
  const root = new THREE.Vector3(0, 0, 0);
  const pole = new THREE.Vector3(0, -1, 0);
  const elbow = new THREE.Vector3();
  const hand = new THREE.Vector3();

  it('keeps bone lengths and reaches a target in range', () => {
    const target = new THREE.Vector3(0.1, 0.05, -0.4);
    solveTwoBone(root, target, pole, 0.3, 0.28, elbow, hand);
    expect(elbow.distanceTo(root)).toBeCloseTo(0.3, 5);
    expect(hand.distanceTo(elbow)).toBeCloseTo(0.28, 5);
    expect(hand.distanceTo(target)).toBeLessThan(1e-6);
  });

  it('bends the elbow toward the pole', () => {
    solveTwoBone(root, new THREE.Vector3(0, 0, -0.4), pole, 0.3, 0.28, elbow, hand);
    expect(elbow.y).toBeLessThan(-0.1);
  });

  it('stretches straight toward a target out of reach', () => {
    const target = new THREE.Vector3(0, 0, -2);
    solveTwoBone(root, target, pole, 0.3, 0.28, elbow, hand);
    expect(hand.distanceTo(root)).toBeCloseTo(0.58, 3);
    expect(hand.z).toBeLessThan(0);
  });
});
