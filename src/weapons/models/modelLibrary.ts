import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Models built in Blender (`npm run models`, see tools/blender/) and exported to public/models/.
 * They are all loaded once at startup; `instantiate` then gives a copy synchronously. Geometry is
 * shared between copies (marked `shared`, so disposing a copy keeps it).
 */
export interface ModelManifest {
  [key: string]: { file: string; triangles: number };
}

const library = new Map<string, THREE.Group>();

/** Reads a file under public/models/ (fetch in the browser, the file system in tests). */
export type ModelReader = (file: string) => Promise<ArrayBuffer>;

export async function loadModelLibrary(read: ModelReader): Promise<void> {
  const manifest = JSON.parse(new TextDecoder().decode(await read('manifest.json'))) as ModelManifest;
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(manifest).map(async ([key, entry]) => {
      const gltf = await loader.parseAsync(await read(entry.file), '');
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Non-indexed, like the code-built models, so they merge with them (soldier geometry).
        const flat = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        flat.userData.shared = true;
        mesh.geometry = flat;
      });
      library.set(key, gltf.scene);
    }),
  );
}

/** Browser and desktop app: models are served next to the page. */
export function fetchModelReader(base: string): ModelReader {
  return async (file) => {
    const res = await fetch(`${base}models/${file}`);
    if (!res.ok) throw new Error(`Could not load model ${file}: ${res.status}`);
    return res.arrayBuffer();
  };
}

export function hasModel(key: string): boolean {
  return library.has(key);
}

/** A copy of a loaded model: new objects, shared geometry, the exported (placeholder) materials. */
export function instantiate(key: string): THREE.Group {
  const src = library.get(key);
  if (!src) throw new Error(`Model ${key} is not loaded`);
  return src.clone(true);
}
