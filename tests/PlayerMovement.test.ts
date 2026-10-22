import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../src/data/player';
import { Stamina, accelerate, approach, jumpVelocity, maxSpeed, shouldSprint } from '../src/entities/PlayerMovement';

describe('maxSpeed', () => {
  const base = { sprinting: false, crouched: false, ads: false };
  it('uses the plan speeds', () => {
    expect(maxSpeed(base, 1)).toBe(4.5);
    expect(maxSpeed({ ...base, sprinting: true }, 1)).toBe(6.5);
    expect(maxSpeed({ ...base, crouched: true }, 1)).toBe(2.5);
    expect(maxSpeed({ ...base, ads: true }, 1)).toBe(2.8);
    expect(maxSpeed({ ...base, ads: true, crouched: true }, 1)).toBe(2.5);
  });
  it('applies the weapon modifier', () => {
    expect(maxSpeed(base, 0.95)).toBeCloseTo(4.275);
  });
});

describe('jumpVelocity', () => {
  it('reaches the configured jump height', () => {
    const v = jumpVelocity(0.6, 18);
    expect((v * v) / (2 * 18)).toBeCloseTo(0.6);
  });
});

describe('accelerate', () => {
  it('limits the total change per step', () => {
    const [x, z] = accelerate(0, 0, 10, 0, 40, 0.1);
    expect(x).toBeCloseTo(4);
    expect(z).toBe(0);
  });
  it('snaps to the target when close', () => {
    expect(accelerate(4, 0, 4.1, 0, 40, 0.1)).toEqual([4.1, 0]);
  });
});

describe('approach', () => {
  it('moves toward the target without overshooting', () => {
    expect(approach(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(approach(0.9, 1, 0.3)).toBe(1);
    expect(approach(1, 0, 0.3)).toBeCloseTo(0.7);
  });
});

describe('Stamina', () => {
  it('lasts the configured sprint time', () => {
    const s = new Stamina();
    for (let i = 0; i < 59; i++) s.update(0.1, true);
    expect(s.canSprint).toBe(true);
    s.update(0.2, true);
    expect(s.value).toBe(0);
    expect(s.canSprint).toBe(false);
  });

  it('allows sprint again after recovering past the restart level', () => {
    const s = new Stamina();
    s.update(MOVEMENT.staminaDuration + 1, true);
    s.update(MOVEMENT.staminaRecovery * MOVEMENT.staminaRestart * 0.5, false);
    expect(s.canSprint).toBe(false);
    s.update(MOVEMENT.staminaRecovery * MOVEMENT.staminaRestart, false);
    expect(s.canSprint).toBe(true);
  });

  it('refills completely in the recovery time', () => {
    const s = new Stamina();
    s.update(100, true);
    s.update(MOVEMENT.staminaRecovery, false);
    expect(s.value).toBe(1);
  });
});

describe('shouldSprint', () => {
  const ok = { wantsSprint: true, forward: 1, grounded: true, ads: false, firing: false, canSprint: true };
  it('needs forward input, ground, no ADS, no firing and stamina', () => {
    expect(shouldSprint(ok)).toBe(true);
    expect(shouldSprint({ ...ok, forward: 0.2 })).toBe(false);
    expect(shouldSprint({ ...ok, grounded: false })).toBe(false);
    expect(shouldSprint({ ...ok, ads: true })).toBe(false);
    expect(shouldSprint({ ...ok, firing: true })).toBe(false);
    expect(shouldSprint({ ...ok, canSprint: false })).toBe(false);
  });
});
