import * as THREE from 'three';
import { generateCoverPoints, type CoverPoint } from '../ai/CoverPoints';
import { VERDAN } from '../data/map';
import { NavDebug } from '../debug/NavDebug';
import { NavGrid } from '../world/NavGrid';
import { MAP } from '../data/map/config';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { Lighting } from '../render/Lighting';
import { Sky } from '../render/Sky';
import { disposeObject } from '../render/dispose';
import { addVolumeColliders } from '../world/colliders';
import { FlagVisual } from '../world/FlagVisual';
import { getBuiltMap, type BuiltMap } from '../world/MapBuilder';
import { SoldierCrowd } from './SoldierCrowd';
import type { World } from './World';

/** The "Verdan District" urban map (plan section 10) as a playable world. */
export class CityMap implements World {
  readonly scene = new THREE.Scene();
  readonly spawn: { position: THREE.Vector3; yaw: number };
  readonly limit = MAP.half;
  readonly built: BuiltMap;
  readonly flags: FlagVisual[];
  /** Precomputed at load for the bots (Phase 8). */
  readonly nav: NavGrid;
  readonly cover: CoverPoint[];
  /** Phase 6 performance test: 32 soldiers (replaced by the match in Phase 7). */
  readonly crowd: SoldierCrowd;
  private navDebug: NavDebug | null = null;
  private readonly lighting: Lighting;
  private readonly sky = new Sky();

  constructor(physics: PhysicsWorld) {
    this.built = getBuiltMap(VERDAN);
    this.scene.add(this.built.group.clone());
    addVolumeColliders(physics, this.built.volumes);
    this.nav = new NavGrid(this.built.volumes, this.built.links, VERDAN.half);
    this.cover = generateCoverPoints(this.built.volumes, this.nav);
    this.lighting = new Lighting(this.scene);
    this.scene.add(this.sky.mesh);
    this.flags = VERDAN.flags.map((f) => new FlagVisual(f));
    for (const f of this.flags) this.scene.add(f.root);
    this.crowd = new SoldierCrowd(physics, this.scene, this.nav, VERDAN);
    const s = VERDAN.hqs[0].spawns[3];
    this.spawn = { position: new THREE.Vector3(s.x, 0, s.z), yaw: s.yaw };
  }

  follow(pos: THREE.Vector3): void {
    this.lighting.follow(pos);
  }

  fixedUpdate(dt: number): void {
    this.crowd.fixedUpdate(dt);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.sky.follow(camera);
    this.crowd.update(dt, camera);
    for (const f of this.flags) f.update(dt);
  }

  toggleNavDebug(): void {
    if (!this.navDebug) {
      this.navDebug = new NavDebug(this.nav, this.cover);
      this.scene.add(this.navDebug.root);
    }
    this.navDebug.toggle();
  }

  dispose(): void {
    this.crowd.dispose();
    disposeObject(this.scene);
    this.sky.dispose();
  }
}
