import * as THREE from 'three';
import { TEST_RANGE as CFG, type RangeBox } from '../data/testRange';
import { PALETTE } from '../data/palette';
import { DUMMY } from '../data/testRange';
import { TargetDummy } from '../entities/TargetDummy';
import { COLLISION, type Surface } from '../physics/collision';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { World } from './World';
import { paletteMaterial } from '../render/Materials';
import { disposeObject } from '../render/dispose';

/** Builds the test range (meshes and static colliders) from `data/testRange.ts`. */
export class TestRange implements World {
  readonly scene = new THREE.Scene();
  readonly spawn = { position: new THREE.Vector3(...CFG.spawn), yaw: 0 };
  readonly limit = null;
  readonly dummies: TargetDummy[] = [];
  private readonly sun: THREE.DirectionalLight;

  constructor(private readonly physics: PhysicsWorld) {
    this.scene.background = new THREE.Color(CFG.sky);
    this.scene.fog = new THREE.Fog(CFG.sky, CFG.fogNear, CFG.fogFar);
    this.scene.add(new THREE.HemisphereLight(CFG.hemi.sky, CFG.hemi.ground, CFG.hemi.intensity));
    this.sun = new THREE.DirectionalLight(CFG.sun.color, CFG.sun.intensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(CFG.sun.shadowMapSize, CFG.sun.shadowMapSize);
    const e = CFG.sun.shadowExtent;
    Object.assign(this.sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 150 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun, this.sun.target);
    this.build();
  }

  /** The shadow camera follows the player so shadows stay sharp nearby. */
  follow(pos: THREE.Vector3): void {
    this.sun.target.position.copy(pos);
    this.sun.position.set(pos.x + CFG.sun.offset[0], pos.y + CFG.sun.offset[1], pos.z + CFG.sun.offset[2]);
  }

  update(dt: number, _camera?: THREE.Camera): void {
    for (const d of this.dummies) d.update(dt);
  }

  dispose(): void {
    disposeObject(this.scene);
  }

  private build(): void {
    const { rapier, world } = this.physics;
    const half = CFG.groundSize / 2;
    this.addMesh(new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize).rotateX(-Math.PI / 2), CFG.groundColor, [0, 0, 0]);
    this.tag(world.createCollider(rapier.ColliderDesc.cuboid(half, 0.5, half).setTranslation(0, -0.5, 0).setCollisionGroups(COLLISION.world)), CFG.groundSurface);

    // Lane strip with distance posts every 10 m.
    const lane = CFG.lane;
    this.addMesh(
      new THREE.PlaneGeometry(lane.width, lane.length).rotateX(-Math.PI / 2),
      CFG.laneColor,
      [0, 0.01, CFG.spawn[2] - lane.length / 2],
    ).castShadow = false;
    for (let d = 10; d <= lane.length - 10; d += 10) {
      const color = CFG.dummies.some((t) => t.distance === d) ? PALETTE.mustard : PALETTE.cream;
      this.addMesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), color, [lane.width / 2 + 0.3, 0.3, -d]);
    }

    for (const b of CFG.boxes) this.addBox(b);
    for (const t of CFG.dummies) {
      const at = new THREE.Vector3(t.x, 0, CFG.spawn[2] - t.distance);
      const dummy = new TargetDummy(this.physics, at, t.distance);
      this.dummies.push(dummy);
      this.scene.add(dummy.root);
      this.addMesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), DUMMY.standColor, [at.x, 0.025, at.z]);
    }
  }

  private addBox(b: RangeBox): void {
    const { rapier, world } = this.physics;
    const mesh = this.addMesh(new THREE.BoxGeometry(...b.size), b.color, b.pos);
    const q = new THREE.Quaternion();
    if (b.tiltDeg) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(b.tiltDeg));
    mesh.quaternion.copy(q);
    const collider = world.createCollider(
      rapier.ColliderDesc.cuboid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2)
        .setTranslation(b.pos[0], b.pos[1], b.pos[2])
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(COLLISION.world),
    );
    this.tag(collider, b.surface ?? 'concrete');
  }

  private tag(collider: { handle: number }, surface: Surface): void {
    this.physics.tags.set(collider.handle, { kind: 'surface', surface });
  }

  private addMesh(geo: THREE.BufferGeometry, color: number, pos: readonly [number, number, number]): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, paletteMaterial(color));
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }
}
