import * as THREE from 'three';
import { VERDAN } from '../data/map';
import { MAP } from '../data/map/config';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Lighting } from '../render/Lighting';
import { Sky } from '../render/Sky';
import { disposeObject } from '../render/dispose';
import { addVolumeColliders } from '../world/colliders';
import { FlagVisual } from '../world/FlagVisual';
import { getBuiltMap, type BuiltMap } from '../world/MapBuilder';
import type { World } from './World';

/** The "Verdan District" urban map (plan section 10) as a playable world. */
export class CityMap implements World {
  readonly scene = new THREE.Scene();
  readonly spawn: { position: THREE.Vector3; yaw: number };
  readonly limit = MAP.half;
  readonly built: BuiltMap;
  readonly flags: FlagVisual[];
  private readonly lighting: Lighting;
  private readonly sky = new Sky();

  constructor(physics: PhysicsWorld) {
    this.built = getBuiltMap(VERDAN);
    this.scene.add(this.built.group.clone());
    addVolumeColliders(physics, this.built.volumes);
    this.lighting = new Lighting(this.scene);
    this.scene.add(this.sky.mesh);
    this.flags = VERDAN.flags.map((f) => new FlagVisual(f));
    for (const f of this.flags) this.scene.add(f.root);
    const s = VERDAN.hqs[0].spawns[3];
    this.spawn = { position: new THREE.Vector3(s.x, 0, s.z), yaw: s.yaw };
  }

  follow(pos: THREE.Vector3): void {
    this.lighting.follow(pos);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.sky.follow(camera);
    for (const f of this.flags) f.update(dt);
  }

  dispose(): void {
    disposeObject(this.scene);
    this.sky.dispose();
  }
}
