import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeaponVisual } from '../src/anim/WeaponVisual';
import { HARBOR } from '../src/data/map/harbor';
import { MAPS } from '../src/data/map/maps';
import { SETUP_MAPS, validSetup } from '../src/data/matchSetup';
import { WEAPONS } from '../src/data/weapons';
import { fitWeapon } from '../src/weapons/Gunsmith';
import { WeaponState } from '../src/weapons/WeaponState';
import { ScopeGlints, scoped } from '../src/world/ScopeGlint';
import type { Bot } from '../src/entities/Bot';

describe('grip hand pose', () => {
  it('a vertical foregrip gives the left hand its own grip; other builds keep the handguard hold', () => {
    expect(new WeaponVisual(new WeaponState(fitWeapon(WEAPONS.m4a1, { underbarrel: 'vgrip' }))).leftStyle).toBe('vgrip');
    expect(new WeaponVisual(new WeaponState(fitWeapon(WEAPONS.m4a1, { underbarrel: 'agrip' }))).leftStyle).toBe('handguard');
    expect(new WeaponVisual(new WeaponState(WEAPONS.m1911)).leftStyle).toBe('support');
  });
});

/** A stand-in bot: position, eye, aim target and the weapon in hand. */
function fakeBot(def: (typeof WEAPONS)[keyof typeof WEAPONS], target: string | null, at: THREE.Vector3): Bot {
  return { alive: true, position: at, eye: at.clone().setY(1.6), aim: { targetId: target }, weapons: { active: { def } } } as unknown as Bot;
}

describe('scope glint', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);

  it('shows on a scoped enemy aiming at the player, not on others', () => {
    const g = new ScopeGlints();
    const sniper = fakeBot(WEAPONS.lr24, 'player', new THREE.Vector3(0, 0, -80));
    const rifle = fakeBot(WEAPONS.m4a1, 'player', new THREE.Vector3(10, 0, -80));
    const elsewhere = fakeBot(WEAPONS.lr24, 'bot-3', new THREE.Vector3(-10, 0, -80));
    const scopedRifle = fakeBot(fitWeapon(WEAPONS.ak47, { optic: 'scope3x' }), 'player', new THREE.Vector3(20, 0, -90));
    g.update(1 / 60, [sniper, rifle, elsewhere, scopedRifle], 'player', camera);
    const visible = g.root.children.filter((c) => c.visible);
    expect(visible.length).toBe(2);
    expect(scoped(rifle)).toBe(false);
    // Sits just in front of the sniper's eye, toward the camera.
    expect(visible[0].position.z).toBeGreaterThan(-80);
  });
});

describe('second map', () => {
  it('is selectable and registered', () => {
    expect(Object.keys(SETUP_MAPS)).toEqual(['verdan', 'harbor']);
    expect(MAPS.harbor).toBe(HARBOR);
    expect(validSetup({ map: 'harbor' }).map).toBe('harbor');
  });
});
