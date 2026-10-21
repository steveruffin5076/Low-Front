import * as THREE from 'three';
import type { Surface } from '../physics/collision';

/**
 * An oriented box that blocks movement and bullets. Every solid part of the map is emitted
 * as a volume first; Rapier colliders, the nav grid and cover points are all built from the
 * same list, so they always agree.
 */
export type VolumeKind =
  /** Walls, building bodies, props: blocks movement. */
  | 'solid'
  /** Slabs, roofs, decks, raised ground: its top is a walkable floor. */
  | 'floor'
  /** Stair flights and ramps: walkable by physics, links in the nav grid. */
  | 'ramp';

export interface Volume {
  center: THREE.Vector3;
  half: THREE.Vector3;
  /** Rotation around Y, then a tilt around the local X axis (ramps). Radians. */
  yaw: number;
  tilt: number;
  kind: VolumeKind;
  surface: Surface;
  /** Cover generation skips volumes with this set (thin railings, invisible walls). */
  noCover?: boolean;
  /** Invisible (boundary) walls are not drawn. */
  invisible?: boolean;
}

export function volume(
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  kind: VolumeKind,
  surface: Surface,
  yaw = 0,
  tilt = 0,
): Volume {
  return {
    center: new THREE.Vector3(...center),
    half: new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2),
    yaw,
    tilt,
    kind,
    surface,
  };
}

const q = new THREE.Quaternion();
const e = new THREE.Euler();

export function volumeQuaternion(v: Volume, out = q): THREE.Quaternion {
  return out.setFromEuler(e.set(v.tilt, v.yaw, 0, 'YXZ'));
}

/** World-space axis-aligned bounds of the volume. */
export function volumeBounds(v: Volume, out = new THREE.Box3()): THREE.Box3 {
  const m = new THREE.Matrix4().compose(v.center, volumeQuaternion(v, new THREE.Quaternion()), new THREE.Vector3(1, 1, 1));
  out.makeEmpty();
  const p = new THREE.Vector3();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.expandByPoint(p.set(sx * v.half.x, sy * v.half.y, sz * v.half.z).applyMatrix4(m));
  }
  return out;
}

/** Top height of a volume (highest point). */
export function volumeTop(v: Volume): number {
  if (v.tilt === 0) return v.center.y + v.half.y;
  return volumeBounds(v).max.y;
}

/**
 * True when the circle (x, z, radius) overlaps the volume's footprint. Exact for yaw-only
 * volumes; tilted volumes use their bounding box.
 */
export function footprintOverlaps(v: Volume, x: number, z: number, radius: number): boolean {
  if (v.tilt !== 0) {
    const b = volumeBounds(v);
    return x + radius > b.min.x && x - radius < b.max.x && z + radius > b.min.z && z - radius < b.max.z;
  }
  const dx = x - v.center.x;
  const dz = z - v.center.z;
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  // Into the volume's local frame (inverse yaw).
  const lx = c * dx - s * dz;
  const lz = s * dx + c * dz;
  const qx = Math.max(Math.abs(lx) - v.half.x, 0);
  const qz = Math.max(Math.abs(lz) - v.half.z, 0);
  return qx * qx + qz * qz < radius * radius || (Math.abs(lx) <= v.half.x && Math.abs(lz) <= v.half.z);
}

/** Moves a volume from a local frame (yaw around origin, then offset) into the world. */
export function transformVolume(v: Volume, yaw: number, offset: THREE.Vector3): Volume {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = v.center.x * c + v.center.z * s;
  const z = -v.center.x * s + v.center.z * c;
  return { ...v, center: new THREE.Vector3(x + offset.x, v.center.y + offset.y, z + offset.z), yaw: v.yaw + yaw };
}
