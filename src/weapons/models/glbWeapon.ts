import * as THREE from 'three';
import { instantiate } from './modelLibrary';
import { ATTACHMENT_NAMES, MOUNT_SLOTS, type AttachmentName, type MountSlot, type NodeName, type WeaponLod, type WeaponModel } from './WeaponModel';
import { WM } from './weaponMaterials';

/** Material names used in the Blender scripts, mapped to the game's shared materials. */
const MATERIALS: Record<string, () => THREE.Material> = {
  metal: WM.metal,
  polymer: WM.polymer,
  interior: WM.interior,
  bolt: WM.bolt,
  brass: WM.brass,
  tan: WM.tan,
  glass: WM.glass,
  dot: WM.dot,
  wood: WM.akWood,
  gripWood: WM.gripWood,
  green: WM.stockGreen,
  shell: WM.shellHull,
};

const NODE_NAMES: readonly NodeName[] = ['magazine', 'bolt', 'chargingHandle', 'slide', 'hammer', 'trigger', 'selector', 'dustCover', 'boltRelease', 'slideStop', 'pump'];

/** Swaps the exported placeholder materials for the game's materials (by name). */
export function applyGameMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    const make = MATERIALS[name];
    if (!make) throw new Error(`Unknown model material "${name}"`);
    mesh.material = make();
  });
}

/**
 * A weapon from a Blender model (`guns/<key>_<lod>`): the same moving parts and points as the
 * code-built models, plus attachment mounts, re-centered so the right-hand grip is the origin.
 */
export function weaponFromGlb(key: string, lod: WeaponLod): WeaponModel {
  const scene = instantiate(`guns/${key}_${lod}`);
  applyGameMaterials(scene);
  const root = new THREE.Group();
  root.name = `${key}-${lod}`;
  const content = new THREE.Group();
  // Static parts sit straight in the content group, like the code-built models.
  const body = scene.getObjectByName('body');
  if (body) {
    for (const child of [...body.children]) content.add(child);
    if ((body as THREE.Mesh).isMesh) content.add(body);
    else body.removeFromParent();
  }
  for (const child of [...scene.children]) if (child !== body) content.add(asGroup(child));

  const nodes: Partial<Record<NodeName, THREE.Object3D>> = {};
  for (const name of NODE_NAMES) {
    const n = content.getObjectByName(name);
    if (n) nodes[name] = n;
  }
  const points = {} as Record<AttachmentName, THREE.Object3D>;
  for (const name of ATTACHMENT_NAMES) {
    const p = content.getObjectByName(`pt_${name}`);
    if (!p) throw new Error(`${key}: missing point ${name}`);
    points[name] = p;
  }
  const mounts: Partial<Record<MountSlot, THREE.Object3D>> = {};
  for (const slot of MOUNT_SLOTS) {
    const m = content.getObjectByName(`mount_${slot}`);
    if (m) mounts[slot] = m;
  }
  content.position.copy(points.rightHandGrip.position).negate();
  root.add(content);
  root.updateMatrixWorld(true);
  return { root, nodes, points, mounts, lod, key };
}

/**
 * A named part with one material arrives as a bare mesh; wrap it in a group at the same pivot so
 * every part is a group around its meshes, as in the code-built models.
 */
function asGroup(o: THREE.Object3D): THREE.Object3D {
  if (!(o as THREE.Mesh).isMesh) return o;
  const g = new THREE.Group();
  g.name = o.name;
  g.position.copy(o.position);
  g.quaternion.copy(o.quaternion);
  g.scale.copy(o.scale);
  o.position.set(0, 0, 0);
  o.quaternion.identity();
  o.scale.set(1, 1, 1);
  o.name = `${o.name}-mesh`;
  g.add(o);
  return g;
}
