import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/data/weapons';
import type { PlayerController } from '../src/entities/PlayerController';
import { PlayerShooting, type BulletSink } from '../src/weapons/PlayerShooting';
import { PlayerWeapons, type WeaponInput } from '../src/weapons/PlayerWeapons';

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
const sr = WEAPONS.br12.shellReload!;

function shotgun(): PlayerWeapons {
  const pw = new PlayerWeapons({ primary: 'br12', secondary: 'm1911' });
  pw.start();
  run(pw, 1);
  return pw;
}

function run(pw: PlayerWeapons, seconds: number, input: Partial<WeaponInput> = {}, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) pw.update(dt, { ...idle, ...input });
}

describe('BR-12 shell-by-shell reload', () => {
  it('loads one shell at a time until full', () => {
    const pw = shotgun();
    pw.active.mag = 3;
    const seen: number[] = [];
    pw.events.on('shellIn', () => seen.push(pw.active.mag));
    let ended = false;
    pw.events.on('reloadEnd', () => (ended = true));
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    expect(pw.actionKind).toBe('shells');
    run(pw, sr.start + sr.perShell * 4 + sr.end + 0.1);
    expect(seen).toEqual([4, 5, 6, 7]);
    expect(pw.active.mag).toBe(7);
    expect(pw.active.reserve).toBe(WEAPONS.br12.startingReserve - 4);
    expect(ended).toBe(true);
    expect(pw.actionKind).toBe('ready');
  });

  it('stops when the trigger is pulled and keeps the shells already loaded', () => {
    const pw = shotgun();
    pw.active.mag = 1;
    let shots = 0;
    pw.events.on('fired', () => shots++);
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    run(pw, sr.start + sr.perShell * 2 + 0.05);
    expect(pw.active.mag).toBe(3);
    pw.update(1 / 60, { ...idle, firePressed: true });
    expect(pw.actionKind).toBe('ready');
    expect(shots).toBe(1);
    expect(pw.active.mag).toBe(2);
  });

  it('stops when the reserve runs out', () => {
    const pw = shotgun();
    pw.active.mag = 0;
    pw.active.reserve = 2;
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    run(pw, sr.start + sr.perShell * 2 + sr.end + 0.1);
    expect(pw.active.mag).toBe(2);
    expect(pw.active.reserve).toBe(0);
    expect(pw.actionKind).toBe('ready');
  });

  it('is cancelled by sprinting', () => {
    const pw = shotgun();
    pw.active.mag = 2;
    let cancelled = false;
    pw.events.on('reloadCancel', () => (cancelled = true));
    pw.update(1 / 60, { ...idle, reloadPressed: true });
    run(pw, 0.2, { sprinting: true });
    expect(cancelled).toBe(true);
    expect(pw.actionKind).toBe('ready');
  });
});

describe('pellets', () => {
  it('fires every pellet of a shot, scattered around the aim', () => {
    const pw = shotgun();
    const dirs: THREE.Vector3[] = [];
    const tracers: boolean[] = [];
    const sink: BulletSink = { fire: (_o, d, _def, tracer) => (dirs.push(d.clone()), tracers.push(tracer)) };
    const player = { pitch: 0, yaw: 0, horizontalSpeed: 0, grounded: true } as unknown as PlayerController;
    new PlayerShooting(sink, pw, player, () => new THREE.Vector3(), (o) => o.set(0, 0, -1));
    pw.update(1 / 60, { ...idle, firePressed: true });
    expect(dirs).toHaveLength(WEAPONS.br12.pellets);
    expect(tracers.filter((t) => t).length).toBeLessThanOrEqual(1);
    const fwd = new THREE.Vector3(0, 0, -1);
    const maxDeg = WEAPONS.br12.spread.hipDeg + WEAPONS.br12.pelletSpreadDeg + 0.01;
    for (const d of dirs) expect(THREE.MathUtils.radToDeg(d.angleTo(fwd))).toBeLessThanOrEqual(maxDeg);
    expect(new Set(dirs.map((d) => d.x.toFixed(6))).size).toBeGreaterThan(1);
  });

  it('works the pump between shots: no faster than the pump rate', () => {
    const pw = shotgun();
    let shots = 0;
    pw.events.on('fired', () => shots++);
    let press = true;
    // Pressing every other frame for one second at 70 RPM gives at most 2 shots.
    for (let t = 0; t < 1; t += 1 / 60) {
      pw.update(1 / 60, { ...idle, firePressed: press });
      press = !press;
    }
    expect(shots).toBe(2);
  });
});
