import * as THREE from 'three';
import type { PropDef, PropType } from '../data/map/types';
import { buildPropModel, PROP_TINTS } from './props/models';
import type { PropModel } from './props/PropKit';
import { mapMaterial } from './StaticSink';
import { volume, type Volume } from './Volume';

type InstancedType = Exclude<PropType, 'footbridge'>;

const models = new Map<InstancedType, PropModel>();

export function propModel(type: InstancedType): PropModel {
  let m = models.get(type);
  if (!m) {
    m = buildPropModel(type);
    models.set(type, m);
  }
  return m;
}

/** Collision volumes of one placed prop. */
export function propVolumes(def: PropDef): Volume[] {
  if (def.type === 'footbridge') return [];
  const m = propModel(def.type);
  const c = Math.cos(def.rotY);
  const s = Math.sin(def.rotY);
  const y = def.y ?? 0;
  return m.colliders.map((col) => {
    const [lx, ly, lz] = col.center;
    const v = volume([def.x + lx * c + lz * s, y + ly, def.z - lx * s + lz * c], col.size, 'solid', m.surface, def.rotY + (col.yaw ?? 0));
    if (m.noCover) v.noCover = true;
    return v;
  });
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0);
const color = new THREE.Color();

/**
 * One InstancedMesh per prop type (plan section 14): every car in the map is a single draw call.
 * White parts of a model take the instance tint (car paint, container colors).
 */
export function buildProps(defs: readonly PropDef[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'props';
  const byType = new Map<InstancedType, PropDef[]>();
  for (const d of defs) {
    if (d.type === 'footbridge') continue;
    const list = byType.get(d.type) ?? [];
    list.push(d);
    byType.set(d.type, list);
  }
  for (const [type, list] of byType) {
    const model = propModel(type);
    const mesh = new THREE.InstancedMesh(model.geometry, mapMaterial(), list.length);
    mesh.name = `props-${type}`;
    mesh.castShadow = model.castShadow ?? true;
    mesh.receiveShadow = true;
    const tints = (PROP_TINTS as Partial<Record<InstancedType, readonly number[]>>)[type];
    list.forEach((d, i) => {
      m4.compose(pos.set(d.x, d.y ?? 0, d.z), q.setFromAxisAngle(Y, d.rotY), one);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, color.set(d.color ?? (tints ? tints[i % tints.length] : 0xffffff)));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}
