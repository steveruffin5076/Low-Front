import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../src/core/Time';

describe('FixedStepClock', () => {
  it('runs one step per 1/60 s at 60 Hz', () => {
    const clock = new FixedStepClock(60, 5, 0.25);
    expect(clock.advance(1 / 60)).toBe(1);
    expect(clock.alpha).toBeCloseTo(0, 6);
  });

  it('accumulates partial frames', () => {
    const clock = new FixedStepClock(60, 5, 0.25);
    expect(clock.advance(0.01)).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.6, 6);
    expect(clock.advance(0.01)).toBe(1);
    expect(clock.alpha).toBeCloseTo(0.2, 6);
  });

  it('runs several steps on a slow frame', () => {
    const clock = new FixedStepClock(60, 5, 0.25);
    expect(clock.advance(3 / 60 + 0.001)).toBe(3);
  });

  it('caps steps per frame and drops the remaining time', () => {
    const clock = new FixedStepClock(60, 5, 0.25);
    expect(clock.advance(0.2)).toBe(5);
    expect(clock.alpha).toBe(0);
  });

  it('clamps very long and negative frame deltas', () => {
    const clock = new FixedStepClock(60, 100, 0.25);
    expect(clock.advance(10)).toBe(15);
    expect(clock.advance(-1)).toBe(0);
  });

  it('keeps total step count matched to elapsed time over many frames', () => {
    const clock = new FixedStepClock(60, 5, 0.25);
    let steps = 0;
    for (let i = 0; i < 144; i++) steps += clock.advance(1 / 144);
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
  });
});
