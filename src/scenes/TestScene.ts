import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { State } from '../core/StateMachine';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { TEST_SCENE as CFG } from '../data/testScene';
import { PALETTE } from '../data/palette';
import { disposeObject } from '../render/dispose';

/** Phase 0 test scene: ground, static boxes and a falling physics box. */
export class TestScene implements State {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private box!: THREE.Mesh;
  private boxBody!: RAPIER.RigidBody;
  private prevPos = new THREE.Vector3();
  private prevRot = new THREE.Quaternion();
  private currPos = new THREE.Vector3();
  private currRot = new THREE.Quaternion();
  private dropTimer = 0;
  private orbitAngle = 0;
  private orbitRadius: number;

  constructor(private readonly physics: PhysicsWorld) {
    const c = CFG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 1, c.near, c.far);
    this.orbitRadius = Math.hypot(c.position[0], c.position[2]);
    this.orbitAngle = Math.atan2(c.position[0], c.position[2]);
    this.build();
  }

  enter(): void {
    this.drop();
  }

  fixedUpdate(dt: number): void {
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
    this.physics.step();
    this.readBody();

    this.dropTimer += dt;
    if (this.dropTimer >= CFG.dropInterval || this.currPos.y < CFG.resetHeight) this.drop();
  }

  update(dt: number, alpha: number): void {
    this.box.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.box.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);

    this.orbitAngle += CFG.cameraOrbitSpeed * dt;
    const c = CFG.camera;
    this.camera.position.set(
      Math.sin(this.orbitAngle) * this.orbitRadius,
      c.position[1],
      Math.cos(this.orbitAngle) * this.orbitRadius,
    );
    this.camera.lookAt(c.lookAt[0], c.lookAt[1], c.lookAt[2]);
  }

  dispose(): void {
    disposeObject(this.scene);
  }

  private build(): void {
    const { rapier, world } = this.physics;
    this.scene.background = new THREE.Color(PALETTE.skyTop);
    this.scene.fog = new THREE.Fog(PALETTE.skyHorizon, CFG.fogNear, CFG.fogFar);

    const hemi = new THREE.HemisphereLight(CFG.hemi.sky, CFG.hemi.ground, CFG.hemi.intensity);
    const sun = new THREE.DirectionalLight(CFG.sun.color, CFG.sun.intensity);
    sun.position.set(...CFG.sun.position);
    sun.castShadow = true;
    sun.shadow.mapSize.set(CFG.sun.shadowMapSize, CFG.sun.shadowMapSize);
    const e = CFG.sun.shadowExtent;
    Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e });
    this.scene.add(hemi, sun);

    const half = CFG.groundSize / 2;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize).rotateX(-Math.PI / 2),
      flat(CFG.groundColor),
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    world.createCollider(rapier.ColliderDesc.cuboid(half, 0.1, half).setTranslation(0, -0.1, 0));

    for (const b of CFG.staticBoxes) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]), flat(b.color));
      mesh.position.set(b.position[0], b.position[1], b.position[2]);
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      world.createCollider(
        rapier.ColliderDesc.cuboid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2).setTranslation(b.position[0], b.position[1], b.position[2]),
      );
    }

    const s = CFG.fallingBox.size;
    this.box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), flat(CFG.fallingBox.color));
    this.box.castShadow = true;
    this.scene.add(this.box);
    this.boxBody = world.createRigidBody(rapier.RigidBodyDesc.dynamic());
    world.createCollider(rapier.ColliderDesc.cuboid(s / 2, s / 2, s / 2), this.boxBody);
  }

  private drop(): void {
    this.dropTimer = 0;
    this.boxBody.setTranslation(vec(CFG.fallingBox.startPosition), true);
    this.boxBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.boxBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.boxBody.setAngvel(vec(CFG.fallingBox.spin), true);
    this.readBody();
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
  }

  private readBody(): void {
    const t = this.boxBody.translation();
    const r = this.boxBody.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currRot.set(r.x, r.y, r.z, r.w);
  }
}

function flat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
}

function vec(v: readonly [number, number, number]): { x: number; y: number; z: number } {
  return { x: v[0], y: v[1], z: v[2] };
}
