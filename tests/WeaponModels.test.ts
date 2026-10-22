import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEAPON_IDS } from '../src/data/weapons';
import { countTriangles } from '../src/weapons/models/ModelKit';
import { ATTACHMENT_NAMES } from '../src/weapons/models/WeaponModel';
import { OVERALL_LENGTH, REQUIRED_NODES, buildWeaponModel } from '../src/weapons/models/weaponModels';

function stats(root: THREE.Object3D): { size: THREE.Vector3; staticMeshes: number; materials: number } {
  const box = new THREE.Box3().setFromObject(root);
  const mats = new Set<THREE.Material>();
  let staticMeshes = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    mats.add(o.material as THREE.Material);
    // Static meshes sit directly in the content group under the root.
    if (o.parent?.parent === root) staticMeshes++;
  });
  return { size: box.getSize(new THREE.Vector3()), staticMeshes, materials: mats.size };
}

describe.each(WEAPON_IDS)('%s model', (id) => {
  const fp = buildWeaponModel(id, 'fp');
  const tp = buildWeaponModel(id, 'tp');

  it('has every required moving part in first person', () => {
    for (const name of REQUIRED_NODES[id]) expect(fp.nodes[name], name).toBeDefined();
  });

  it('has every attachment point in both versions', () => {
    for (const m of [fp, tp]) for (const name of ATTACHMENT_NAMES) expect(m.points[name], name).toBeDefined();
    expect(tp.nodes.magazine).toBeDefined();
  });

  it('puts the right hand grip at the origin', () => {
    const p = fp.points.rightHandGrip.getWorldPosition(new THREE.Vector3());
    expect(p.length()).toBeLessThan(1e-9);
  });

  it('points the muzzle along -Z', () => {
    const muzzle = fp.points.muzzle.getWorldPosition(new THREE.Vector3());
    const box = new THREE.Box3().setFromObject(fp.root);
    expect(muzzle.z).toBeCloseTo(box.min.z, 2);
  });

  it('stays within the triangle budgets', () => {
    const fpTris = countTriangles(fp.root);
    const tpTris = countTriangles(tp.root);
    expect(fpTris).toBeGreaterThanOrEqual(600);
    expect(fpTris).toBeLessThanOrEqual(1500);
    expect(tpTris).toBeLessThan(300);
  });

  it('matches the real overall length within 5%', () => {
    for (const m of [fp, tp]) {
      expect(stats(m.root).size.z).toBeGreaterThan(OVERALL_LENGTH[id] * 0.95);
      expect(stats(m.root).size.z).toBeLessThan(OVERALL_LENGTH[id] * 1.05);
    }
  });

  it('merges static parts into one mesh per material', () => {
    const s = stats(fp.root);
    expect(s.staticMeshes).toBeLessThanOrEqual(s.materials);
  });
});
