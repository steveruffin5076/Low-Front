import * as THREE from 'three';

/** Frees GPU memory for all meshes under `root`. Materials shared between meshes are freed once. */
export function disposeObject(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mats: THREE.Material[] = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) materials.add(m);
  });
  for (const m of materials) m.dispose();
}
