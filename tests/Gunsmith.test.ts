import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ATTACHMENTS, ATTACHMENT_IDS, COMPATIBLE, GUNSMITH } from '../src/data/attachments';
import { WEAPONS } from '../src/data/weapons';
import { defaultProfile, ProfileStore } from '../src/save/ProfileStore';
import { MemoryStore } from '../src/save/Storage';
import { fitWeapon, validBuild } from '../src/weapons/Gunsmith';
import { buildWeaponModel } from '../src/weapons/models/weaponModels';
import { PlayerWeapons } from '../src/weapons/PlayerWeapons';

const vx4 = WEAPONS.m4a1;
const world = (o: THREE.Object3D): THREE.Vector3 => {
  o.updateWorldMatrix(true, false);
  return o.getWorldPosition(new THREE.Vector3());
};

describe('gunsmith stats', () => {
  it('leaves the weapon unchanged with no attachments', () => {
    const f = fitWeapon(vx4, {});
    expect(f.magazine).toBe(vx4.magazine);
    expect(f.adsTime).toBeCloseTo(vx4.adsTime);
    expect(f.suppressed).toBe(false);
  });

  it('applies each part: 40-round magazine, suppressor, grips', () => {
    expect(fitWeapon(vx4, { magazine: 'extmag' }).magazine).toBe(40);
    const s = fitWeapon(vx4, { muzzle: 'suppressor' });
    expect(s.suppressed).toBe(true);
    expect(s.falloff.end).toBeLessThan(vx4.falloff.end);
    expect(fitWeapon(vx4, { underbarrel: 'vgrip' }).recoil.verticalDeg).toBeLessThan(vx4.recoil.verticalDeg);
    expect(fitWeapon(vx4, { underbarrel: 'agrip' }).adsTime).toBeLessThan(vx4.adsTime);
  });

  it('keeps the slowest build within the aim-time cap', () => {
    const f = fitWeapon(vx4, { optic: 'scope3x', muzzle: 'suppressor', underbarrel: 'vgrip', magazine: 'extmag' });
    expect(f.adsTime).toBeLessThanOrEqual(vx4.adsTime * GUNSMITH.caps.adsTime[1] + 1e-9);
  });

  it('drops parts the weapon cannot take or that sit in the wrong slot', () => {
    expect(validBuild('lr24', { optic: 'reddot' })).toEqual({});
    expect(validBuild('m4a1', { muzzle: 'reddot' } as never)).toEqual({});
    expect(validBuild('m4a1', { optic: 'holo', muzzle: 'nope' } as never)).toEqual({ optic: 'holo' });
  });

  it('every attachment has a model', () => {
    for (const id of ATTACHMENT_IDS) {
      const m = buildWeaponModel('m4a1', 'fp', { [ATTACHMENTS[id].slot]: id });
      expect(m.root.getObjectByName(`att-${id}`) ?? m.nodes.magazine!.getObjectByName('magazine'), id).toBeDefined();
    }
  });
});

