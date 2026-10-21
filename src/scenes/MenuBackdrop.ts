import * as THREE from 'three';
import { VERDAN } from '../data/map';
import { MENU_BACKDROP as CFG } from '../data/menu';
import { Lighting } from '../render/Lighting';
import { Sky } from '../render/Sky';
import { FlagVisual } from '../world/FlagVisual';
import { getBuiltMap } from '../world/MapBuilder';

/** Slow camera fly-over of the real map behind the main menu (plan section 5.1). Visual only. */
export class MenuBackdrop {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly sky = new Sky();
  private readonly lighting: Lighting;
  private readonly flags: FlagVisual[];
  private angle = CFG.camera.startAngle;
  private readonly shadowCenter = new THREE.Vector3();

  constructor() {
    const c = CFG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 1, c.near, c.far);
    this.scene.add(getBuiltMap(VERDAN).group.clone(), this.sky.mesh);
    this.lighting = new Lighting(this.scene);
    this.flags = VERDAN.flags.map((f) => new FlagVisual(f));
    for (const f of this.flags) this.scene.add(f.root);
    this.update(0);
  }

  update(dt: number): void {
    const c = CFG.camera;
    this.angle += c.orbitSpeed * dt;
    this.camera.position.set(Math.sin(this.angle) * c.orbitRadius, c.height, Math.cos(this.angle) * c.orbitRadius);
    this.camera.lookAt(0, c.lookHeight, 0);
    this.sky.follow(this.camera);
    // Keep the sharp-shadow area between the camera and the map center.
    this.lighting.follow(this.shadowCenter.set(Math.sin(this.angle) * c.orbitRadius * 0.4, 0, Math.cos(this.angle) * c.orbitRadius * 0.4));
    for (const f of this.flags) f.update(dt);
  }
}
