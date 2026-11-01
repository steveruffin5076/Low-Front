import * as THREE from 'three';
import { ATTACHMENTS, GUNSMITH, type WeaponBuild } from '../../data/attachments';
import { applyGameMaterials } from './glbWeapon';
import { instantiate } from './modelLibrary';
import type { WeaponModel } from './WeaponModel';

const tmp = new THREE.Vector3();

/** Position of `name` inside `att`, in the space of `space` (the weapon's content group). */
function pointIn(att: THREE.Object3D, name: string, space: THREE.Object3D): THREE.Vector3 | null {
  const p = att.getObjectByName(name);
  if (!p) return null;
  return space.worldToLocal(p.getWorldPosition(tmp)).clone();
}

/**
 * Puts the attachments of `build` on a Blender-built weapon: each part sits on its mount; an optic
 * folds the rear sight down and moves the sight line, a muzzle device replaces the flash hider and
 * moves the muzzle, a grip moves the left hand, an extended magazine replaces the magazine.
 */
export function fitAttachments(model: WeaponModel, build: WeaponBuild): void {
  const mounts = model.mounts;
  if (!mounts) return;
  const content = model.points.rightHandGrip.parent!;
  model.root.updateMatrixWorld(true);
  for (const [slot, id] of Object.entries(build) as [keyof WeaponBuild, string][]) {
    const def = ATTACHMENTS[id as keyof typeof ATTACHMENTS];
    const mount = mounts[slot];
    if (!def || !mount) continue;
    const att = instantiate(`attachments/${id}`);
    applyGameMaterials(att);
    att.name = `att-${id}`;

    if (slot === 'magazine') {
      // Replaces the magazine node's meshes, so the reload clips move the new one.
      const node = model.nodes.magazine;
      const part = att.getObjectByName('magazine');
      if (!node || !part) continue;
      for (const c of [...node.children]) c.removeFromParent();
      part.position.set(0, 0, 0);
      node.add(part);
      continue;
    }
    mount.add(att);
    att.updateMatrixWorld(true);
    if (slot === 'optic') {
      const rear = content.getObjectByName('rearSight');
      if (rear) rear.rotation.x = -Math.PI / 2;
      const line = pointIn(att, 'pt_sightLine', content);
      if (line) {
        const relief = def.optic?.scope ? GUNSMITH.eyeRelief.scope : GUNSMITH.eyeRelief.reflex;
        model.points.sightAnchor.position.set(line.x, line.y, line.z + relief);
      }
    } else if (slot === 'muzzle') {
      const device = content.getObjectByName('muzzleDevice');
      if (device) device.visible = false;
      const tip = pointIn(att, 'pt_muzzle', content);
      if (tip) model.points.muzzle.position.copy(tip);
    } else if (slot === 'underbarrel') {
      const hand = pointIn(att, 'pt_leftHandGrip', content);
      if (hand) model.points.leftHandGrip.position.copy(hand);
    }
  }
  model.root.updateMatrixWorld(true);
}
