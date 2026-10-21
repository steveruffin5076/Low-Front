import * as THREE from 'three';
import { PREVIEW } from '../../data/menu';
import type { WeaponDef } from '../../data/weapons';
import { disposeObject } from '../../render/dispose';
import { addPreviewLights, type PreviewRenderer } from '../../render/PreviewRenderer';
import { buildPlaceholderWeapon } from '../../weapons/models/PlaceholderWeapon';
import { STAT_BAR_LABELS, magazineLabel, statBars, type StatBarName } from '../../weapons/WeaponStats';
import { el } from '../dom';

const CFG = PREVIEW.weapon;

/** Weapon card: name, turning 3D preview, stat bars and magazine size. */
export class WeaponCard {
  readonly element: HTMLButtonElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.05, 20);
  private readonly model: THREE.Group;
  /** Model size in meters, used to fit the camera. */
  private readonly size: THREE.Vector3;
  private time = 0;
  private fittedAspect = 0;

  constructor(weapon: WeaponDef, selected: boolean, onSelect: () => void) {
    addPreviewLights(this.scene);
    this.model = buildPlaceholderWeapon(weapon.id);
    // Center the model on a pivot so it sways around its middle.
    const bounds = new THREE.Box3().setFromObject(this.model);
    this.model.position.sub(bounds.getCenter(new THREE.Vector3()));
    this.size = bounds.getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.add(this.model);
    this.scene.add(pivot);

    this.canvas = el('canvas', { class: 'weapon-canvas' });
    const bars = statBars(weapon);
    this.element = el(
      'button',
      {
        class: `weapon-card${selected ? ' selected' : ''}`,
        attrs: { type: 'button', 'aria-pressed': String(selected) },
        on: { click: onSelect },
      },
      [
        el('div', { class: 'weapon-card-name', text: weapon.name }),
        this.canvas,
        el(
          'div',
          { class: 'stat-list' },
          (Object.keys(STAT_BAR_LABELS) as StatBarName[]).map((k) => statRow(STAT_BAR_LABELS[k], bars[k])),
        ),
        el('div', { class: 'stat-mag' }, [
          el('span', { text: 'Magazine' }),
          el('span', { class: 'stat-mag-value', text: magazineLabel(weapon) }),
        ]),
      ],
    );
  }

  update(dt: number): void {
    this.time += dt;
    // Barrel points along +Z; rotating by +90° shows the right side with the muzzle to the right.
    const pivot = this.model.parent;
    if (pivot) pivot.rotation.y = Math.PI / 2 + Math.sin(this.time * CFG.swaySpeed) * CFG.swayAngle;
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

function statRow(label: string, value: number): HTMLElement {
  const fill = el('div', { class: 'stat-fill' });
  fill.style.width = `${Math.round(value * 100)}%`;
  return el('div', { class: 'stat-row' }, [
    el('span', { class: 'stat-label', text: label }),
    el('div', { class: 'stat-track' }, [fill]),
  ]);
}
