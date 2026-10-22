import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AudioManager } from '../src/audio/AudioManager';
import { WEAPONS } from '../src/data/weapons';
import { PlayerHitboxes } from '../src/entities/PlayerHitboxes';
import { Combat, type CombatHit } from '../src/game/Combat';
import type { ZoneHit } from '../src/physics/collision';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

let physics: PhysicsWorld;
beforeAll(async () => {
  physics = await PhysicsWorld.create();
});

function setup() {
  const combat = new Combat(physics, new THREE.Scene(), new AudioManager());
  const hits: CombatHit[] = [];
  combat.events.on('hit', (h) => hits.push(h));
  const taken: ZoneHit[] = [];
  const target = (x: number, team: 'blue' | 'red', id: string) => {
    const t = new PlayerHitboxes(physics, id, team, id, (h) => taken.push(h));
    t.follow(new THREE.Vector3(x, 0, 0), 0, 0);
    return t;
  };
  const run = (): void => {
    physics.world.step();
    for (let i = 0; i < 30; i++) {
      combat.fixedUpdate(1 / 60);
      physics.world.step();
    }
  };
  return { combat, hits, taken, target, run };
}

describe('shared combat', () => {
  it('passes through the shooter’s own hitboxes and hits the enemy behind', () => {
    const { combat, hits, taken, target, run } = setup();
    const me = target(100, 'blue', 'me');
    target(100, 'red', 'enemy-far').follow(new THREE.Vector3(100, 0, -20), 0, 0);
    // Fired from inside my own torso, straight ahead (−Z).
    combat.ballistics.fire(new THREE.Vector3(100, 1.2, 0), new THREE.Vector3(0, 0, -1), WEAPONS.m4a1, false, new THREE.Vector3(), { id: 'me', team: 'blue', owner: me });
    run();
    expect(hits).toHaveLength(1);
    expect(hits[0].target.combatantId).toBe('enemy-far');
    expect(hits[0].damage).toBeGreaterThan(0);
    expect(taken[0].attackerId).toBe('me');
    expect(taken[0].weapon).toBe('M4A1');
  });

  it('stops on a teammate but does no damage', () => {
    const { combat, hits, taken, target, run } = setup();
    const me = target(200, 'blue', 'me');
    target(200, 'blue', 'mate').follow(new THREE.Vector3(200, 0, -10), 0, 0);
    combat.ballistics.fire(new THREE.Vector3(200, 1.2, 0), new THREE.Vector3(0, 0, -1), WEAPONS.ak47, false, new THREE.Vector3(), { id: 'me', team: 'blue', owner: me });
    run();
    expect(hits).toHaveLength(1);
    expect(hits[0].friendly).toBe(true);
    expect(hits[0].damage).toBe(0);
    expect(taken).toHaveLength(0);
  });
});
