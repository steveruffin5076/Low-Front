import * as THREE from 'three';
import { PREVIEW } from '../../data/menu';
import type { WeaponId } from '../../data/weapons';
import { PlaceholderSoldier } from '../../entities/PlaceholderSoldier';
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
  private readonly soldier = new PlaceholderSoldier();
  private time = 0;
  private yaw = 0;
  private dragX: number | null = null;

  constructor(weapon: WeaponId) {
    addPreviewLights(this.scene);
    this.scene.add(this.soldier.root);
    this.soldier.setWeapon(weapon);
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

  setWeapon(id: WeaponId): void {
    this.soldier.setWeapon(id);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.dragX === null) this.yaw += CFG.autoRotateSpeed * dt;
    this.soldier.root.rotation.y = this.yaw;
    this.soldier.idle(this.time, CFG.breathRate, CFG.breathAmount, CFG.swayAmount);
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
