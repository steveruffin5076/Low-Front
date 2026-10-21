import * as THREE from 'three';
import { mergePainted, paint } from '../../weapons/models/ModelKit';
import type { Surface } from '../../physics/collision';

/** A prop's collision box in its local frame (origin on the ground, front along +Z). */
export interface PropCollider {
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  yaw?: number;
}

export interface PropModel {
  /** Painted, merged geometry (vertex colors). White parts take the instance tint. */
  geometry: THREE.BufferGeometry;
  colliders: readonly PropCollider[];
  surface: Surface;
  /** Thin props (poles, fences) are not used for cover points. */
  noCover?: boolean;
  castShadow?: boolean;
}

/** Collects painted parts for one prop model. */
export class PropParts {
  private readonly geos: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: number): this {
    this.geos.push(paint(geo, color));
    return this;
  }

  box(center: readonly [number, number, number], size: readonly [number, number, number], color: number, rot: readonly [number, number, number] = [0, 0, 0]): this {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]);
    g.translate(center[0], center[1], center[2]);
    return this.add(g, color);
  }

  /** Cylinder along `axis`, centered at `center`. */
  cyl(center: readonly [number, number, number], radius: number, length: number, color: number, axis: 'x' | 'y' | 'z' = 'y', segments = 8): this {
    const g = new THREE.CylinderGeometry(radius, radius, length, segments);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(center[0], center[1], center[2]);
    return this.add(g, color);
  }

  blob(center: readonly [number, number, number], radius: number, color: number, squashY = 1): this {
    const g = new THREE.IcosahedronGeometry(radius, 0).scale(1, squashY, 1);
    g.translate(center[0], center[1], center[2]);
    return this.add(g, color);
  }

  build(): THREE.BufferGeometry {
    const g = mergePainted(this.geos);
    g.userData.shared = true;
    return g;
  }
}
