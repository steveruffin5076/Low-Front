import { describe, expect, it } from 'vitest';
import { WEAPON_TIMING } from '../src/data/weaponTiming';
import { PlayerWeapons, seatTime, type WeaponInput } from '../src/weapons/PlayerWeapons';

const idle: WeaponInput = {
  firePressed: false,
  fireHeld: false,
  reloadPressed: false,
  switchTo: null,
  fireModePressed: false,
  inspectPressed: false,
  canFire: true,
  sprinting: false,
  ads: false,
};

function ready(): PlayerWeapons {
  const pw = new PlayerWeapons({ primary: 'm4a1', secondary: 'm1911' });
  pw.start();
  run(pw, 1);
  return pw;
}

function run(pw: PlayerWeapons, seconds: number, input: Partial<WeaponInput> = {}, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) pw.update(dt, { ...idle, ...input });
}

describe('PlayerWeapons', () => {
  it('draws the primary at the start', () => {
    const pw = new PlayerWeapons({ primary: 'ak47', secondary: 'm1911' });
    pw.start();
    expect(pw.actionKind).toBe('draw');
    run(pw, WEAPON_TIMING.draw.primary + 0.05);
    expect(pw.actionKind).toBe('ready');
    expect(pw.active.def.id).toBe('ak47');
  });

  it('updates ammo when the magazine is seated, not at the end', () => {
    const pw = ready();
    pw.active.mag = 5;
    const events: string[] = [];
    pw.events.on('reloadSeated', () => events.push('seated'));
    pw.events.on('reloadEnd', () => events.push('end'));
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    run(pw, seatTime(pw.active) - 0.05);
    expect(pw.active.mag).toBe(5);
    run(pw, 0.1);
    expect(pw.active.mag).toBe(31);
    expect(events).toEqual(['seated']);
    run(pw, 2);
    expect(events).toEqual(['seated', 'end']);
  });

  it('cancels a reload by sprinting before the magazine is seated', () => {
    const pw = ready();
    pw.active.mag = 5;
    let cancelled = false;
    pw.events.on('reloadCancel', () => (cancelled = true));
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    run(pw, 0.3);
    run(pw, 0.1, { sprinting: true });
    expect(cancelled).toBe(true);
    expect(pw.active.mag).toBe(5);
    expect(pw.actionKind).toBe('ready');
  });

  it('cancels a reload by switching weapons, then holsters and draws', () => {
    const pw = ready();
    pw.active.mag = 5;
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    run(pw, 0.3);
    pw.update(1 / 60, { ...idle, switchTo: 'secondary' });
    expect(pw.actionKind).toBe('holster');
    expect(pw.weapons.primary.mag).toBe(5);
    run(pw, WEAPON_TIMING.holster.primary + 0.02);
    expect(pw.activeSlot).toBe('secondary');
    expect(pw.actionKind).toBe('draw');
    run(pw, WEAPON_TIMING.draw.secondary + 0.02);
    expect(pw.actionKind).toBe('ready');
  });

  it('keeps the ammo when switching after the magazine is seated', () => {
    const pw = ready();
    pw.active.mag = 5;
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    run(pw, seatTime(pw.active) + 0.05);
    pw.update(1 / 60, { ...idle, switchTo: 'secondary' });
    expect(pw.weapons.primary.mag).toBe(31);
  });

  it('cannot fire while sprinting', () => {
    const pw = ready();
    let shots = 0;
    pw.events.on('fired', () => shots++);
    run(pw, 0.5, { fireHeld: true, firePressed: true, canFire: false });
    expect(shots).toBe(0);
  });

  it('reports the last round', () => {
    const pw = ready();
    pw.active.mag = 1;
    let last = false;
    pw.events.on('fired', (e) => (last = e.lastRound));
    pw.update(1 / 60, { ...idle, firePressed: true, fireHeld: true });
    expect(last).toBe(true);
  });

  it('stops inspecting when the player aims', () => {
    const pw = ready();
    pw.update(1 / 60, { ...idle, inspectPressed: true });
    expect(pw.actionKind).toBe('inspect');
    pw.update(1 / 60, { ...idle, ads: true });
    expect(pw.actionKind).toBe('ready');
  });

  it('toggles fire mode only on weapons with two modes', () => {
    const pw = ready();
    pw.update(1 / 60, { ...idle, fireModePressed: true });
    expect(pw.active.fireMode).toBe('semi');
    run(pw, 1);
    pw.update(1 / 60, { ...idle, switchTo: 'secondary' });
    run(pw, 1);
    pw.update(1 / 60, { ...idle, fireModePressed: true });
    expect(pw.actionKind).toBe('ready');
  });
});
