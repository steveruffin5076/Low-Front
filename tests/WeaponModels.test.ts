import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEAPONS, WEAPON_IDS } from '../src/data/weapons';
import { countTriangles } from '../src/weapons/models/ModelKit';
import { ATTACHMENT_NAMES } from '../src/weapons/models/WeaponModel';
import { OVERALL_LENGTH, REQUIRED_NODES, TRI_BUDGET, buildWeaponModel } from '../src/weapons/models/weaponModels';

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

  it('has the moving parts its action data animates', () => {
    const a = WEAPONS[id].action;
    const needed: string[] = [a.cycleNode, 'trigger', 'magazine'];
    if (a.hammer) needed.push('hammer');
    if (a.dustCover) needed.push('dustCover');
    if (a.emptyReload === 'boltRelease') needed.push('boltRelease');
    if (a.emptyReload === 'slideStop') needed.push('slideStop');
    for (const name of needed) expect(fp.nodes[name as keyof typeof fp.nodes], name).toBeDefined();
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
    expect(fpTris).toBeGreaterThanOrEqual(TRI_BUDGET[id][0]);
    expect(fpTris).toBeLessThanOrEqual(TRI_BUDGET[id][1]);
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

/** Real iron sights: height of the sight line over the bore, and the sight radius (meters). */
const IRON_SIGHTS = {
  m4a1: { height: 0.066, radius: 0.368 },
  ak47: { height: 0.0485, radius: 0.378 },
  sr9: { height: 0.05, radius: 0.39 },
  br12: { height: 0.04, radius: 0.64 },
} as const;

describe.each(['m4a1', 'ak47', 'sr9', 'br12'] as const)('%s iron sights', (id) => {
  const fp = buildWeaponModel(id, 'fp');
  fp.root.updateMatrixWorld(true);
  const eye = fp.points.sightAnchor.getWorldPosition(new THREE.Vector3());
  const muzzle = fp.points.muzzle.getWorldPosition(new THREE.Vector3());
  const hit = (dx: number, dy: number): THREE.Intersection | undefined => {
    const ray = new THREE.Raycaster(new THREE.Vector3(eye.x + dx, eye.y + dy, eye.z), new THREE.Vector3(0, 0, -1));
    return ray.intersectObject(fp.root, true)[0];
  };

  it('sits at the real height over the bore', () => {
    expect(eye.y - muzzle.y).toBeCloseTo(IRON_SIGHTS[id].height, 3);
  });

  it('lines up: just over the sight line is clear, just under it meets the front post', () => {
    expect(hit(0, 0.001)).toBeUndefined();
    const post = hit(0, -0.001);
    expect(post).toBeDefined();
    // The front post is far forward, past the rear sight.
    expect(post!.point.z).toBeLessThan(eye.z - 0.3);
  });

  it('has the real sight radius', () => {
    const rear = hit(0.004, -0.001);
    const front = hit(0, -0.001);
    expect(rear).toBeDefined();
    expect(rear!.point.z - front!.point.z).toBeCloseTo(IRON_SIGHTS[id].radius, 1);
    expect(Math.abs(rear!.point.z - front!.point.z - IRON_SIGHTS[id].radius)).toBeLessThan(0.012);
  });
});
