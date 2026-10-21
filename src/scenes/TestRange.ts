import * as THREE from 'three';
import { TEST_RANGE as CFG, type RangeBox } from '../data/testRange';
import { PALETTE, UI_PALETTE } from '../data/palette';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { paletteMaterial } from '../render/Materials';
import { disposeObject } from '../render/dispose';

/** Builds the Phase 3 test range (meshes and static colliders) from `data/testRange.ts`. */
export class TestRange {
  readonly scene = new THREE.Scene();
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

  dispose(): void {
    disposeObject(this.scene);
  }

  private build(): void {
    const { rapier, world } = this.physics;
    const half = CFG.groundSize / 2;
    this.addMesh(new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize).rotateX(-Math.PI / 2), CFG.groundColor, [0, 0, 0]);
    world.createCollider(rapier.ColliderDesc.cuboid(half, 0.5, half).setTranslation(0, -0.5, 0));

    // Lane strip with distance posts every 10 m.
    const lane = CFG.lane;
    this.addMesh(
      new THREE.PlaneGeometry(lane.width, lane.length).rotateX(-Math.PI / 2),
      CFG.laneColor,
      [0, 0.01, CFG.spawn[2] - lane.length / 2],
    ).castShadow = false;
    for (let d = 10; d <= lane.length - 10; d += 10) {
      const color = (CFG.dummyDistances as readonly number[]).includes(d) ? PALETTE.mustard : PALETTE.cream;
      this.addMesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), color, [lane.width / 2 + 0.3, 0.3, -d]);
    }

    for (const b of CFG.boxes) this.addBox(b);
    for (const d of CFG.dummyDistances) this.addDummy(new THREE.Vector3(0, 0, -d));
  }

  private addBox(b: RangeBox): void {
    const { rapier, world } = this.physics;
    const mesh = this.addMesh(new THREE.BoxGeometry(...b.size), b.color, b.pos);
    const q = new THREE.Quaternion();
    if (b.tiltDeg) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(b.tiltDeg));
    mesh.quaternion.copy(q);
    world.createCollider(
      rapier.ColliderDesc.cuboid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2)
        .setTranslation(b.pos[0], b.pos[1], b.pos[2])
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
  }

  /** Simple standing target figure (~1.8 m) facing the spawn. Hitboxes come in Phase 4. */
  private addDummy(at: THREE.Vector3): void {
    const { rapier, world } = this.physics;
    const parts: { size: [number, number, number]; pos: [number, number, number]; color: number }[] = [
      { size: [0.18, 0.85, 0.2], pos: [-0.11, 0.425, 0], color: CFG.dummyColor },
      { size: [0.18, 0.85, 0.2], pos: [0.11, 0.425, 0], color: CFG.dummyColor },
      { size: [0.46, 0.6, 0.26], pos: [0, 1.15, 0], color: CFG.dummyColor },
      { size: [0.12, 0.55, 0.12], pos: [-0.3, 1.15, 0], color: CFG.dummyColor },
      { size: [0.12, 0.55, 0.12], pos: [0.3, 1.15, 0], color: CFG.dummyColor },
      { size: [0.22, 0.24, 0.22], pos: [0, 1.6, 0], color: UI_PALETTE.skin },
      { size: [0.26, 0.1, 0.26], pos: [0, 1.74, 0], color: UI_PALETTE.vest },
    ];
    for (const p of parts) this.addMesh(new THREE.BoxGeometry(...p.size), p.color, [at.x + p.pos[0], p.pos[1], at.z + p.pos[2]]);
    // Stand and one blocking collider so the player cannot walk through.
    this.addMesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), PALETTE.slate, [at.x, 0.025, at.z]);
    world.createCollider(rapier.ColliderDesc.cuboid(0.3, 0.9, 0.15).setTranslation(at.x, 0.9, at.z));
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
