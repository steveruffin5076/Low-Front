import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  GEAR_COLORS,
  SOLDIER_BONES,
  SOLDIER_PARTS,
  TEAM_COLORS,
  type BoneName,
  type PartColor,
  type Team,
} from '../../data/soldier';
import type { Loadout, WeaponId } from '../../data/weapons';
import { box, paint } from '../../weapons/models/ModelKit';
import { buildWeaponModel } from '../../weapons/models/weaponModels';

export type SoldierLod = 'near' | 'far';

const BONE_INDEX = new Map<BoneName, number>(SOLDIER_BONES.map((b, i) => [b.name, i]));

/** Far-model weapons: one box each (grip-point origin, muzzle along −Z). */
const FAR_WEAPON: Record<WeaponId, { size: [number, number, number]; pos: [number, number, number] }> = {
  m4a1: { size: [0.05, 0.1, 0.84], pos: [0, 0.06, -0.15] },
  ak47: { size: [0.05, 0.1, 0.88], pos: [0, 0.05, -0.17] },
  sr9: { size: [0.05, 0.1, 0.68], pos: [0, 0.05, -0.12] },
  br12: { size: [0.05, 0.1, 0.99], pos: [0, 0.05, -0.12] },
  m1911: { size: [0.035, 0.12, 0.21], pos: [0, 0.03, -0.07] },
};

const geometryCache = new Map<string, THREE.BufferGeometry>();
let sharedMaterial: THREE.MeshStandardMaterial | null = null;

/** One flat-shaded vertex-color material for every soldier. */
export function soldierMaterial(): THREE.MeshStandardMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    sharedMaterial.userData.shared = true;
  }
  return sharedMaterial;
}

/** Rest position of every bone in soldier space (the rest pose has no rotations). */
function restPositions(): Map<BoneName, THREE.Vector3> {
  const out = new Map<BoneName, THREE.Vector3>();
  for (const b of SOLDIER_BONES) {
    const p = new THREE.Vector3(...b.pos);
    if (b.parent) p.add(out.get(b.parent)!);
    out.set(b.name, p);
  }
  return out;
}

/** Paints a geometry and binds every vertex fully to one bone (rigid skinning). */
function skinned(geo: THREE.BufferGeometry, color: number, bone: BoneName): THREE.BufferGeometry {
  const g = paint(geo, color);
  const n = g.getAttribute('position').count;
  const index = new Uint16Array(n * 4);
  const weight = new Float32Array(n * 4);
  const b = BONE_INDEX.get(bone)!;
  for (let i = 0; i < n; i++) {
    index[i * 4] = b;
    weight[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
  return g;
}

function colorOf(team: Team, c: PartColor): number {
  return c === 'uniform' || c === 'trousers' || c === 'helmet' ? TEAM_COLORS[team][c] : GEAR_COLORS[c];
}

/** Weapon geometry in its bone's frame: the weapon root on `bone`, the magazine on `magBone`. */
function weaponGeometry(id: WeaponId, lod: SoldierLod, bone: BoneName, magBone: BoneName): THREE.BufferGeometry[] {
  if (lod === 'far') {
    const f = FAR_WEAPON[id];
    return [skinned(box(f.size, { pos: f.pos }), GEAR_COLORS.dark, bone)];
  }
  const model = buildWeaponModel(id, 'tp');
  model.root.updateMatrixWorld(true);
  const mag = model.nodes.magazine;
  const out: THREE.BufferGeometry[] = [];
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let onMag = false;
    for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (p === mag) onMag = true;
    const color = (mesh.material as THREE.MeshStandardMaterial).color.getHex();
    out.push(skinned(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), color, onMag ? magBone : bone));
  });
  return out;
}

