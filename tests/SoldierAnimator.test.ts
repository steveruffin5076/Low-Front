import { describe, expect, it } from 'vitest';
import { IDLE_INPUT, SoldierAnimator, legHeight, type SoldierInput } from '../src/anim/SoldierAnimator';
import { AIM_SPLIT, DEATH, GAIT, SOLDIER_DIMENSIONS } from '../src/data/soldier';
import { WEAPON_TIMING } from '../src/data/weaponTiming';

const DT = 1 / 60;
const run = (a: SoldierAnimator, seconds: number, input: Partial<SoldierInput> = {}): void => {
  for (let t = 0; t < seconds; t += DT) a.update(DT, { ...IDLE_INPUT, ...input });
};

describe('soldier animator: locomotion', () => {
  it('advances the gait phase by distance over stride, so the feet do not slide', () => {
    const a = new SoldierAnimator();
    const speed = GAIT.runSpeed;
    const steps = 30;
    for (let i = 0; i < steps; i++) a.update(DT, { ...IDLE_INPUT, moveForward: speed });
    const expected = ((speed * DT * steps) / GAIT.stride.run) * Math.PI * 2;
    expect(a.phase).toBeCloseTo(expected % (Math.PI * 2), 5);
  });

  it('stands still with straight legs when idle', () => {
    const a = new SoldierAnimator();
    run(a, 1);
    const p = a.pose;
    expect(p.rot.thighL[0]).toBeCloseTo(0, 5);
    expect(p.rot.shinR[0]).toBeCloseTo(0, 5);
    expect(p.hipsY).toBeCloseTo(SOLDIER_DIMENSIONS.hipHeight, 5);
  });

  it('swings the legs forward and back when moving forward, sideways when strafing', () => {
    const fwd = new SoldierAnimator();
    const side = new SoldierAnimator();
    let fwdX = 0;
    let fwdZ = 0;
    let sideX = 0;
    let sideZ = 0;
    for (let i = 0; i < 120; i++) {
      fwd.update(DT, { ...IDLE_INPUT, moveForward: GAIT.walkSpeed });
      side.update(DT, { ...IDLE_INPUT, moveRight: GAIT.walkSpeed });
      fwdX = Math.max(fwdX, Math.abs(fwd.pose.rot.thighL[0]));
      fwdZ = Math.max(fwdZ, Math.abs(fwd.pose.rot.thighL[2]));
      sideX = Math.max(sideX, Math.abs(side.pose.rot.thighL[0]));
      sideZ = Math.max(sideZ, Math.abs(side.pose.rot.thighL[2]));
    }
    expect(fwdX).toBeGreaterThan(0.3);
    expect(fwdZ).toBeLessThan(0.01);
    expect(sideZ).toBeGreaterThan(0.2);
    expect(sideX).toBeLessThan(0.01);
  });

  it('mirrors the leg swing when backpedaling', () => {
    const fwd = new SoldierAnimator();
    const back = new SoldierAnimator();
    for (let i = 0; i < 40; i++) {
      fwd.update(DT, { ...IDLE_INPUT, moveForward: GAIT.walkSpeed });
      back.update(DT, { ...IDLE_INPUT, moveForward: -GAIT.walkSpeed });
    }
    expect(fwd.phase).toBeCloseTo(back.phase, 5);
    expect(back.pose.rot.thighL[0]).toBeCloseTo(-fwd.pose.rot.thighL[0], 5);
  });

  it('leans forward and lowers the rifle more as speed rises', () => {
    const walk = new SoldierAnimator();
    const sprint = new SoldierAnimator();
    run(walk, 1, { moveForward: GAIT.walkSpeed });
    run(sprint, 1, { moveForward: GAIT.sprintSpeed, sprinting: true });
    expect(sprint.sprintBlend).toBe(1);
    expect(walk.sprintBlend).toBe(0);
    expect(sprint.pose.rot.spine[0]).toBeLessThan(walk.pose.rot.spine[0]);
    expect(sprint.pose.hold.rot[0]).toBeLessThan(walk.pose.hold.rot[0]);
  });

  it('crouches with the feet on the ground and the head lower', () => {
    const a = new SoldierAnimator();
    run(a, 1, { crouched: true });
    expect(a.crouchBlend).toBe(1);
    const p = a.pose;
    expect(p.hipsY).toBeLessThan(SOLDIER_DIMENSIONS.hipHeight - 0.3);
    // The planted (left) leg reaches the ground exactly.
    expect(legHeight(p.rot.thighL[0], p.rot.shinL[0])).toBeCloseTo(p.hipsY, 5);
  });

  it('tucks the legs when jumping and reaches down when falling', () => {
    const up = new SoldierAnimator();
    const down = new SoldierAnimator();
    run(up, 0.5, { grounded: false, verticalSpeed: 3 });
    run(down, 0.5, { grounded: false, verticalSpeed: -3 });
    expect(up.pose.rot.thighL[0]).toBeGreaterThan(down.pose.rot.thighL[0]);
    expect(up.pose.rot.shinL[0]).toBeLessThan(down.pose.rot.shinL[0]);
  });
});

