import { describe, expect, it } from 'vitest';
import { FPAnimator } from '../src/anim/FPAnimator';
import { fireClip, reloadClip } from '../src/anim/fpClips';
import { WeaponVisual } from '../src/anim/WeaponVisual';
import { AudioManager } from '../src/audio/AudioManager';
import { WEAPONS } from '../src/data/weapons';
import { ViewmodelLayer } from '../src/render/ViewmodelLayer';
import { PlayerWeapons, type WeaponInput } from '../src/weapons/PlayerWeapons';
import { WeaponState } from '../src/weapons/WeaponState';

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

describe('LR-24 bolt action', () => {
  it('fires no faster than the bolt can be worked', () => {
    const pw = new PlayerWeapons({ primary: 'lr24', secondary: 'm1911' });
    pw.start();
    for (let t = 0; t < 1; t += 1 / 60) pw.update(1 / 60, idle);
    let shots = 0;
    pw.events.on('fired', () => shots++);
    let press = true;
    for (let t = 0; t < 2; t += 1 / 60) {
      pw.update(1 / 60, { ...idle, firePressed: press });
      press = !press;
    }
    // 45 RPM: one shot every 1.33 s.
    expect(shots).toBe(2);
  });

  it('works the bolt after each shot: lift, back (case out), forward', () => {
    const v = new WeaponVisual(new WeaponState(WEAPONS.lr24));
    const clip = fireClip(v.ctx, false);
    const channels = clip.tracks.map((t) => t.channel);
    expect(channels).toContain('node.bolt.rot');
    expect(channels).toContain('node.bolt.pos');
    expect(channels).toContain('rightHand.pos');
    expect(clip.events.map((e) => e.name)).toEqual(['cycleBack', 'slideClose']);
    expect(clip.duration).toBeLessThan(60 / WEAPONS.lr24.rpm);
  });

  it('chambers a round with the bolt on an empty reload, without throwing out a case', () => {
    const v = new WeaponVisual(new WeaponState(WEAPONS.lr24));
    const names = reloadClip(v.ctx, 'empty', false).events.map((e) => e.name);
    expect(names).toContain('boltOpen');
    expect(names).not.toContain('cycleBack');
    expect(names).toContain('slideClose');
  });

  it('shows the scope view only when fully aimed', () => {
    const pw = new PlayerWeapons({ primary: 'lr24', secondary: 'm1911' });
    const anim = new FPAnimator(new ViewmodelLayer(), pw, new AudioManager());
    const frame = { dt: 1 / 60, ads: true, sprinting: false, crouchBlend: 0, speed: 0, grounded: true, mouseDx: 0, mouseDy: 0 };
    anim.update({ ...frame, dt: WEAPONS.lr24.adsTime * 0.5 });
    expect(anim.scoped).toBe(false);
    anim.update({ ...frame, dt: WEAPONS.lr24.adsTime });
    expect(anim.scoped).toBe(true);
    anim.dispose();
  });
});