describe('gunsmith models', () => {
  const plain = buildWeaponModel('m4a1', 'fp');

  it('an optic folds the rear sight and lines the eye up with the red dot', () => {
    const m = buildWeaponModel('m4a1', 'fp', { optic: 'reddot' });
    expect(m.root.getObjectByName('rearSight')!.rotation.x).toBeLessThan(-1);
    const eye = world(m.points.sightAnchor);
    const hit = new THREE.Raycaster(eye, new THREE.Vector3(0, 0, -1)).intersectObject(m.root, true)[0];
    expect(hit).toBeDefined();
    expect((hit.object as THREE.Mesh).material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('a suppressor hides the flash hider and moves the muzzle forward', () => {
    const m = buildWeaponModel('m4a1', 'fp', { muzzle: 'suppressor' });
    expect(m.root.getObjectByName('muzzleDevice')!.visible).toBe(false);
    expect(world(m.points.muzzle).z).toBeLessThan(world(plain.points.muzzle).z - 0.08);
  });

  it('a grip moves the left hand onto it; an extended magazine is longer', () => {
    const g = buildWeaponModel('m4a1', 'fp', { underbarrel: 'vgrip' });
    expect(world(g.points.leftHandGrip).y).toBeLessThan(world(plain.points.leftHandGrip).y - 0.04);
    const box = (m: typeof plain): THREE.Box3 => new THREE.Box3().setFromObject(m.nodes.magazine!);
    const ext = buildWeaponModel('m4a1', 'fp', { magazine: 'extmag' });
    expect(box(ext).min.y).toBeLessThan(box(plain).min.y - 0.03);
  });

  it('the player gets the fitted weapon', () => {
    const pw = new PlayerWeapons({ primary: 'm4a1', secondary: 'm1911', builds: { m4a1: { magazine: 'extmag' } } });
    pw.start();
    expect(pw.active.mag).toBe(41);
  });
});

describe('gunsmith saves', () => {
  it('round-trips builds and drops invalid ones', () => {
    const mem = new MemoryStore();
    const store = new ProfileStore(mem);
    const p = defaultProfile();
    p.loadout.builds = { m4a1: { optic: 'holo', magazine: 'extmag' } };
    store.save(p);
    expect(store.load().loadout.builds).toEqual({ m4a1: { optic: 'holo', magazine: 'extmag' } });
    mem.setItem('lowfront.profile.v1', JSON.stringify({ loadout: { primary: 'm4a1', secondary: 'm1911', builds: { m4a1: { optic: 'laser' }, xx: {} } } }));
    expect(store.load().loadout.builds).toBeUndefined();
  });
});

describe('respawn with a new build', () => {
  it('counts an attachment change on the same weapon as a new loadout', async () => {
    const { sameLoadout } = await import('../src/scenes/PlaySession');
    const bare = { primary: 'm4a1' as const, secondary: 'm1911' as const };
    expect(sameLoadout(bare, { ...bare })).toBe(true);
    expect(sameLoadout(bare, { ...bare, builds: { m4a1: { optic: 'reddot' } } })).toBe(false);
    expect(sameLoadout({ ...bare, builds: { m4a1: { optic: 'reddot', muzzle: 'suppressor' } } }, { ...bare, builds: { m4a1: { muzzle: 'suppressor', optic: 'reddot' } } })).toBe(true);
  });
});

describe('gunsmith on every gun', () => {
  const ids = Object.keys(COMPATIBLE) as (keyof typeof COMPATIBLE)[];

  it('every compatible part fits on its gun in first and third person', () => {
    for (const id of ids) {
      for (const att of COMPATIBLE[id]!) {
        for (const lod of ['fp', 'tp'] as const) {
          const m = buildWeaponModel(id, lod, { [ATTACHMENTS[att].slot]: att });
          const fitted = m.root.getObjectByName(`att-${att}`) ?? (ATTACHMENTS[att].slot === 'magazine' ? m.nodes.magazine!.getObjectByName('magazine') : undefined);
          expect(fitted, `${id} ${att} ${lod}`).toBeDefined();
        }
      }
    }
  });

  it('bigger magazines add the right rounds per gun', () => {
    expect(fitWeapon(WEAPONS.ak47, { magazine: 'extmag' }).magazine).toBe(40);
    expect(fitWeapon(WEAPONS.sr9, { magazine: 'extmag' }).magazine).toBe(40);
    expect(fitWeapon(WEAPONS.lr24, { magazine: 'extmag' }).magazine).toBe(10);
    expect(fitWeapon(WEAPONS.m1911, { magazine: 'extmag' }).magazine).toBe(10);
    expect(fitWeapon(WEAPONS.br12, { magazine: 'tubeext' }).magazine).toBe(8);
  });

  it('a choke tightens the pellets; a bipod halves recoil when crouched', () => {
    expect(fitWeapon(WEAPONS.br12, { muzzle: 'choke' }).pelletSpreadDeg).toBeCloseTo(WEAPONS.br12.pelletSpreadDeg * 0.7);
    expect(fitWeapon(WEAPONS.lr24, { underbarrel: 'bipod' }).bracedRecoil).toBe(0.5);
    expect(fitWeapon(WEAPONS.lr24, {}).bracedRecoil).toBe(1);
  });

  it('the pistol dot rides on the slide and lines up with the eye', () => {
    const m = buildWeaponModel('m1911', 'fp', { optic: 'minidot' });
    const dot = m.root.getObjectByName('att-minidot')!;
    let onSlide = false;
    for (let p: THREE.Object3D | null = dot; p; p = p.parent) if (p === m.nodes.slide) onSlide = true;
    expect(onSlide).toBe(true);
    const eye = world(m.points.sightAnchor);
    const hit = new THREE.Raycaster(eye, new THREE.Vector3(0, 0, -1)).intersectObject(m.root, true)[0];
    expect((hit.object as THREE.Mesh).material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('a reflex sight keeps the eye distance; only the height changes', () => {
    for (const id of ['m4a1', 'ak47', 'sr9', 'br12'] as const) {
      const plain = world(buildWeaponModel(id, 'fp').points.sightAnchor);
      const dot = world(buildWeaponModel(id, 'fp', { optic: 'reddot' }).points.sightAnchor);
      expect(dot.z, id).toBeCloseTo(plain.z, 5);
      expect(dot.y, id).toBeGreaterThan(plain.y - 0.001);
    }
  });
});