describe('soldier animator: aim and actions', () => {
  it('shares the aim pitch over spine, chest and neck', () => {
    const a = new SoldierAnimator();
    const level = new SoldierAnimator();
    run(a, 0.5, { pitch: 0.4 });
    run(level, 0.5);
    const d = (b: 'spine' | 'chest' | 'neck'): number => a.pose.rot[b][0] - level.pose.rot[b][0];
    expect(d('spine')).toBeCloseTo(0.4 * AIM_SPLIT.spine, 5);
    expect(d('chest')).toBeCloseTo(0.4 * AIM_SPLIT.chest, 5);
    expect(d('neck')).toBeCloseTo(0.4 * AIM_SPLIT.neck, 5);
  });

  it('kicks on fire and recovers', () => {
    const a = new SoldierAnimator();
    a.fire();
    a.update(DT, IDLE_INPUT);
    expect(a.pose.kick).toBeGreaterThan(0.7);
    run(a, 0.5);
    expect(a.pose.kick).toBeLessThan(0.01);
  });

  it('reloads: the hand goes to the magazine and a pouch, the magazine travels with it, then returns', () => {
    const a = new SoldierAnimator();
    a.reload(2);
    let maxMag = 0;
    let maxPouch = 0;
    let carried = false;
    for (let t = 0; t < 2.2; t += DT) {
      a.update(DT, IDLE_INPUT);
      maxMag = Math.max(maxMag, a.pose.toMag);
      maxPouch = Math.max(maxPouch, a.pose.toPouch);
      carried ||= a.pose.magInHand;
    }
    expect(maxMag).toBeCloseTo(1, 2);
    expect(maxPouch).toBeCloseTo(1, 2);
    expect(carried).toBe(true);
    expect(a.reloading).toBe(false);
    expect(a.pose.toMag).toBe(0);
    expect(a.pose.magInHand).toBe(false);
  });

  it('switches weapons: stows, swaps at the holster time, draws', () => {
    const a = new SoldierAnimator();
    a.switchWeapon();
    run(a, WEAPON_TIMING.holster.primary - DT);
    expect(a.pose.active).toBe('primary');
    expect(a.pose.stow).toBeGreaterThan(0.9);
    run(a, 2 * DT);
    expect(a.pose.active).toBe('secondary');
    run(a, WEAPON_TIMING.draw.secondary);
    expect(a.pose.stow).toBe(0);
    expect(a.switching).toBe(false);
  });
});

describe('soldier animator: death', () => {
  it('falls toward the hit direction', () => {
    const forward = new SoldierAnimator();
    const right = new SoldierAnimator();
    forward.die(0);
    right.die(Math.PI / 2);
    run(forward, DEATH.fallTime + 0.1);
    run(right, DEATH.fallTime + 0.1);
    // Root X rotation tips the body toward −Z (forward); Z rotation toward +X (right).
    expect(forward.pose.rot.root[0]).toBeCloseTo(-Math.PI / 2, 3);
    expect(Math.abs(forward.pose.rot.root[2])).toBeLessThan(1e-6);
    expect(right.pose.rot.root[2]).toBeCloseTo(-Math.PI / 2, 3);
    expect(forward.pose.death).toBe(1);
  });

  it('stays down 10 s, then fades out over 1 s', () => {
    const a = new SoldierAnimator();
    a.die(Math.PI);
    run(a, DEATH.fallTime + DEATH.stayTime - 0.05);
    expect(a.pose.opacity).toBe(1);
    run(a, DEATH.fadeTime / 2 + 0.05);
    expect(a.pose.opacity).toBeGreaterThan(0.3);
    expect(a.pose.opacity).toBeLessThan(0.7);
    expect(a.gone).toBe(false);
    run(a, DEATH.fadeTime / 2 + 0.05);
    expect(a.pose.opacity).toBe(0);
    expect(a.gone).toBe(true);
  });

  it('ignores actions while dead and resets to standing', () => {
    const a = new SoldierAnimator();
    a.die(0);
    a.reload(2);
    a.switchWeapon();
    a.fire();
    expect(a.reloading || a.switching).toBe(false);
    a.reset();
    run(a, 0.2);
    expect(a.pose.death).toBe(0);
    expect(a.pose.rot.root[0]).toBe(0);
  });
});
