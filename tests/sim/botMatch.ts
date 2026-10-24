import * as THREE from 'three';
import { generateCoverPoints } from '../../src/ai/CoverPoints';
import { AudioManager } from '../../src/audio/AudioManager';
import { VERDAN } from '../../src/data/map';
import { BotManager } from '../../src/game/BotManager';
import { Combat } from '../../src/game/Combat';
import { ConquestMatch } from '../../src/game/ConquestMatch';
import { SpawnSystem } from '../../src/game/SpawnSystem';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld';
import { addVolumeColliders } from '../../src/world/colliders';
import { buildMap } from '../../src/world/MapBuilder';
import { NavGrid } from '../../src/world/NavGrid';

/** A headless Conquest match with bots only: real physics, nav, bullets and damage. */
export async function createBotMatch(seed = 7) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const built = buildMap(VERDAN);
  const nav = new NavGrid(built.volumes, built.links, VERDAN.half);
  const cover = generateCoverPoints(built.volumes, nav);
  const physics = await PhysicsWorld.create();
  addVolumeColliders(physics, built.volumes);
  const scene = new THREE.Scene();
  const audio = new AudioManager();
  const combat = new Combat(physics, scene, audio);
  const match = new ConquestMatch(VERDAN);
  const spawns = new SpawnSystem(VERDAN);
  const bots = new BotManager({ physics, scene, combat, audio, nav, cover, match, map: VERDAN, spawns, player: null, rand });
  // Kills reach the match from the combat hits, as in the game.
  combat.events.on('hit', (h) => {
    if (h.kill && h.target.combatantId) {
      match.reportDeath({ victimId: h.target.combatantId, killerId: h.shooter?.id, weapon: h.weapon, headshot: h.zone === 'head', distance: h.distance });
    }
  });
  const camera = new THREE.Vector3(0, 300, 0);
  const DT = 1 / 60;
  const step = (): void => {
    bots.fixedUpdate(DT);
    combat.fixedUpdate(DT);
    match.update(DT);
    physics.world.step();
    bots.update(DT, camera);
  };
  return { physics, nav, combat, match, bots, step, DT };
}
