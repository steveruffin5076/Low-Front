import * as THREE from 'three';
import { PREVIEW } from '../../data/menu';
import { DEFAULT_LOADOUT, type WeaponId } from '../../data/weapons';
import { IDLE_INPUT, SoldierAnimator } from '../../anim/SoldierAnimator';
import { SoldierModel } from '../../entities/soldier/SoldierModel';
import { SoldierRig } from '../../entities/soldier/SoldierRig';
import { disposeObject } from '../../render/dispose';
import { addPreviewLights, type PreviewRenderer } from '../../render/PreviewRenderer';
import { el } from '../dom';

const CFG = PREVIEW.soldier;

/** Center 3D preview: the player's soldier, idle, slowly turning. Mouse drag rotates it. */
export class SoldierPreview {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.1, 50);
  private soldier!: SoldierModel;
  private rig!: SoldierRig;
  private readonly anim = new SoldierAnimator();
  /** The soldier faces −Z; start turned toward the camera. */
  private yaw = Math.PI;
  private dragX: number | null = null;

  constructor(weapon: WeaponId) {
    addPreviewLights(this.scene);
    this.setWeapon(weapon);
    this.camera.position.set(0, CFG.cameraHeight, CFG.cameraDistance);
    this.camera.lookAt(0, CFG.lookHeight, 0);

    this.canvas = el('canvas', { class: 'soldier-canvas' });
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.element = el('div', { class: 'soldier-preview' }, [
      this.canvas,
      el('p', { class: 'preview-hint', text: 'Drag to rotate' }),
    ]);
  }

  /** The player's soldier (Blue team) holding the selected primary. */
  setWeapon(id: WeaponId): void {
    if (this.soldier) this.soldier.dispose();
    this.soldier = new SoldierModel('blue', { primary: id, secondary: DEFAULT_LOADOUT.secondary });
    this.rig = new SoldierRig(this.soldier);
    this.scene.add(this.soldier.root);
  }

  update(dt: number): void {
    if (this.dragX === null) this.yaw += CFG.autoRotateSpeed * dt;
    this.soldier.root.rotation.y = this.yaw;
    this.soldier.root.updateWorldMatrix(true, false);
    this.rig.apply(this.anim.update(dt, IDLE_INPUT));
  }

  draw(preview: PreviewRenderer): void {
    preview.draw(this.scene, this.camera, this.canvas);
  }

  dispose(): void {
    disposeObject(this.scene);
  }

  private onDown = (e: PointerEvent): void => {
    this.dragX = e.clientX;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (this.dragX === null) return;
    this.yaw += (e.clientX - this.dragX) * CFG.dragSensitivity;
    this.dragX = e.clientX;
  };

  private onUp = (e: PointerEvent): void => {
    this.dragX = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  };
}
