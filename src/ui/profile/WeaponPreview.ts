import * as THREE from 'three';
import type { WeaponBuild } from '../../data/attachments';
import { PREVIEW } from '../../data/menu';
import type { WeaponId } from '../../data/weapons';
import { disposeObject } from '../../render/dispose';
import { addPreviewLights, type PreviewRenderer } from '../../render/PreviewRenderer';
import { buildWeaponModel } from '../../weapons/models/weaponModels';
import { el } from '../dom';

const CFG = PREVIEW.weapon;

/** A weapon (with attachments) turning gently in a canvas: weapon cards and the gunsmith. */
export class WeaponPreview {
  readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.05, 20);
  private readonly pivot = new THREE.Group();
  private model: THREE.Group | null = null;
  /** Model size in meters, used to fit the camera. */
  private size = new THREE.Vector3();
  private time = 0;
  private fittedAspect = 0;

  constructor(id: WeaponId, build: WeaponBuild = {}, cls = 'weapon-canvas') {
    addPreviewLights(this.scene);
    this.scene.add(this.pivot);
    this.canvas = el('canvas', { class: cls });
    this.show(id, build);
  }

  /** Replaces the model, e.g. after an attachment change. */
  show(id: WeaponId, build: WeaponBuild): void {
    if (this.model) {
      this.model.removeFromParent();
      disposeObject(this.model);
    }
    this.model = buildWeaponModel(id, 'fp', build).root;
    // Center the model on the pivot so it sways around its middle.
    const bounds = new THREE.Box3().setFromObject(this.model);
    this.model.position.sub(bounds.getCenter(new THREE.Vector3()));
    this.size = bounds.getSize(new THREE.Vector3());
    this.pivot.add(this.model);
    this.fittedAspect = 0;
  }

  update(dt: number): void {
    this.time += dt;
    // The muzzle points along −Z; rotating by −90° shows the right side with the muzzle to the right.
    this.pivot.rotation.y = -Math.PI / 2 + Math.sin(this.time * CFG.swaySpeed) * CFG.swayAngle;
  }

  draw(preview: PreviewRenderer): void {
    const aspect = this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1);
    if (aspect !== this.fittedAspect) this.fitCamera(aspect);
    preview.draw(this.scene, this.camera, this.canvas);
  }

  dispose(): void {
    disposeObject(this.scene);
  }

  /** Moves the camera back until the model fits both the width and the height of the canvas. */
  private fitCamera(aspect: number): void {
    this.fittedAspect = aspect;
    const halfV = THREE.MathUtils.degToRad(CFG.fov) / 2;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    // Seen from the side, the weapon's length (Z) spans the width and its height (Y) spans the height.
    const halfLength = (Math.max(this.size.z, this.size.x) / 2) * CFG.fitMargin;
    const halfHeight = (this.size.y / 2) * CFG.fitMargin;
    const distance = Math.max(halfLength / Math.tan(halfH), halfHeight / Math.tan(halfV)) + this.size.x / 2;
    this.camera.position.set(0, Math.sin(CFG.cameraPitch) * distance, Math.cos(CFG.cameraPitch) * distance);
    this.camera.lookAt(0, 0, 0);
  }
}
