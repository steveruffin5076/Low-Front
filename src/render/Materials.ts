import * as THREE from 'three';

export interface MaterialOptions {
  roughness?: number;
  metalness?: number;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared flat-shaded material per color. The same color and options always return the same instance. */
export function paletteMaterial(color: number, opts: MaterialOptions = {}): THREE.MeshStandardMaterial {
  const roughness = opts.roughness ?? 0.8;
  const metalness = opts.metalness ?? 0;
  const key = `${color}|${roughness}|${metalness}`;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
    cache.set(key, mat);
  }
  return mat;
}

/** All shared materials, e.g. for a debug wireframe toggle. */
export function allPaletteMaterials(): THREE.MeshStandardMaterial[] {
  return [...cache.values()];
}