/** Merged, skinned geometry for one team, loadout and level of detail. Cached and shared. */
export function soldierGeometry(team: Team, loadout: Loadout, lod: SoldierLod): THREE.BufferGeometry {
  const key = `${team}|${loadout.primary}|${loadout.secondary}|${lod}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const rest = restPositions();
  const parts: THREE.BufferGeometry[] = [];
  for (const p of SOLDIER_PARTS) {
    if (lod === 'far' && !p.lod) continue;
    const at = rest.get(p.bone)!;
    parts.push(skinned(box(p.size, { pos: [p.pos[0] + at.x, p.pos[1] + at.y, p.pos[2] + at.z] }), colorOf(team, p.color), p.bone));
  }
  parts.push(...weaponGeometry(loadout.primary, lod, 'primary', 'primaryMag'));
  parts.push(...weaponGeometry(loadout.secondary, lod, 'secondary', 'secondaryMag'));
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Could not merge soldier geometry');
  for (const g of parts) g.dispose();
  merged.userData.shared = true;
  geometryCache.set(key, merged);
  return merged;
}

/** Bounds that hold the soldier in any pose, lying down included (feet at the origin). */
const BOUNDS = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.1);

/**
 * A soldier's look: one skeleton (the procedural rig's pivots) and two skinned meshes bound to it,
 * the full model and a simplified far model. Each draws in one call, weapons included.
 */
export class SoldierModel {
  readonly root = new THREE.Group();
  readonly bones = {} as Record<BoneName, THREE.Bone>;
  readonly skeleton: THREE.Skeleton;
  readonly near: THREE.SkinnedMesh;
  readonly far: THREE.SkinnedMesh;
  /** Rest positions relative to the parent, for bones the rig moves. */
  readonly restPos = {} as Record<BoneName, THREE.Vector3>;
  private fadeMaterial: THREE.MeshStandardMaterial | null = null;
  private lodState: SoldierLod = 'near';

  constructor(
    readonly team: Team,
    readonly loadout: Loadout,
  ) {
    const list: THREE.Bone[] = [];
    for (const def of SOLDIER_BONES) {
      const bone = new THREE.Bone();
      bone.name = def.name;
      bone.position.set(...def.pos);
      this.restPos[def.name] = bone.position.clone();
      (def.parent ? this.bones[def.parent] : this.root).add(bone);
      this.bones[def.name] = bone;
      list.push(bone);
    }
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(list);
    this.near = this.mesh(soldierGeometry(team, loadout, 'near'));
    this.far = this.mesh(soldierGeometry(team, loadout, 'far'));
    this.setShadows(true);
    this.far.visible = false;
  }

  get lod(): SoldierLod {
    return this.lodState;
  }

  setLod(lod: SoldierLod): void {
    this.lodState = lod;
    this.near.visible = lod === 'near';
    this.far.visible = lod === 'far';
  }

  /** 1 = solid, 0 = gone. A soldier gets its own material only while it fades. */
  setOpacity(opacity: number): void {
    if (opacity >= 1) {
      if (this.fadeMaterial) {
        this.fadeMaterial.dispose();
        this.fadeMaterial = null;
        this.near.material = this.far.material = soldierMaterial();
      }
      return;
    }
    if (!this.fadeMaterial) {
      this.fadeMaterial = soldierMaterial().clone();
      this.fadeMaterial.transparent = true;
      this.fadeMaterial.depthWrite = false;
      this.near.material = this.far.material = this.fadeMaterial;
    }
    this.fadeMaterial.opacity = Math.max(0, opacity);
  }

  /** Only the near model casts a shadow: far soldiers' shadows are too small to see, and skipping them saves shadow-pass draws. */
  setShadows(cast: boolean): void {
    this.near.castShadow = cast;
    this.far.castShadow = false;
  }

  dispose(): void {
    this.fadeMaterial?.dispose();
    this.skeleton.dispose();
    this.root.removeFromParent();
  }

  private mesh(geo: THREE.BufferGeometry): THREE.SkinnedMesh {
    const m = new THREE.SkinnedMesh(geo, soldierMaterial());
    m.bind(this.skeleton, new THREE.Matrix4());
    m.boundingSphere = BOUNDS.clone();
    this.root.add(m);
    return m;
  }
}
