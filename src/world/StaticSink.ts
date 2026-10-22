import * as THREE from 'three';
import { MAP } from '../data/map/config';
import { mergePainted, paint } from '../weapons/models/ModelKit';

let sharedMaterial: THREE.MeshStandardMaterial | null = null;

/** One flat-shaded vertex-color material for all map geometry. */
export function mapMaterial(): THREE.MeshStandardMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    sharedMaterial.userData.shared = true;
  }
  return sharedMaterial;
}

const tmpBox = new THREE.Box3();
const tmpCenter = new THREE.Vector3();

/**
 * Collects static map geometry and merges it into one mesh per 60 × 60 m chunk
 * (plan section 14), so the whole map draws in a few dozen calls and chunks outside the
 * view are culled.
 */
export class StaticSink {
  private readonly chunks = new Map<string, THREE.BufferGeometry[]>();
  triangles = 0;

  add(geo: THREE.BufferGeometry, color: number): void {
    const g = paint(geo, color);
    tmpBox.setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute).getCenter(tmpCenter);
    const key = `${Math.floor(tmpCenter.x / MAP.chunkSize)},${Math.floor(tmpCenter.z / MAP.chunkSize)}`;
    let list = this.chunks.get(key);
    if (!list) {
      list = [];
      this.chunks.set(key, list);
    }
    list.push(g);
    this.triangles += g.getAttribute('position').count / 3;
  }

  /** Box of `size` centered at `center`, rotated by `yaw` then tilted by `tilt` around local X. */
  box(center: readonly [number, number, number], size: readonly [number, number, number], color: number, yaw = 0, tilt = 0): void {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    if (tilt) g.rotateX(tilt);
    if (yaw) g.rotateY(yaw);
    g.translate(center[0], center[1], center[2]);
    this.add(g, color);
  }

  /** Horizontal quad at height y covering the rect (x0, z0)–(x1, z1). */
  flat(x0: number, z0: number, x1: number, z1: number, y: number, color: number): void {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    this.add(g, color);
  }

  /** Vertical quad facing direction `yaw` (0 = facing +Z). */
  panel(center: readonly [number, number, number], width: number, height: number, yaw: number, color: number): void {
    const g = new THREE.PlaneGeometry(width, height).rotateY(yaw);
    g.translate(center[0], center[1], center[2]);
    this.add(g, color);
  }

  /** One mesh per chunk, all sharing the map material. */
  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, geos] of this.chunks) {
      const mesh = new THREE.Mesh(mergePainted(geos), mapMaterial());
      mesh.name = `${name}-${key}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.geometry.userData.shared = true;
      group.add(mesh);
    }
    this.chunks.clear();
    return group;
  }
}
