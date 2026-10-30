import * as THREE from 'three';

/**
 * Frees GPU memory for all meshes and light shadow maps under `root`. Materials shared between meshes are freed once;
 * geometry and materials marked `userData.shared` (palette materials, cached map geometry)
 * are kept because other objects still use them.
 */
export function disposeObject(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    // A shadow-casting light owns its shadow map render target.
    if (obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight || obj instanceof THREE.PointLight) obj.shadow.dispose();
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.geometry.userData.shared) obj.geometry.dispose();
    const mats: THREE.Material[] = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) materials.add(m);
  });
  for (const m of materials) if (!m.userData.shared) m.dispose();
}
